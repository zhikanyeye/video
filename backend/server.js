/**
 * 青云播后端 v2.0 — 模块化重构
 */
import express from 'express';
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

const playlistStorePath = path.join(__dirname, 'playlists.json');

// 路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'qingyunbo-backend' });
});
app.use('/api/playlists', createPlaylistRouter(playlistStorePath));
app.use('/api/sniff', createSniffRouter());

// 启动
const server = app.listen(PORT, () => {
  console.log(`青云播后端服务已启动，端口: ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => process.exit(0));
});
