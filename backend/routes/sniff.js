/**
 * 嗅探路由 — 分层提取视频源
 * Layer 1: DOM / data-* / script 内容 / iframe 收集（无额外请求）
 * Layer 2: iframe 跟进（最多 2 个）+ 可疑 URL HEAD 验证（最多 5 个）
 * 总请求数 ≤ 8，总超时预算 20s
 */
import { Router } from 'express';
import http from 'http';
import https from 'https';
import { FETCH_TIMEOUT_MS, MAX_PAGE_SIZE_BYTES } from '../config.js';
import { isSafeFetchUrl } from '../utils/safe-url.js';

const HEAD_TIMEOUT_MS = 4_000;
const MAX_IFRAMES = 2;
const MAX_HEAD_CHECKS = 5;
const TOTAL_BUDGET_MS = 20_000;

const VIDEO_PATH_KEYWORDS = /\b(video|stream|play|media|hls|dash|manifest|m3u8|mp4|flv|vod|live|segment|chunk|source)\b/i;
const VIDEO_CONTENT_TYPES = /^(video\/|application\/x-mpegurl|application\/vnd\.apple\.mpegurl|application\/dash\+xml)/i;
const NON_VIDEO_EXT = /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot|json|xml|html|htm)(\?|$)/i;

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
      const layer2Sources = await runLayer2(layer1, startTime);

      const allSources = mergeAndScore([...layer1.confirmed, ...layer2Sources]);
      res.json({
        url,
        sources: allSources.slice(0, 15),
        meta: {
          layer1Count: layer1.confirmed.length,
          layer2Count: layer2Sources.length,
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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
  const suspicious = [];
  const iframeSrcs = [];
  const seenConfirmed = new Set();
  const seenSuspicious = new Set();

  function addConfirmed(rawUrl, from) {
    let resolved;
    try { resolved = new URL(rawUrl, baseUrl).href; } catch { return; }
    if (seenConfirmed.has(resolved)) return;
    seenConfirmed.add(resolved);
    const type = detectVideoType(resolved);
    if (type === 'unknown') return;
    confirmed.push({ url: resolved, type, from, score: scoreSource(resolved, type, from) });
  }

  function addSuspicious(rawUrl) {
    let resolved;
    try { resolved = new URL(rawUrl, baseUrl).href; } catch { return; }
    if (seenConfirmed.has(resolved) || seenSuspicious.has(resolved)) return;
    if (NON_VIDEO_EXT.test(resolved)) return;
    if (!VIDEO_PATH_KEYWORDS.test(resolved)) return;
    seenSuspicious.add(resolved);
    suspicious.push(resolved);
  }

  // 1.1 DOM 标签
  for (const m of html.matchAll(/<(?:video|source)[^>]+\bsrc=["']([^"']+)["']/gi)) addConfirmed(m[1], 'dom-src');
  for (const m of html.matchAll(/<(?:video|source)[^>]+\bdata-src=["']([^"']+)["']/gi)) addConfirmed(m[1], 'dom-data-src');
  for (const m of html.matchAll(/<a[^>]+\bhref=["']([^"']+\.(?:mp4|m3u8|mpd|flv|webm|ts)(?:[?#][^"']*)?)["']/gi)) addConfirmed(m[1], 'dom-a');

  // 1.2 data-* 属性
  for (const m of html.matchAll(/\bdata-[a-z-]+=["'](https?:\/\/[^"']{10,})["']/gi)) addConfirmed(m[1], 'data-attr');

  // 1.3 script 标签内容
  for (const m of html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/gi)) {
    const hasSrc = /\bsrc=["'][^"']+["']/.test(m[0].slice(0, 200));
    if (hasSrc) continue;
    const script = m[1].slice(0, 50_000);
    extractFromScript(script, baseUrl, addConfirmed, addSuspicious);
  }

  // 1.4 全文裸 URL（扩展名匹配）
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.mpd(?:[?#][^\s"'<>\\]*)?/gi)) addConfirmed(m[0], 'regex-ext');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.m3u8(?:[?#][^\s"'<>\\]*)?/gi)) addConfirmed(m[0], 'regex-ext');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.mp4(?:[?#][^\s"'<>\\]*)?/gi)) addConfirmed(m[0], 'regex-ext');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.flv(?:[?#][^\s"'<>\\]*)?/gi)) addConfirmed(m[0], 'regex-ext');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.webm(?:[?#][^\s"'<>\\]*)?/gi)) addConfirmed(m[0], 'regex-ext');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.(?:ogg|ogv|mov|mkv|avi)(?:[?#][^\s"'<>\\]*)?/gi)) addConfirmed(m[0], 'regex-ext');

  // 1.5 iframe src 收集
  for (const m of html.matchAll(/<iframe[^>]+\bsrc=["']([^"']+)["']/gi)) {
    try {
      const resolved = new URL(m[1], baseUrl).href;
      const p = new URL(resolved);
      if (['http:', 'https:'].includes(p.protocol) && iframeSrcs.length < 3) {
        iframeSrcs.push(resolved);
      }
    } catch { /* skip */ }
  }

  return { confirmed, suspicious, iframeSrcs };
}

function extractFromScript(script, baseUrl, addConfirmed, addSuspicious) {
  // 模式 A：JSON key + 视频扩展名 URL（高置信度）
  const patA = /"(?:url|src|file|source|video|stream|hls|m3u8|mp4|path|link|playUrl|videoUrl|streamUrl)":\s*"(https?:\/\/[^"]{10,}\.(?:m3u8|mp4|mpd|flv|webm|ts)[^"]*)"/gi;
  for (const m of script.matchAll(patA)) addConfirmed(m[1], 'script-json-key');

  // 模式 B：window.__XXX__ 全局状态对象
  const patB = /window\.__[A-Z_]{2,}__\s*=\s*(\{[\s\S]{0,8000}?\});/g;
  for (const m of script.matchAll(patB)) {
    try {
      const obj = JSON.parse(m[1]);
      const urls = [];
      collectUrlsFromObject(obj, urls);
      for (const u of urls) addConfirmed(u, 'script-global-state');
    } catch { /* skip */ }
  }

  // 模式 C：JS 变量赋值
  const patC = /(?:url|src|file|source|video|stream|playUrl|videoUrl)\s*[:=]\s*["'`](https?:\/\/[^"'`\s]{10,})["'`]/gi;
  for (const m of script.matchAll(patC)) addConfirmed(m[1], 'script-var');

  // 模式 D：JSON.parse 字符串
  const patD = /JSON\.parse\(["'`]([\s\S]{0,2000}?)["'`]\)/g;
  for (const m of script.matchAll(patD)) {
    try {
      const obj = JSON.parse(m[1]);
      const urls = [];
      collectUrlsFromObject(obj, urls);
      for (const u of urls) addConfirmed(u, 'script-json-parse');
    } catch { /* skip */ }
  }

  // 可疑 URL（无扩展名但含视频关键词）
  for (const m of script.matchAll(/https?:\/\/[^\s"'`<>\\]{10,}/g)) {
    const u = m[0].replace(/['"`,;)}\]]+$/, '');
    if (detectVideoType(u) === 'unknown') addSuspicious(u);
  }
}

function collectUrlsFromObject(obj, results, depth = 0) {
  if (depth > 6) return;
  if (typeof obj === 'string') {
    if (/^https?:\/\/.{10,}/.test(obj) && detectVideoType(obj) !== 'unknown') results.push(obj);
    return;
  }
  if (Array.isArray(obj)) { obj.forEach(v => collectUrlsFromObject(v, results, depth + 1)); return; }
  if (obj && typeof obj === 'object') Object.values(obj).forEach(v => collectUrlsFromObject(v, results, depth + 1));
}

// ---- Layer 2：有限额外请求 ----

async function runLayer2(layer1, startTime) {
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

  // 2.2 可疑 URL HEAD 验证
  if (Date.now() - startTime < TOTAL_BUDGET_MS - 2_000) {
    const toCheck = layer1.suspicious.slice(0, MAX_HEAD_CHECKS);
    const headResults = await Promise.allSettled(toCheck.map(headCheck));
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

async function headCheck(url) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve(null); }
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QingyunboProbe/2.0)', Accept: '*/*' },
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
  if (/preview|thumb|poster|cover/i.test(url)) s -= 5;

  if (from.includes('script-json-key')) s += 1;
  if (from.includes('dom-')) s += 1;
  if (from.includes('/iframe')) s -= 1;

  return s;
}
