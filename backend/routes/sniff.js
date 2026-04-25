/**
 * 嗅探路由 — 从网页提取视频源
 */
import { Router } from 'express';
import { FETCH_TIMEOUT_MS, MAX_PAGE_SIZE_BYTES } from '../config.js';

export function createSniffRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: '缺少 url 参数' });

    try {
      const parsed = new URL(url);

      // SSRF 防护
      if (isInternalHost(parsed.hostname)) {
        return res.status(403).json({ error: '不允许访问内网地址' });
      }

      const html = await fetchPage(url);
      const sources = extractVideoSources(html, url);
      res.json({ url, sources });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ---- helpers ----

const INTERNAL_PATTERNS = [
  /^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^::1$/,
  /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./,
  /^fc00:/i, /^fe80:/i,
];

function isInternalHost(hostname) {
  return INTERNAL_PATTERNS.some((p) => p.test(hostname));
}

function fetchPage(url, redirectCount = 0) {
  if (redirectCount > 1) return Promise.reject(new Error('重定向次数过多'));

  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return reject(new Error('无效URL')); }

    if (isInternalHost(parsedUrl.hostname)) return reject(new Error('重定向目标为内网地址'));

    const lib = parsedUrl.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QingyunboSniffer/2.0)',
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

function extractVideoSources(html, baseUrl) {
  const sources = [];
  const seen = new Set();

  function add(rawUrl, from) {
    try { rawUrl = new URL(rawUrl, baseUrl).href; } catch { return; }
    if (seen.has(rawUrl)) return;
    seen.add(rawUrl);
    const type = detectVideoType(rawUrl);
    if (type === 'unknown') return;
    sources.push({ url: rawUrl, type, from, score: scoreSource(rawUrl, type) });
  }

  for (const m of html.matchAll(/<video[^>]+\bsrc=["']([^"']+)["']/gi)) add(m[1], 'dom-video');
  for (const m of html.matchAll(/<source[^>]+\bsrc=["']([^"']+)["']/gi)) add(m[1], 'dom-source');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.m3u8(?:[?#][^\s"'<>\\]*)?/gi)) add(m[0], 'regex-m3u8');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.mp4(?:[?#][^\s"'<>\\]*)?/gi)) add(m[0], 'regex-mp4');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.webm(?:[?#][^\s"'<>\\]*)?/gi)) add(m[0], 'regex-webm');

  sources.sort((a, b) => b.score - a.score);
  return sources.slice(0, 10);
}

function detectVideoType(url) {
  if (/\.m3u8/i.test(url)) return 'm3u8';
  if (/\.mp4/i.test(url)) return 'mp4';
  if (/\.flv/i.test(url)) return 'flv';
  if (/\.webm/i.test(url)) return 'webm';
  if (/\.ts\b/i.test(url)) return 'ts';
  return 'unknown';
}

function scoreSource(url, type) {
  let s = 0;
  if (type === 'm3u8') s += 10;
  else if (type === 'mp4') s += 8;
  else if (type === 'webm') s += 6;
  else if (type === 'flv') s += 5;
  if (/1080/i.test(url)) s += 3;
  else if (/720/i.test(url)) s += 2;
  if (/\bhd\b/i.test(url)) s += 1;
  if (/preview|thumb|poster/i.test(url)) s -= 5;
  return s;
}
