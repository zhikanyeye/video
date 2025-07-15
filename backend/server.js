const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// 数据库初始化
const db = new sqlite3.Database('playlists.db');

// 创建播放列表表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        videos TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// API 路由
app.get('/api/playlists', (req, res) => {
    db.all('SELECT * FROM playlists ORDER BY updated_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/playlists', (req, res) => {
    const { name, videos } = req.body;
    const videosJson = JSON.stringify(videos);
    
    db.run('INSERT INTO playlists (name, videos) VALUES (?, ?)', [name, videosJson], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, name, videos });
    });
});

app.get('/api/playlists/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM playlists WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Playlist not found' });
            return;
        }
        res.json(row);
    });
});

app.put('/api/playlists/:id', (req, res) => {
    const { id } = req.params;
    const { name, videos } = req.body;
    const videosJson = JSON.stringify(videos);
    
    db.run('UPDATE playlists SET name = ?, videos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
           [name, videosJson, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Playlist not found' });
            return;
        }
        res.json({ id, name, videos });
    });
});

app.delete('/api/playlists/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM playlists WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Playlist not found' });
            return;
        }
        res.json({ message: 'Playlist deleted successfully' });
    });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`青云播后端服务已启动，端口: ${PORT}`);
    console.log(`访问地址: http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error('关闭数据库时发生错误:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});