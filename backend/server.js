/**
 * 青云播后端 v2.0 — 模块化重构
 */
import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './config.js';
import { corsMiddleware } from './middlewares/cors.js';
import { createPlaylistRouter } from './routes/playlists.js';
import { createSniffRouter } from './routes/sniff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 中间件
app.use(corsMiddleware);
app.use(express.json());

// 数据库
const dbPath = path.join(__dirname, 'playlists.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    videos TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// 路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'qingyunbo-backend' });
});
app.use('/api/playlists', createPlaylistRouter(db));
app.use('/api/sniff', createSniffRouter());

// 启动
const server = app.listen(PORT, () => {
  console.log(`青云播后端服务已启动，端口: ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close((err) => {
    if (err) console.error('关闭数据库时发生错误:', err.message);
    else console.log('数据库连接已关闭');
    process.exit(0);
  });
});
