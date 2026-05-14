/**
 * HLS playback proxy.
 *
 * Browsers require CORS for hls.js playlist and segment requests. Many video
 * hosts either omit CORS headers or return Access-Control-Allow-Origin: null,
 * so the backend fetches the media and exposes it from our own origin.
 */
import { Router } from 'express';
import http from 'http';
import https from 'https';
import { FETCH_TIMEOUT_MS } from '../config.js';
import { isSafeFetchUrl } from '../utils/safe-url.js';

const MAX_REDIRECTS = 4;
const PLAYLIST_CONTENT_RE = /(?:mpegurl|vnd\.apple\.mpegurl|x-mpegurl)/i;
const PLAYLIST_PATH_RE = /\.m3u8(?:[?#]|$)/i;

export function createHlsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url) return res.status(400).json({ error: '缺少 url 参数' });

    try {
      if (!(await isSafeFetchUrl(url))) {
        return res.status(403).json({ error: '不允许访问内网地址' });
      }

      const upstream = await requestUpstream(url, {
        range: req.headers.range,
      });

      if (!(await isSafeFetchUrl(upstream.finalUrl))) {
        upstream.response.resume();
        return res.status(403).json({ error: '不允许访问内网地址' });
      }

      const contentType = upstream.response.headers['content-type'] || '';
      const isPlaylist = PLAYLIST_CONTENT_RE.test(contentType) || PLAYLIST_PATH_RE.test(upstream.finalUrl);

      if (isPlaylist) {
        await sendRewrittenPlaylist(req, res, upstream);
        return;
      }

      streamMedia(res, upstream);
    } catch (err) {
      if (!res.headersSent) res.status(502).json({ error: err.message || 'HLS 代理请求失败' });
    }
  });

  return router;
}

async function sendRewrittenPlaylist(req, res, upstream) {
  const body = await readText(upstream.response);
  const rewritten = rewritePlaylist(body, upstream.finalUrl, req);

  res.status(upstream.response.statusCode || 200);
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.setHeader('Cache-Control', upstream.response.headers['cache-control'] || 'no-cache');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.send(rewritten);
}

function streamMedia(res, upstream) {
  const { response } = upstream;
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'etag',
    'last-modified',
  ];

  res.status(response.statusCode || 200);
  for (const header of passthroughHeaders) {
    const value = response.headers[header];
    if (value) res.setHeader(header, value);
  }
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  response.pipe(res);
}

export function rewritePlaylist(content, baseUrl, req) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return rewriteUriAttributes(line, baseUrl, req);
      }

      return toProxyUrl(new URL(trimmed, baseUrl).href, req);
    })
    .join('\n');
}

function rewriteUriAttributes(line, baseUrl, req) {
  return line.replace(/URI="([^"]+)"/g, (_match, value) => {
    const absoluteUrl = new URL(value, baseUrl).href;
    return `URI="${toProxyUrl(absoluteUrl, req)}"`;
  });
}

function toProxyUrl(targetUrl, req) {
  const basePath = req.baseUrl || '/api/hls';
  return `${basePath}?url=${encodeURIComponent(targetUrl)}`;
}

function requestUpstream(url, { range } = {}, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) throw new Error('重定向次数过多');

  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return reject(new Error('无效URL')); }

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      Accept: '*/*',
      Referer: parsedUrl.origin + '/',
    };
    if (range) headers.Range = range;

    const req = lib.request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers,
      timeout: FETCH_TIMEOUT_MS,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, url).href;
        response.resume();
        isSafeFetchUrl(nextUrl)
          .then((safe) => {
            if (!safe) throw new Error('不允许访问内网地址');
            return requestUpstream(nextUrl, { range }, redirectCount + 1);
          })
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode >= 400) {
        response.resume();
        reject(new Error(`源站返回 HTTP ${response.statusCode}`));
        return;
      }

      resolve({ response, finalUrl: url });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.end();
  });
}

function readText(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
