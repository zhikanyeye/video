/**
 * 播放源检测 — 纯 HTTP header + M3U8 内容解析，无需 ffprobe
 */
import { Router } from 'express';
import http from 'http';
import https from 'https';
import { isSafeFetchUrl } from '../utils/safe-url.js';
import { FETCH_TIMEOUT_MS } from '../config.js';

const HEADER_TIMEOUT_MS = 10_000;
const M3U8_READ_BYTES = 32_768; // 最多读 32KB 用于解析 M3U8

export function createProbeRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: '缺少 url 参数' });

    try {
      if (!(await isSafeFetchUrl(url))) {
        return res.status(403).json({ error: '不允许访问内网地址' });
      }

      const headers = await probeHeaders(url);
      const m3u8 = isM3u8(headers, url) ? await parseM3u8(headers.finalUrl || url) : null;

      const result = { url, headers, m3u8, diagnosis: diagnose(headers, m3u8) };
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ---- HTTP header 探测 ----

async function probeHeaders(url) {
  let result = await requestHeaders(url, 'HEAD');
  // 有些服务器不支持 HEAD，降级到 GET range
  if (!result.statusCode || [405, 403, 501].includes(result.statusCode)) {
    result = await requestHeaders(url, 'GET', { Range: 'bytes=0-0' });
  }
  return normalizeHeaders(result);
}

function requestHeaders(url, method, extraHeaders = {}, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('重定向次数过多');
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('无效 URL')); }
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QingyunboProbe/2.0)',
        Accept: '*/*',
        ...extraHeaders,
      },
      timeout: Math.min(FETCH_TIMEOUT_MS, HEADER_TIMEOUT_MS),
    }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        const next = new URL(resp.headers.location, url).href;
        resp.resume();
        requestHeaders(next, method, extraHeaders, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      resp.resume();
      resolve({ statusCode: resp.statusCode, headers: resp.headers, finalUrl: url });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.end();
  });
}

function normalizeHeaders(result) {
  const h = result.headers || {};
  return {
    statusCode: result.statusCode,
    finalUrl: result.finalUrl,
    contentType: h['content-type'] || '',
    contentLength: parseInteger(h['content-length']),
    acceptRanges: h['accept-ranges'] || '',
    contentRange: h['content-range'] || '',
    accessControlAllowOrigin: h['access-control-allow-origin'] || '',
    cacheControl: h['cache-control'] || '',
    server: h['server'] || '',
  };
}

// ---- M3U8 解析 ----

function isM3u8(headers, url) {
  const ct = headers.contentType.toLowerCase();
  if (ct.includes('mpegurl') || ct.includes('m3u')) return true;
  return /\.m3u8?(\?|$)/i.test(url);
}

function parseM3u8(url) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve(null); }
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QingyunboProbe/2.0)', Accept: '*/*' },
      timeout: HEADER_TIMEOUT_MS,
    }, (resp) => {
      let buf = '';
      let bytes = 0;
      resp.setEncoding('utf8');
      resp.on('data', (chunk) => {
        bytes += Buffer.byteLength(chunk);
        buf += chunk;
        if (bytes >= M3U8_READ_BYTES) req.destroy();
      });
      resp.on('end', () => resolve(analyzeM3u8(buf)));
      resp.on('error', () => resolve(null));
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function analyzeM3u8(text) {
  if (!text || !text.includes('#EXTM3U')) return null;

  const isMaster = text.includes('#EXT-X-STREAM-INF');
  const isLive = !text.includes('#EXT-X-ENDLIST');
  const hasEncryption = text.includes('#EXT-X-KEY');

  // 解析多码率
  const streams = [];
  const streamRe = /#EXT-X-STREAM-INF:([^\n]+)\n([^\n]+)/g;
  let m;
  while ((m = streamRe.exec(text)) !== null) {
    const attrs = parseM3u8Attrs(m[1]);
    streams.push({
      bandwidth: parseInteger(attrs.BANDWIDTH),
      resolution: attrs.RESOLUTION || null,
      codecs: attrs.CODECS || null,
      uri: m[2].trim(),
    });
  }

  // 估算分片数量
  const segmentCount = (text.match(/#EXTINF:/g) || []).length;

  return { isMaster, isLive, hasEncryption, streams, segmentCount };
}

function parseM3u8Attrs(str) {
  const result = {};
  const re = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    result[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return result;
}

// ---- 诊断 ----

function diagnose(headers, m3u8) {
  const warnings = [];
  const suggestions = [];
  const ct = headers.contentType.toLowerCase();

  // 命中"错对象"：用户把网页 URL 当成视频直链来检测
  const wrongTarget = (ct.includes('text/html') || ct.includes('application/xhtml')) && !m3u8;

  if (headers.statusCode && headers.statusCode >= 400) {
    warnings.push(`源站返回 HTTP ${headers.statusCode}，视频可能已失效`);
  }

  if (wrongTarget) {
    // 网页页面：CORS / Range / 服务器这些指标毫无意义，只给一条建议
    suggestions.push('当前链接是网页而不是视频直链。请改用"嗅探视频源"从页面中提取真正的视频地址');
  } else {
    if (!headers.acceptRanges && !headers.contentRange) {
      warnings.push('源站未声明 Range 支持，长视频拖动可能不稳定');
    }
    if (!headers.accessControlAllowOrigin) {
      warnings.push('源站未返回 CORS 头，跨域播放可能被浏览器拦截');
      suggestions.push('如果视频无法播放，可尝试开启播放器的 HLS 代理选项');
    }
    if (ct.includes('text/plain')) {
      warnings.push(`Content-Type 是 ${headers.contentType}，这可能不是视频文件`);
    }
  }

  if (m3u8) {
    if (m3u8.hasEncryption) {
      warnings.push('M3U8 包含加密分片（#EXT-X-KEY），需要密钥才能播放');
    }
    if (m3u8.isMaster && m3u8.streams.length > 0) {
      suggestions.push(`检测到 ${m3u8.streams.length} 个码率档位，播放器会自动选择最佳码率`);
    }
  }

  if (warnings.length === 0 && !wrongTarget) {
    suggestions.push('未发现明显兼容性问题，若仍无法播放请检查防盗链或浏览器控制台');
  }

  return {
    playableHint: wrongTarget ? 'wrong-target' : (warnings.length === 0 ? 'likely' : 'risky'),
    wrongTarget,
    warnings,
    suggestions,
  };
}

function parseInteger(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
