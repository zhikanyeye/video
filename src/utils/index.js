/**
 * 通用工具函数
 */

export function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidVideoUrl(url) {
  try {
    const parsed = new URL(url);
    const allowed = ['http:', 'https:', 'rtmp:'];
    if (!allowed.includes(parsed.protocol)) {
      return { valid: false, reason: '不支持的协议' };
    }
    if (url.toLowerCase().includes('javascript:')) {
      return { valid: false, reason: '不安全的链接' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: '无效的链接格式' };
  }
}

export function detectVideoType(url) {
  const lower = url.toLowerCase();
  if (lower.startsWith('rtmp://')) return 'rtmp';
  if (lower.includes('.mpd')) return 'mpd';
  if (lower.includes('.m3u8') || lower.includes('m3u8')) return 'm3u8';
  if (lower.includes('.flv') || lower.includes('flv')) return 'flv';
  if (lower.includes('.webm')) return 'webm';
  if (lower.includes('.ogg') || lower.includes('.ogv')) return 'ogg';
  if (lower.includes('.mov')) return 'mov';
  if (lower.includes('.mkv')) return 'mkv';
  if (lower.includes('.avi')) return 'avi';
  if (lower.includes('.ts')) return 'ts';
  if (lower.includes('bilibili.com') || lower.includes('b23.tv')) return 'bilibili';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return 'mp4';
}
