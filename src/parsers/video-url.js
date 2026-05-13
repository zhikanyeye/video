/**
 * 视频URL解析器
 * 将各种视频链接解析为播放器可用的格式
 */

const BILIBILI_PATTERNS = [
  /bilibili\.com\/video\/(BV[\w]+)/i,
  /bilibili\.com\/video\/av(\d+)/i,
  /b23\.tv\/(\w+)/i,
];

const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?v=([\w-]+)/i,
  /youtu\.be\/([\w-]+)/i,
  /youtube\.com\/embed\/([\w-]+)/i,
  /youtube\.com\/shorts\/([\w-]+)/i,
];

/**
 * 解析视频URL，返回标准化信息
 * @param {string} url
 * @returns {Promise<{type: string, url: string, platform?: string}>}
 */
export async function parseVideoUrl(url) {
  // B站
  for (const pattern of BILIBILI_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return {
        type: 'iframe',
        url: `https://player.bilibili.com/player.html?bvid=${match[1]}&autoplay=1`,
        platform: 'B站',
      };
    }
  }

  // YouTube
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return {
        type: 'iframe',
        url: `https://www.youtube.com/embed/${match[1]}?autoplay=1`,
        platform: 'YouTube',
      };
    }
  }

  // 嗅探模式：通过后端API解析
  if (shouldSniff(url)) {
    try {
      const sniffed = await sniffVideoSources(url);
      if (sniffed && sniffed.length > 0) {
        const best = sniffed[0]; // 已按 score 排序
        return { type: best.type, url: best.url };
      }
    } catch (e) {
      console.warn('嗅探失败，尝试直接播放:', e);
    }
  }

  // 直链
  return { type: detectDirectType(url), url };
}

function detectDirectType(url) {
  if (/^rtmp:\/\//i.test(url)) return 'rtmp';
  if (/\.mpd(?:[?#]|$)/i.test(url)) return 'mpd';
  if (/\.m3u8/i.test(url)) return 'm3u8';
  if (/\.flv/i.test(url)) return 'flv';
  if (/\.webm/i.test(url)) return 'webm';
  if (/\.ogg|\.ogv/i.test(url)) return 'ogg';
  if (/\.mov/i.test(url)) return 'mov';
  if (/\.mkv/i.test(url)) return 'mkv';
  if (/\.avi/i.test(url)) return 'avi';
  if (/\.ts(?:[?#]|$)/i.test(url)) return 'ts';
  if (/\.mp4/i.test(url)) return 'mp4';
  return 'mp4';
}

function shouldSniff(url) {
  // 非直链且非已知平台时启用嗅探
  return !isDirectVideoUrl(url) && !BILIBILI_PATTERNS.some((p) => p.test(url)) && !YOUTUBE_PATTERNS.some((p) => p.test(url));
}

function isDirectVideoUrl(url) {
  return /^rtmp:\/\//i.test(url) || /\.(mp4|mpd|m3u8|flv|webm|ogg|ogv|mov|mkv|avi|ts)(\?|#|$)/i.test(url);
}

/**
 * 调用后端嗅探API
 */
async function sniffVideoSources(url) {
  const apiBase = getApiBase();
  const resp = await fetch(`${apiBase}/api/sniff?url=${encodeURIComponent(url)}`);
  if (!resp.ok) throw new Error(`嗅探请求失败: ${resp.status}`);
  const data = await resp.json();
  return data.sources || [];
}

function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE?.trim();
  if (envBase) return envBase.replace(/\/+$/, '');

  const runtimeBase = window.APP_CONFIG?.API_BASE?.trim();
  if (runtimeBase) return runtimeBase.replace(/\/+$/, '');

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'http://localhost:3000' : '';
}
