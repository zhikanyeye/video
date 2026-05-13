/**
 * 播放列表路由
 */
import { Router } from 'express';

export function createPlaylistRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    db.all('SELECT * FROM playlists ORDER BY updated_at DESC', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(formatPlaylistRow));
    });
  });

  router.post('/', (req, res) => {
    const { name, videos } = req.body;
    const validationError = validatePlaylistInput(name, videos);
    if (validationError) return res.status(400).json({ error: validationError });

    db.run('INSERT INTO playlists (name, videos) VALUES (?, ?)', [name, JSON.stringify(videos)], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, videos });
    });
  });

  router.get('/:id', (req, res) => {
    db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: '播放列表不存在' });
      res.json(formatPlaylistRow(row));
    });
  });

  router.put('/:id', (req, res) => {
    const { name, videos } = req.body;
    const validationError = validatePlaylistInput(name, videos);
    if (validationError) return res.status(400).json({ error: validationError });

    db.run(
      'UPDATE playlists SET name = ?, videos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, JSON.stringify(videos), req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: '播放列表不存在' });
        res.json({ id: req.params.id, name, videos });
      }
    );
  });

  router.delete('/:id', (req, res) => {
    db.run('DELETE FROM playlists WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '播放列表不存在' });
      res.json({ success: true });
    });
  });

  return router;
}

function validatePlaylistInput(name, videos) {
  if (typeof name !== 'string' || !name.trim()) return '播放列表名称不能为空';
  if (!Array.isArray(videos)) return 'videos 必须是数组';
  return null;
}

function formatPlaylistRow(row) {
  return {
    ...row,
    videos: parseVideos(row.videos),
  };
}

function parseVideos(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
