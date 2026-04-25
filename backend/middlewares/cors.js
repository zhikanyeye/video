/**
 * CORS 中间件
 */
import { CORS_ORIGINS, DEFAULT_ORIGINS } from '../config.js';

const allowedOrigins = CORS_ORIGINS.length ? CORS_ORIGINS : DEFAULT_ORIGINS;

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}
