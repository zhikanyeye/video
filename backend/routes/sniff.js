/**
 * 嗅探路由 — 分层提取视频源 v3
 * Layer 1: DOM / meta / JSON-LD / __NEXT_DATA__ / 已知播放器 / data-* / script / iframe 收集（无额外请求）
 * Layer 2: iframe 跟进（最多 2 个）+ 可疑 URL HEAD 验证（最多 8 个，带 Referer 绕过防盗链）
 * 总请求数 ≤ 11，总超时预算 20s
 */
import { Router } from 'express';
import http from 'http';
import https from 'https';
import { FETCH_TIMEOUT_MS, MAX_PAGE_SIZE_BYTES } from '../config.js';
import { isSafeFetchUrl } from '../utils/safe-url.js';

const HEAD_TIMEOUT_MS = 3_500;
const MAX_IFRAMES = 2;
const MAX_HEAD_CHECKS = 8;
const TOTAL_BUDGET_MS = 20_000;

const VIDEO_PATH_KEYWORDS = /\b(video|stream|play|media|hls|dash|manifest|m3u8|mp4|flv|vod|live|segment|chunk|source)\b/i;
const VIDEO_CONTENT_TYPES = /^(video\/|application\/x-mpegurl|application\/vnd\.apple\.mpegurl|application\/dash\+xml)/i;
const NON_VIDEO_EXT = /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot|json|xml|html|htm)(\?|$)/i;

// 覆盖主流播放器 / CDN / 国内视频站常见字段名
const VIDEO_KEY_PAT = 'url|src|file|source|video|stream|hls|m3u8|mp4|path|link|' +
  'playUrl|videoUrl|streamUrl|playbackUrl|hlsUrl|dashUrl|dashUri|hlsUri|' +
  'mediaUrl|videoSrc|videoPath|m3u8Url|flvUrl|videoPlayUrl|cdnUrl|videoAddr|' +
  'play_url|hls_url|video_url|stream_url|media_url|manifest|manifestUrl|' +
  'playUri|streamUri|hlsLink|mp4Url|flvLink|videoLink|videoFile|sourceUrl|' +
  'vid_url|vid_src|bk_url|origin_url|realUrl|real_url|rawUrl|raw_url';

export function createSniffRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: '缺少 url 参数' });

    try {
      if (!(await isSafeFetchUrl(url))) {
        return res.status(403).json({ error: '不允许访问内网地址' });
      }

      const startTime = Date.now();
      const html = await fetchPage(url);
      const layer1 = extractLayer1(html, url);
      const layer2Sources = await runLayer2(layer1, startTime, url);

      const allSources = mergeAndScore([...layer1.confirmed, ...layer2Sources]);
      res.json({
        url,
        sources: allSources.slice(0, 15),
        meta: {
          layer1Count: layer1.confirmed.length,
          layer2Count: layer2Sources.length,
          suspiciousCount: layer1.suspicious.length,
          elapsed: Date.now() - startTime,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ---- 页面抓取 ----

async function fetchPage(url, redirectCount = 0) {
  if (redirectCount > 4) throw new Error('重定向次数过多');
  if (!(await isSafeFetchUrl(url))) throw new Error('不允许访问内网地址');

  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('无效URL')); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      timeout: FETCH_TIMEOUT_MS,
    }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        try {
          const next = new URL(resp.headers.location, url).href;
          resp.resume();
          fetchPage(next, redirectCount + 1).then(resolve).catch(reject);
        } catch { reject(new Error('无效的重定向地址')); }
        return;
      }
      let data = '';
      let size = 0;
      resp.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_PAGE_SIZE_BYTES) { req.destroy(); resolve(data); return; }
        data += chunk;
      });
      resp.on('end', () => resolve(data));
      resp.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.end();
  });
}

// ---- Layer 1：无额外请求 ----

function extractLayer1(html, baseUrl) {
  const confirmed = [];
  const suspicious = [];          // 普通可疑（需要关键词过滤）
  const suspiciousPriority = [];  // 高置信可疑（来自 video key，直接放前面）
  const iframeSrcs = [];
  const seenConfirmed = new Set();
  const seenSuspicious = new Set();

  function addConfirmed(rawUrl, from) {
    const u = tryResolve(rawUrl, baseUrl);
    if (!u || seenConfirmed.has(u)) return;
    seenConfirmed.add(u);
    const type = detectVideoType(u);
    if (type === 'unknown') return;
    confirmed.push({ url: u, type, from, score: scoreSource(u, type, from) });
  }

  // 普通可疑：需要路径含视频关键词
  function addSuspicious(rawUrl) {
    const u = tryResolve(rawUrl, baseUrl);
    if (!u || seenConfirmed.has(u) || seenSuspicious.has(u)) return;
    if (NON_VIDEO_EXT.test(u)) return;
    if (!VIDEO_PATH_KEYWORDS.test(u)) return;
    seenSuspicious.add(u);
    suspicious.push(u);
  }

  // 高置信可疑：来自 video-key JSON，绕过关键词过滤直接送 HEAD 验证
  function addSuspiciousPriority(rawUrl) {
    const u = tryResolve(rawUrl, baseUrl);
    if (!u || seenConfirmed.has(u) || seenSuspicious.has(u)) return;
    if (NON_VIDEO_EXT.test(u)) return;
    seenSuspicious.add(u);
    suspiciousPriority.push(u);
  }

  // 1.1 DOM 标签
  for (const m of html.matchAll(/<(?:video|source)[^>]+\bsrc=["']([^"']+)["']/gi)) addConfirmed(m[1], 'dom-src');
  for (const m of html.matchAll(/<(?:video|source)[^>]+\bdata-src=["']([^"']+)["']/gi)) addConfirmed(m[1], 'dom-data-src');
  for (const m of html.matchAll(/<a[^>]+\bhref=["']([^"']+\.(?:mp4|m3u8|mpd|flv|webm|ts)(?:[?#][^"']*)?)["']/gi)) addConfirmed(m[1], 'dom-a');

  // 1.2 meta og:video / twitter:player
  for (const m of html.matchAll(/<meta[^>]+\bproperty=["']og:video(?::url)?["'][^>]+\bcontent=["']([^"']+)["']/gi)) addConfirmed(m[1], 'meta-og');
  for (const m of html.matchAll(/<meta[^>]+\bcontent=["']([^"']+)["'][^>]+\bproperty=["']og:video(?::url)?["']/gi)) addConfirmed(m[1], 'meta-og');
  for (const m of html.matchAll(/<meta[^>]+\bname=["']twitter:player:stream["'][^>]+\bcontent=["']([^"']+)["']/gi)) addConfirmed(m[1], 'meta-twitter');
  for (const m of html.matchAll(/<meta[^>]+\bcontent=["']([^"']+)["'][^>]+\bname=["']twitter:player:stream["']/gi)) addConfirmed(m[1], 'meta-twitter');

  // 1.3 data-* 属性
  for (const m of html.matchAll(/\bdata-[a-z-]+=["'](https?:\/\/[^"']{10,})["']/gi)) addConfirmed(m[1], 'data-attr');

  // 1.4 script 标签内容
  for (const m of html.matchAll(/<script([^>]*)>([^]*?)<\/script>/gi)) {
    const attrs = m[1];
    const body = m[2];
    const hasSrc = /\bsrc=["'][^"']+["']/.test(attrs);
    const isJsonType = /\btype=["']application\/(json|ld\+json)["']/.test(attrs);

    if (isJsonType) {
      // JSON/LD+JSON 块 — 直接尝试解析
      extractJsonBlock(body.trim(), addConfirmed, addSuspiciousPriority);
      continue;
    }
    if (hasSrc) continue; // 外链 script，跳过
    extractFromScript(body.slice(0, 80_000), addConfirmed, addSuspicious, addSuspiciousPriority);
  }

  // 1.4b JSON-LD VideoObject（contentUrl / embedUrl，SEO 标准结构）
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)) {
    extractJsonLd(m[1].trim(), addConfirmed, addSuspiciousPriority);
  }

  // 1.4c __NEXT_DATA__ 专项解析（Next.js 站点标配）
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([^]*?)<\/script>/i);
  if (nextData) {
    try {
      const obj = JSON.parse(nextData[1].trim());
      const urls = [], susp = [];
      collectUrlsFromObject(obj, urls, susp);
      for (const u of urls) addConfirmed(unescUrl(u), 'next-data');
      for (const u of susp) addSuspiciousPriority(unescUrl(u));
    } catch { /* skip */ }
  }

  // 1.4d 已知播放器特征识别（JW Player / Video.js / DPlayer / ArtPlayer 等）
  extractKnownPlayers(html, addConfirmed, addSuspiciousPriority);

  // 1.5 全文 URL（带扩展名，含 escaped slash 形式）
  const extPats = [
    [/https?:\/\/[^\s"'<>\\]+?\.mpd(?:[?#][^\s"'<>\\]*)?/gi, 'regex-ext'],
    [/https?:\/\/[^\s"'<>\\]+?\.m3u8(?:[?#][^\s"'<>\\]*)?/gi, 'regex-ext'],
    [/https?:\/\/[^\s"'<>\\]+?\.mp4(?:[?#][^\s"'<>\\]*)?/gi, 'regex-ext'],
    [/https?:\/\/[^\s"'<>\\]+?\.flv(?:[?#][^\s"'<>\\]*)?/gi, 'regex-ext'],
    [/https?:\/\/[^\s"'<>\\]+?\.webm(?:[?#][^\s"'<>\\]*)?/gi, 'regex-ext'],
    [/https?:\/\/[^\s"'<>\\]+?\.(?:ogg|ogv|mov|mkv|avi)(?:[?#][^\s"'<>\\]*)?/gi, 'regex-ext'],
  ];
  for (const [re, from] of extPats) {
    for (const m of html.matchAll(re)) addConfirmed(m[0], from);
  }
  // escaped slash 形式（JSON 序列化常见：https:\/\/...）
  for (const m of html.matchAll(/https?:\\\/\\\/[^\s"'<>]+?\.m3u8(?:[?#][^\s"'<>]*)?/gi)) addConfirmed(unescUrl(m[0]), 'regex-ext-esc');
  for (const m of html.matchAll(/https?:\\\/\\\/[^\s"'<>]+?\.mp4(?:[?#][^\s"'<>]*)?/gi)) addConfirmed(unescUrl(m[0]), 'regex-ext-esc');
  for (const m of html.matchAll(/https?:\\\/\\\/[^\s"'<>]+?\.mpd(?:[?#][^\s"'<>]*)?/gi)) addConfirmed(unescUrl(m[0]), 'regex-ext-esc');

  // 1.6 iframe src 收集
  for (const m of html.matchAll(/<iframe[^>]+\bsrc=["']([^"']+)["']/gi)) {
    try {
      const resolved = new URL(m[1], baseUrl).href;
      const p = new URL(resolved);
      if (['http:', 'https:'].includes(p.protocol) && iframeSrcs.length < 3) {
        iframeSrcs.push(resolved);
      }
    } catch { /* skip */ }
  }

  // 高置信可疑排在前面（优先 HEAD 验证）
  const mergedSuspicious = [...suspiciousPriority, ...suspicious];
  return { confirmed, suspicious: mergedSuspicious, iframeSrcs };
}

// ---- Script 内容提取 ----

function extractJsonBlock(text, addConfirmed, addSuspiciousPriority) {
  try {
    const obj = JSON.parse(text);
    const urls = [], susp = [];
    collectUrlsFromObject(obj, urls, susp);
    for (const u of urls) addConfirmed(unescUrl(u), 'script-json-block');
    for (const u of susp) addSuspiciousPriority(unescUrl(u));
  } catch {
    // 解析失败时走正则兜底
    const keyRe = new RegExp(`"(?:${VIDEO_KEY_PAT})":\\s*"(https?:[^"]{10,})"`, 'gi');
    for (const m of text.matchAll(keyRe)) addSuspiciousPriority(unescUrl(m[1]));
  }
}

/** JSON-LD VideoObject：优先提取 contentUrl / embedUrl */
function extractJsonLd(text, addConfirmed, addSuspiciousPriority) {
  let obj;
  try { obj = JSON.parse(text); } catch { return; }

  const visit = (node, depth = 0) => {
    if (depth > 8 || !node) return;
    if (Array.isArray(node)) { node.forEach(n => visit(n, depth + 1)); return; }
    if (typeof node !== 'object') return;

    const type = node['@type'];
    const isVideo = type === 'VideoObject' || (Array.isArray(type) && type.includes('VideoObject'));
    if (isVideo || node.contentUrl || node.embedUrl) {
      for (const key of ['contentUrl', 'embedUrl', 'url']) {
        const v = node[key];
        if (typeof v === 'string' && /^https?:\/\//.test(v)) {
          const u = unescUrl(v);
          if (detectVideoType(u) !== 'unknown') addConfirmed(u, 'json-ld');
          else if (!NON_VIDEO_EXT.test(u)) addSuspiciousPriority(u);
        }
      }
    }
    Object.values(node).forEach(v => { if (v && typeof v === 'object') visit(v, depth + 1); });
  };
  visit(obj);
}

/** 已知播放器特征识别 — 命中率高于通用正则 */
function extractKnownPlayers(html, addConfirmed, addSuspiciousPriority) {
  // JW Player: jwplayer().setup({ file: "..." }) / sources:[{file:"..."}]
  for (const m of html.matchAll(/\bfile\s*:\s*["'](https?:[^"']{10,})["']/gi)) {
    const u = unescUrl(m[1]);
    if (detectVideoType(u) !== 'unknown') addConfirmed(u, 'player-jwplayer');
    else addSuspiciousPriority(u);
  }

  // DPlayer: new DPlayer({ video: { url: "..." } })
  for (const m of html.matchAll(/new\s+DPlayer\s*\(\s*\{[\s\S]{0,500}?\burl\s*:\s*["'](https?:[^"']{10,})["']/gi)) {
    addConfirmed(unescUrl(m[1]), 'player-dplayer');
  }

  // ArtPlayer: new Artplayer({ url: "..." })
  for (const m of html.matchAll(/new\s+Artplayer\s*\(\s*\{[\s\S]{0,500}?\burl\s*:\s*["'](https?:[^"']{10,})["']/gi)) {
    addConfirmed(unescUrl(m[1]), 'player-artplayer');
  }

  // Video.js: data-setup='{"sources":[{"src":"..."}]}'
  for (const m of html.matchAll(/data-setup=["'](\{[^"']+\})["']/gi)) {
    try {
      const obj = JSON.parse(m[1].replace(/&quot;/g, '"'));
      const urls = [], susp = [];
      collectUrlsFromObject(obj, urls, susp);
      for (const u of urls) addConfirmed(unescUrl(u), 'player-videojs');
      for (const u of susp) addSuspiciousPriority(unescUrl(u));
    } catch { /* skip */ }
  }

  // Plyr / 通用 sources: [{ src: "...", type: "..." }]
  for (const m of html.matchAll(/\bsources\s*:\s*\[\s*\{[\s\S]{0,300}?\bsrc\s*:\s*["'](https?:[^"']{10,})["']/gi)) {
    const u = unescUrl(m[1]);
    if (detectVideoType(u) !== 'unknown') addConfirmed(u, 'player-sources');
    else addSuspiciousPriority(u);
  }
}

function extractFromScript(script, addConfirmed, addSuspicious, addSuspiciousPriority) {
  // 模式 A：video 相关 JSON key + 带视频扩展名 URL（高置信直链）
  const patA = new RegExp(
    `"(?:${VIDEO_KEY_PAT})":\\s*"(https?:[^"]{10,}\\.(?:m3u8|mp4|mpd|flv|webm|ts)[^"]*)"`,
    'gi'
  );
  for (const m of script.matchAll(patA)) addConfirmed(unescUrl(m[1]), 'script-json-key');

  // 模式 A2：video 相关 JSON key + 任意 https URL → 高置信可疑（HEAD 验证）
  const patA2 = new RegExp(`"(?:${VIDEO_KEY_PAT})":\\s*"(https?:[^"]{10,})"`, 'gi');
  for (const m of script.matchAll(patA2)) {
    const u = unescUrl(m[1]);
    if (detectVideoType(u) === 'unknown') addSuspiciousPriority(u);
  }

  // 模式 B：window.__XXX__ 全局状态 JSON
  const patB = /window\.__[A-Z_]{2,}__\s*=\s*(\{[\s\S]{0,10000}?\})\s*;/g;
  for (const m of script.matchAll(patB)) {
    try {
      const obj = JSON.parse(m[1]);
      const urls = [], susp = [];
      collectUrlsFromObject(obj, urls, susp);
      for (const u of urls) addConfirmed(unescUrl(u), 'script-global-state');
      for (const u of susp) addSuspiciousPriority(unescUrl(u));
    } catch { /* skip */ }
  }

  // 模式 B2：现代框架全局变量（window.xxx = {...} / var/let/const xxx = {...}）
  const patB2 = /(?:window\.[a-zA-Z_$][a-zA-Z0-9_$]*|(?:var|let|const)\s+[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(\{[\s\S]{0,12000}?\})\s*;/g;
  for (const m of script.matchAll(patB2)) {
    try {
      const obj = JSON.parse(m[1]);
      const urls = [], susp = [];
      collectUrlsFromObject(obj, urls, susp);
      for (const u of urls) addConfirmed(unescUrl(u), 'script-global-state');
      for (const u of susp) addSuspiciousPriority(unescUrl(u));
    } catch { /* skip */ }
  }

  // 模式 C：JS 变量赋值（支持反引号模板字符串）
  const patC = /(?:url|src|file|source|video|stream|playUrl|videoUrl|hlsUrl|m3u8Url|play_url|hls_url)\s*[:=]\s*["'`](https?:\/\/[^"'`\s]{10,})["'`]/gi;
  for (const m of script.matchAll(patC)) addConfirmed(unescUrl(m[1]), 'script-var');

  // 模式 D：JSON.parse('...')
  const patD = /JSON\.parse\(["'`]([\s\S]{0,2000}?)["'`]\)/g;
  for (const m of script.matchAll(patD)) {
    try {
      const obj = JSON.parse(m[1]);
      const urls = [], susp = [];
      collectUrlsFromObject(obj, urls, susp);
      for (const u of urls) addConfirmed(unescUrl(u), 'script-json-parse');
      for (const u of susp) addSuspiciousPriority(unescUrl(u));
    } catch { /* skip */ }
  }

  // 模式 E：atob / base64 解码
  const patE = /atob\(["'`]([A-Za-z0-9+/=]{20,})["'`]\)/g;
  for (const m of script.matchAll(patE)) {
    try {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8');
      if (/^https?:\/\//.test(decoded)) {
        if (detectVideoType(decoded) !== 'unknown') addConfirmed(decoded, 'script-base64');
        else addSuspiciousPriority(decoded);
      }
    } catch { /* skip */ }
  }

  // 模式 F：裸 URL（无扩展名但含视频关键词 → 普通可疑）
  for (const m of script.matchAll(/https?:\/\/[^\s"'`<>\\]{10,}/g)) {
    const u = m[0].replace(/['"`,;)}\]]+$/, '');
    if (detectVideoType(u) === 'unknown') addSuspicious(u);
  }
}

function collectUrlsFromObject(obj, confirmed, suspicious = [], depth = 0) {
  if (depth > 8) return;
  if (typeof obj === 'string') {
    if (/^https?:\/\/.{10,}/.test(obj)) {
      if (detectVideoType(obj) !== 'unknown') confirmed.push(obj);
      else if (!NON_VIDEO_EXT.test(obj)) suspicious.push(obj);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach(v => collectUrlsFromObject(v, confirmed, suspicious, depth + 1));
    return;
  }
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(v => collectUrlsFromObject(v, confirmed, suspicious, depth + 1));
  }
}

// ---- Layer 2：有限额外请求 ----

async function runLayer2(layer1, startTime, pageUrl) {
  if (Date.now() - startTime > TOTAL_BUDGET_MS - 3_000) return [];

  const extra = [];

  // 2.1 iframe 跟进
  const iframesToFetch = layer1.iframeSrcs.slice(0, MAX_IFRAMES);
  if (iframesToFetch.length > 0) {
    const iframeResults = await Promise.allSettled(
      iframesToFetch.map(async (iframeUrl) => {
        const html = await fetchPage(iframeUrl);
        const l1 = extractLayer1(html, iframeUrl);
        return l1.confirmed.map(s => ({ ...s, from: s.from + '/iframe', score: s.score - 1 }));
      })
    );
    for (const r of iframeResults) {
      if (r.status === 'fulfilled') extra.push(...r.value);
    }
  }

  // 2.2 可疑 URL HEAD 验证（高置信可疑排前面，最多 8 个，带 Referer 绕过防盗链）
  if (Date.now() - startTime < TOTAL_BUDGET_MS - 2_000) {
    const toCheck = layer1.suspicious.slice(0, MAX_HEAD_CHECKS);
    const headResults = await Promise.allSettled(toCheck.map((u) => headCheck(u, pageUrl)));
    for (const r of headResults) {
      if (r.status === 'fulfilled' && r.value) {
        const { url, contentType } = r.value;
        const type = detectTypeFromContentType(contentType);
        if (type) {
          extra.push({ url, type, from: 'head-verified', score: scoreSource(url, type, 'head-verified') + 3 });
        }
      }
    }
  }

  return extra;
}

async function headCheck(url, referer) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve(null); }
    const lib = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
    };
    // 防盗链：很多 CDN 校验 Referer 必须来自来源页
    if (referer) {
      headers.Referer = referer;
      try { headers.Origin = new URL(referer).origin; } catch { /* skip */ }
    }

    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'HEAD',
      headers,
      timeout: HEAD_TIMEOUT_MS,
    }, (resp) => {
      resp.resume();
      const ct = resp.headers['content-type'] || '';
      if (VIDEO_CONTENT_TYPES.test(ct)) {
        resolve({ url, contentType: ct });
      } else {
        resolve(null);
      }
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ---- 合并、评分、去重 ----

function mergeAndScore(sources) {
  const seen = new Map();
  for (const s of sources) {
    if (!seen.has(s.url) || seen.get(s.url).score < s.score) {
      seen.set(s.url, s);
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

// ---- 工具函数 ----

/** 反转义 JSON 序列化的 URL（\/ → /，\uXXXX → char） */
function unescUrl(url) {
  try {
    return url
      .replace(/\\\//g, '/')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  } catch { return url; }
}

function tryResolve(rawUrl, baseUrl) {
  const unescaped = unescUrl(rawUrl.trim());
  try {
    return new URL(unescaped, baseUrl).href;
  } catch { return null; }
}

function detectVideoType(url) {
  const u = url.split('?')[0].split('#')[0].toLowerCase();
  if (u.endsWith('.mpd')) return 'mpd';
  if (u.endsWith('.m3u8') || u.endsWith('.m3u')) return 'm3u8';
  if (u.endsWith('.mp4') || u.endsWith('.m4v')) return 'mp4';
  if (u.endsWith('.flv')) return 'flv';
  if (u.endsWith('.webm')) return 'webm';
  if (u.endsWith('.ogg') || u.endsWith('.ogv')) return 'ogg';
  if (u.endsWith('.mov')) return 'mov';
  if (u.endsWith('.mkv')) return 'mkv';
  if (u.endsWith('.avi')) return 'avi';
  if (u.endsWith('.ts')) return 'ts';
  return 'unknown';
}

function detectTypeFromContentType(ct) {
  if (/mpegurl|m3u/i.test(ct)) return 'm3u8';
  if (/dash\+xml/i.test(ct)) return 'mpd';
  if (/^video\/mp4/i.test(ct)) return 'mp4';
  if (/^video\/webm/i.test(ct)) return 'webm';
  if (/^video\//i.test(ct)) return 'mp4';
  return null;
}

function scoreSource(url, type, from = '') {
  let s = 0;
  if (type === 'm3u8') s += 10;
  else if (type === 'mpd') s += 9;
  else if (type === 'mp4') s += 8;
  else if (type === 'webm') s += 6;
  else if (type === 'flv') s += 5;
  else if (['ogg', 'mov', 'mkv', 'avi', 'ts'].includes(type)) s += 4;

  if (/1080/i.test(url)) s += 3;
  else if (/720/i.test(url)) s += 2;
  if (/\bhd\b/i.test(url)) s += 1;
  if (/preview|thumb|poster|cover|avatar/i.test(url)) s -= 5;

  if (from.includes('script-json-key')) s += 2;
  if (from.includes('script-json-block')) s += 2;
  if (from.includes('head-verified')) s += 3;
  if (from.includes('json-ld')) s += 2;
  if (from.includes('next-data')) s += 2;
  if (from.includes('player-')) s += 2;
  if (from.includes('meta-og')) s += 1;
  if (from.includes('dom-')) s += 1;
  if (from.includes('/iframe')) s -= 1;

  return s;
}
