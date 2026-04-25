/**
 * 统一数据存储层
 * 上层代码通过 store 读写数据，不再直接操作 localStorage
 */
const STORAGE_KEYS = {
  VIDEO_LIST: 'videoList',
  CURRENT_PLAYLIST: 'currentPlaylist',
  CURRENT_INDEX: 'currentIndex',
  PLAYER_SETTINGS: 'playerSettings',
  PLAYER_VOLUME: 'playerVolume',
  PLAYER_MUTED: 'playerMuted',
  PLAYBACK_RATE: 'preferredPlaybackRate',
  PLAYLIST_GIST_ID: 'playlist_gist_id',
  GITHUB_TOKEN: 'github_token',
  GITHUB_USER: 'github_user',
};

function _get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function _set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function _remove(key) {
  localStorage.removeItem(key);
}

// ---- 视频列表 ----

export function getVideoList() {
  return _get(STORAGE_KEYS.VIDEO_LIST, []);
}

export function saveVideoList(videos) {
  _set(STORAGE_KEYS.VIDEO_LIST, videos);
}

// ---- 当前播放列表 ----

export function getCurrentPlaylist() {
  return _get(STORAGE_KEYS.CURRENT_PLAYLIST, []);
}

export function setCurrentPlaylist(playlist) {
  _set(STORAGE_KEYS.CURRENT_PLAYLIST, playlist);
}

export function getCurrentIndex() {
  const idx = _get(STORAGE_KEYS.CURRENT_INDEX, 0);
  return typeof idx === 'number' ? idx : parseInt(idx, 10) || 0;
}

export function setCurrentIndex(index) {
  _set(STORAGE_KEYS.CURRENT_INDEX, index);
}

// ---- 播放器设置 ----

const DEFAULT_SETTINGS = {
  autoplayNext: true,
  rememberVolume: true,
  showNotifications: true,
  showProgressOnTitle: false,
  defaultQuality: 'auto',
};

export function getPlayerSettings() {
  return { ...DEFAULT_SETTINGS, ..._get(STORAGE_KEYS.PLAYER_SETTINGS, {}) };
}

export function savePlayerSettings(settings) {
  _set(STORAGE_KEYS.PLAYER_SETTINGS, settings);
}

// ---- 音量 / 速度 ----

export function getVolume() {
  return parseFloat(localStorage.getItem(STORAGE_KEYS.PLAYER_VOLUME)) || 0.7;
}

export function setVolume(v) {
  localStorage.setItem(STORAGE_KEYS.PLAYER_VOLUME, String(v));
}

export function getMuted() {
  return localStorage.getItem(STORAGE_KEYS.PLAYER_MUTED) === 'true';
}

export function setMuted(m) {
  localStorage.setItem(STORAGE_KEYS.PLAYER_MUTED, String(m));
}

export function getPlaybackRate() {
  return parseFloat(localStorage.getItem(STORAGE_KEYS.PLAYBACK_RATE)) || 1;
}

export function setPlaybackRate(rate) {
  localStorage.setItem(STORAGE_KEYS.PLAYBACK_RATE, String(rate));
}

// ---- 播放进度 ----

export function getProgress(videoUrl) {
  try {
    const id = `progress_${btoa(videoUrl).substring(0, 32)}`;
    const data = _get(id);
    if (data && Date.now() - data.savedAt < 24 * 60 * 60 * 1000) {
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveProgress(videoUrl, time, duration) {
  try {
    const id = `progress_${btoa(videoUrl).substring(0, 32)}`;
    if (time > 5 && time < duration - 5) {
      _set(id, { time, duration, savedAt: Date.now() });
    }
  } catch { /* ignore */ }
}

export function clearProgress(videoUrl) {
  try {
    const id = `progress_${btoa(videoUrl).substring(0, 32)}`;
    _remove(id);
  } catch { /* ignore */ }
}

// ---- GitHub / Gist ----

export function getPlaylistGistId() {
  return localStorage.getItem(STORAGE_KEYS.PLAYLIST_GIST_ID);
}

export function setPlaylistGistId(id) {
  localStorage.setItem(STORAGE_KEYS.PLAYLIST_GIST_ID, id);
}

export function removePlaylistGistId() {
  _remove(STORAGE_KEYS.PLAYLIST_GIST_ID);
}

export function getGitHubToken() {
  return localStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN);
}

export function setGitHubToken(token) {
  localStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, token);
}

export function getGitHubUser() {
  return _get(STORAGE_KEYS.GITHUB_USER);
}

export function setGitHubUser(user) {
  _set(STORAGE_KEYS.GITHUB_USER, user);
}

export function clearGitHubAuth() {
  _remove(STORAGE_KEYS.GITHUB_TOKEN);
  _remove(STORAGE_KEYS.GITHUB_USER);
  _remove(STORAGE_KEYS.PLAYLIST_GIST_ID);
}
