/**
 * 环境配置
 */
import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3000;

export const CORS_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'https://zhikanyeye.github.io',
  'https://yunvideo.con.tc',
];

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_PAGE_SIZE_BYTES = 2 * 1024 * 1024;
