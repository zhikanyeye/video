/**
 * 播放列表路由
 *
 * 使用 JSON 文件保存，避免 sqlite3 原生依赖在 Render 上触发 glibc 兼容问题。
 */
import { Router } from 'express';
import fs from 'fs/promises';

export function createPlaylistRouter(storePath) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const store = await readStore(storePath);
      res.json([...store.playlists].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    const { name, videos } = req.body;
    const validationError = validatePlaylistInput(name, videos);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
      const store = await readStore(storePath);
      const now = new Date().toISOString();
      const playlist = {
        id: store.nextId,
        name: name.trim(),
        videos,
        created_at: now,
        updated_at: now,
      };
      store.nextId += 1;
      store.playlists.push(playlist);
      await writeStore(storePath, store);
      res.json(playlist);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const store = await readStore(storePath);
      const playlist = store.playlists.find((item) => item.id === id);
      if (!playlist) return res.status(404).json({ error: '播放列表不存在' });
      res.json(playlist);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    const { name, videos } = req.body;
    const validationError = validatePlaylistInput(name, videos);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
      const id = Number(req.params.id);
      const store = await readStore(storePath);
      const index = store.playlists.findIndex((item) => item.id === id);
      if (index === -1) return res.status(404).json({ error: '播放列表不存在' });

      store.playlists[index] = {
        ...store.playlists[index],
        name: name.trim(),
        videos,
        updated_at: new Date().toISOString(),
      };
      await writeStore(storePath, store);
      res.json(store.playlists[index]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const store = await readStore(storePath);
      const nextPlaylists = store.playlists.filter((item) => item.id !== id);
      if (nextPlaylists.length === store.playlists.length) {
        return res.status(404).json({ error: '播放列表不存在' });
      }

      store.playlists = nextPlaylists;
      await writeStore(storePath, store);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function validatePlaylistInput(name, videos) {
  if (typeof name !== 'string' || !name.trim()) return '播放列表名称不能为空';
  if (!Array.isArray(videos)) return 'videos 必须是数组';
  return null;
}

async function readStore(storePath) {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch (err) {
    if (err.code === 'ENOENT') return { nextId: 1, playlists: [] };
    throw err;
  }
}

async function writeStore(storePath, store) {
  await fs.writeFile(storePath, JSON.stringify(normalizeStore(store), null, 2), 'utf8');
}

function normalizeStore(store) {
  const playlists = Array.isArray(store?.playlists) ? store.playlists : [];
  const maxId = playlists.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
  const nextId = Math.max(Number(store?.nextId) || 1, maxId + 1);
  return { nextId, playlists };
}
