const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8090;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// 数据库初始化
const db = new sqlite3.Database('playlists.db');

// 创建表
db.run(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    videos TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0
  )
`);

// API路由

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: '青云播分享服务',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 创建播放列表分享
app.post('/api/share', (req, res) => {
  const { title, description, videos } = req.body;
  
  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    return res.status(400).json({ error: '视频列表不能为空' });
  }
  
  const shareId = uuidv4().replace(/-/g, '').substring(0, 12); // 生成12位短ID
  const playlistTitle = title || `播放列表 - ${new Date().toLocaleString()}`;
  const playlistDescription = description || '';
  
  const stmt = db.prepare(`
    INSERT INTO playlists (id, title, description, videos)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run([shareId, playlistTitle, playlistDescription, JSON.stringify(videos)], function(err) {
    if (err) {
      console.error('数据库错误:', err);
      return res.status(500).json({ error: '创建分享失败' });
    }
    
    const shareUrl = `${req.protocol}://${req.get('host')}/player.html?share=${shareId}`;
    
    res.json({
      shareId: shareId,
      shareUrl: shareUrl,
      title: playlistTitle,
      videoCount: videos.length
    });
  });
  
  stmt.finalize();
});

// 获取播放列表数据
app.get('/api/playlist/:shareId', (req, res) => {
  const { shareId } = req.params;
  
  db.get('SELECT * FROM playlists WHERE id = ?', [shareId], (err, row) => {
    if (err) {
      console.error('数据库错误:', err);
      return res.status(500).json({ error: '获取播放列表失败' });
    }
    
    if (!row) {
      return res.status(404).json({ error: '播放列表不存在' });
    }
    
    // 增加查看次数
    db.run('UPDATE playlists SET view_count = view_count + 1 WHERE id = ?', [shareId]);
    
    try {
      const videos = JSON.parse(row.videos);
      res.json({
        id: row.id,
        title: row.title,
        description: row.description,
        videos: videos,
        created: row.created_at,
        viewCount: row.view_count + 1
      });
    } catch (parseError) {
      console.error('解析视频数据失败:', parseError);
      res.status(500).json({ error: '数据格式错误' });
    }
  });
});

// 获取播放列表统计信息
app.get('/api/stats/:shareId', (req, res) => {
  const { shareId } = req.params;
  
  db.get('SELECT title, view_count, created_at FROM playlists WHERE id = ?', [shareId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '获取统计信息失败' });
    }
    
    if (!row) {
      return res.status(404).json({ error: '播放列表不存在' });
    }
    
    res.json({
      title: row.title,
      viewCount: row.view_count,
      created: row.created_at
    });
  });
});

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 播放器页面路由
app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../player.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎥 青云播分享服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📊 数据库: SQLite (playlists.db)`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接失败:', err);
    } else {
      console.log('数据库连接已关闭');
    }
    process.exit(0);
  });
});
