/**
 * CORS 中间件
 */
import { CORS_ORIGINS, DEFAULT_ORIGINS } from '../config.js';

const allowedOrigins = new Set([...DEFAULT_ORIGINS, ...CORS_ORIGINS]);
const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const allowAllOrigins = process.env.CORS_ALLOW_ALL !== 'false';

function isAllowedOrigin(origin) {
  return allowAllOrigins || allowedOrigins.has(origin) || LOCAL_ORIGIN_RE.test(origin);
}

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (!origin || isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}
