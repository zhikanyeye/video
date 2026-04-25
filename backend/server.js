const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS：仅允许本地开发和 GitHub Pages 生产域名
// 上线后请将 ALLOWED_ORIGINS 改为你实际的前端域名
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const DEFAULT_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'https://zhikanyeye.github.io'
];

const allowedOrigins = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;

app.use(cors({
    origin: function (origin, callback) {
        // 同源请求（如服务端直接渲染时）origin 为 undefined，允许通过
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS: 不允许的来源 ' + origin));
        }
    },
    credentials: true
}));
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

// ==================== 视频嗅探 API ====================

/** 嗅探时抓取页面的最大读取字节数（2 MB） */
const MAX_PAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** 抓取页面的超时时间（毫秒） */
const FETCH_TIMEOUT_MS = 8000;

/**
 * GET /api/sniff?url=<页面地址>
 * 抓取目标页面 HTML，提取可能的视频直链（mp4 / m3u8 等）并返回候选列表。
 * 内置 SSRF 防护、超时控制、最多跟一次重定向。
 */
app.get('/api/sniff', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ ok: false, error: '缺少 url 参数' });
    }

    // 解析并校验 URL
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (_) {
        return res.status(400).json({ ok: false, error: '无效的 URL 格式' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ ok: false, error: '仅支持 http/https 协议' });
    }

    // SSRF 防护：阻止访问内网地址
    const hostname = parsedUrl.hostname;
    if (isInternalHost(hostname)) {
        return res.status(400).json({ ok: false, error: '不允许访问内网地址' });
    }

    try {
        const html = await fetchPage(targetUrl);
        const sources = extractVideoSources(html, targetUrl);
        return res.json({ ok: true, sources });
    } catch (error) {
        console.error('[sniff] 页面获取失败:', error.message);
        return res.status(502).json({ ok: false, error: '页面获取失败: ' + error.message });
    }
});

/**
 * 判断主机名是否属于内网（SSRF 防护）
 */
function isInternalHost(hostname) {
    const internalPatterns = [
        /^localhost$/i,
        /^127\./,
        /^0\.0\.0\.0$/,
        /^::1$/,
        /^10\./,
        /^192\.168\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^169\.254\./,
        /^fc00:/i,
        /^fe80:/i
    ];
    return internalPatterns.some(p => p.test(hostname));
}

/**
 * 抓取页面 HTML（跟随最多一次重定向，超时 FETCH_TIMEOUT_MS 毫秒）
 * @param {string} url - 要抓取的页面地址
 * @param {number} [redirectCount=0] - 已跟随的重定向次数，用于防止无限重定向
 */
function fetchPage(url, redirectCount) {
    if ((redirectCount || 0) > 1) {
        return Promise.reject(new Error('重定向次数过多'));
    }

    return new Promise((resolve, reject) => {
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            return reject(new Error('无效的重定向 URL'));
        }

        // 再次 SSRF 校验（防止重定向到内网）
        if (isInternalHost(parsedUrl.hostname)) {
            return reject(new Error('重定向目标为内网地址，已阻止'));
        }

        const lib = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; QingyunboSniffer/1.0)',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            timeout: FETCH_TIMEOUT_MS
        };

        const req = lib.request(options, (resp) => {
            // 跟随重定向
            if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                try {
                    const next = new URL(resp.headers.location, url).href;
                    fetchPage(next, (redirectCount || 0) + 1).then(resolve).catch(reject);
                } catch (_) {
                    reject(new Error('无效的重定向地址'));
                }
                // 消耗响应数据以避免连接挂起
                resp.resume();
                return;
            }

            let data = '';
            // 最多读取 MAX_PAGE_SIZE_BYTES，防止超大页面消耗内存
            let size = 0;
            resp.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_PAGE_SIZE_BYTES) {
                    req.destroy();
                    resolve(data); // 已有足够内容，不等完整响应
                    return;
                }
                data += chunk;
            });
            resp.on('end', () => resolve(data));
            resp.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时（' + (FETCH_TIMEOUT_MS / 1000) + 's）'));
        });

        req.end();
    });
}

/**
 * 从 HTML 文本中提取视频源候选列表
 */
function extractVideoSources(html, baseUrl) {
    const sources = [];
    const seen = new Set();

    function addSource(rawUrl, from) {
        const url = resolveUrl(rawUrl, baseUrl);
        if (!url || seen.has(url)) return;
        seen.add(url);
        const type = detectVideoType(url);
        if (type === 'unknown') return; // 仅保留可识别的视频类型
        sources.push({ url, type, from, score: scoreSource(url, type) });
    }

    // <video src="...">
    for (const m of html.matchAll(/<video[^>]+\bsrc=["']([^"']+)["']/gi)) {
        addSource(m[1], 'dom-video');
    }

    // <source src="...">
    for (const m of html.matchAll(/<source[^>]+\bsrc=["']([^"']+)["']/gi)) {
        addSource(m[1], 'dom-source');
    }

    // og:video meta 标签
    const ogVideo = html.match(/<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/i);
    if (ogVideo) addSource(ogVideo[1], 'meta-og');

    // 正则扫描：.m3u8 / .mp4 直链
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.m3u8(?:[?#][^\s"'<>\\]*)?/gi)) {
        addSource(cleanEscaped(m[0]), 'regex-m3u8');
    }
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.mp4(?:[?#][^\s"'<>\\]*)?/gi)) {
        addSource(cleanEscaped(m[0]), 'regex-mp4');
    }
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+?\.webm(?:[?#][^\s"'<>\\]*)?/gi)) {
        addSource(cleanEscaped(m[0]), 'regex-webm');
    }

    // 按得分降序，最多返回 10 条
    sources.sort((a, b) => b.score - a.score);
    return sources.slice(0, 10);
}

function detectVideoType(url) {
    if (/\.m3u8/i.test(url)) return 'm3u8';
    if (/\.mp4/i.test(url)) return 'mp4';
    if (/\.flv/i.test(url)) return 'flv';
    if (/\.webm/i.test(url)) return 'webm';
    if (/\.ts\b/i.test(url)) return 'ts';
    return 'unknown';
}

function scoreSource(url, type) {
    let score = 0;
    if (type === 'm3u8') score += 10;
    else if (type === 'mp4') score += 8;
    else if (type === 'webm') score += 6;
    else if (type === 'flv') score += 5;
    if (/1080/i.test(url)) score += 3;
    else if (/720/i.test(url)) score += 2;
    if (/\bhd\b/i.test(url)) score += 1;
    if (/preview|thumb|poster/i.test(url)) score -= 5;
    return score;
}

function resolveUrl(href, base) {
    try {
        return new URL(href, base).href;
    } catch (_) {
        return null;
    }
}

function cleanEscaped(url) {
    return url
        .replace(/\\u002[Ff]/g, '/')
        .replace(/\\/g, '');
}

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