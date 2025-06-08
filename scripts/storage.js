/**
 * 本地存储管理模块
 * 处理播放列表、设置等数据的本地存储
 */

import { deepClone, handleError } from './utils.js';

// 存储键名常量
const STORAGE_KEYS = {
    PLAYLIST: 'video_playlist',
    SETTINGS: 'video_settings',
    PLAYER_STATE: 'player_state',
    GITHUB_TOKEN: 'github_token'
};

// 默认设置
const DEFAULT_SETTINGS = {
    autoplay: true,
    loop: false,
    volume: 0.7,
    defaultQuality: 'auto',
    showNotifications: true,
    rememberVolume: true,
    showProgressOnTitle: false,
    autoplayNext: true
};

// 默认播放器状态
const DEFAULT_PLAYER_STATE = {
    currentIndex: 0,
    shuffle: false,
    repeat: 'none', // 'none', 'one', 'all'
    volume: 0.7,
    muted: false,
    speed: 1.0
};

export class StorageManager {
    constructor() {
        this.cache = new Map();
        this.listeners = new Map();
    }

    // 获取存储的数据
    get(key, defaultValue = null) {
        try {
            // 先检查缓存
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }

            const stored = localStorage.getItem(key);
            if (stored === null) {
                return defaultValue;
            }

            const parsed = JSON.parse(stored);
            this.cache.set(key, parsed);
            return parsed;
        } catch (error) {
            handleError(error, '读取存储数据');
            return defaultValue;
        }
    }

    // 保存数据到存储
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            this.cache.set(key, deepClone(value));
            
            // 触发监听器
            this.notifyListeners(key, value);
            return true;
        } catch (error) {
            handleError(error, '保存存储数据');
            return false;
        }
    }

    // 删除存储的数据
    remove(key) {
        try {
            localStorage.removeItem(key);
            this.cache.delete(key);
            this.notifyListeners(key, null);
            return true;
        } catch (error) {
            handleError(error, '删除存储数据');
            return false;
        }
    }

    // 清空所有数据
    clear() {
        try {
            localStorage.clear();
            this.cache.clear();
            return true;
        } catch (error) {
            handleError(error, '清空存储数据');
            return false;
        }
    }

    // 添加数据变化监听器
    addListener(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    // 移除监听器
    removeListener(key, callback) {
        const listeners = this.listeners.get(key);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    // 通知监听器
    notifyListeners(key, value) {
        const listeners = this.listeners.get(key);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(value, key);
                } catch (error) {
                    handleError(error, '存储监听器');
                }
            });
        }
    }

    // 获取播放列表
    getPlaylist() {
        return this.get(STORAGE_KEYS.PLAYLIST, []);
    }

    // 保存播放列表
    setPlaylist(playlist) {
        return this.set(STORAGE_KEYS.PLAYLIST, playlist || []);
    }

    // 添加视频到播放列表
    addVideo(video) {
        const playlist = this.getPlaylist();
        const newVideo = {
            id: video.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
            title: video.title,
            url: video.url,
            type: video.type || 'auto',
            addedAt: new Date().toISOString(),
            ...video
        };
        playlist.push(newVideo);
        return this.setPlaylist(playlist);
    }

    // 批量添加视频
    addVideos(videos) {
        const playlist = this.getPlaylist();
        const newVideos = videos.map(video => ({
            id: video.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
            title: video.title,
            url: video.url,
            type: video.type || 'auto',
            addedAt: new Date().toISOString(),
            ...video
        }));
        playlist.push(...newVideos);
        return this.setPlaylist(playlist);
    }

    // 删除视频
    removeVideo(videoId) {
        const playlist = this.getPlaylist();
        const filtered = playlist.filter(video => video.id !== videoId);
        return this.setPlaylist(filtered);
    }

    // 更新视频信息
    updateVideo(videoId, updates) {
        const playlist = this.getPlaylist();
        const index = playlist.findIndex(video => video.id === videoId);
        if (index > -1) {
            playlist[index] = { ...playlist[index], ...updates };
            return this.setPlaylist(playlist);
        }
        return false;
    }

    // 移动视频位置
    moveVideo(fromIndex, toIndex) {
        const playlist = this.getPlaylist();
        if (fromIndex < 0 || fromIndex >= playlist.length || 
            toIndex < 0 || toIndex >= playlist.length) {
            return false;
        }

        const [removed] = playlist.splice(fromIndex, 1);
        playlist.splice(toIndex, 0, removed);
        return this.setPlaylist(playlist);
    }

    // 清空播放列表
    clearPlaylist() {
        return this.setPlaylist([]);
    }

    // 获取设置
    getSettings() {
        const settings = this.get(STORAGE_KEYS.SETTINGS, {});
        return { ...DEFAULT_SETTINGS, ...settings };
    }

    // 保存设置
    setSettings(settings) {
        const currentSettings = this.getSettings();
        const newSettings = { ...currentSettings, ...settings };
        return this.set(STORAGE_KEYS.SETTINGS, newSettings);
    }

    // 获取单个设置
    getSetting(key) {
        const settings = this.getSettings();
        return settings[key];
    }

    // 设置单个设置
    setSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.setSettings(settings);
    }

    // 获取播放器状态
    getPlayerState() {
        const state = this.get(STORAGE_KEYS.PLAYER_STATE, {});
        return { ...DEFAULT_PLAYER_STATE, ...state };
    }

    // 保存播放器状态
    setPlayerState(state) {
        const currentState = this.getPlayerState();
        const newState = { ...currentState, ...state };
        return this.set(STORAGE_KEYS.PLAYER_STATE, newState);
    }

    // 获取GitHub Token
    getGithubToken() {
        return this.get(STORAGE_KEYS.GITHUB_TOKEN, '');
    }

    // 保存GitHub Token
    setGithubToken(token) {
        return this.set(STORAGE_KEYS.GITHUB_TOKEN, token);
    }

    // 导出数据
    exportData() {
        const data = {
            playlist: this.getPlaylist(),
            settings: this.getSettings(),
            playerState: this.getPlayerState(),
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
        return data;
    }

    // 导入数据
    importData(data) {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('无效的数据格式');
            }

            let imported = 0;

            if (data.playlist && Array.isArray(data.playlist)) {
                this.setPlaylist(data.playlist);
                imported++;
            }

            if (data.settings && typeof data.settings === 'object') {
                this.setSettings(data.settings);
                imported++;
            }

            if (data.playerState && typeof data.playerState === 'object') {
                this.setPlayerState(data.playerState);
                imported++;
            }

            return { success: true, imported };
        } catch (error) {
            handleError(error, '导入数据');
            return { success: false, error: error.message };
        }
    }

    // 获取存储使用情况
    getStorageInfo() {
        try {
            let totalSize = 0;
            const keys = Object.keys(localStorage);
            
            const info = {};
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                const size = new Blob([value]).size;
                info[key] = {
                    size,
                    sizeFormatted: this.formatBytes(size)
                };
                totalSize += size;
            });

            return {
                total: totalSize,
                totalFormatted: this.formatBytes(totalSize),
                keys: info,
                available: this.getAvailableStorage()
            };
        } catch (error) {
            handleError(error, '获取存储信息');
            return null;
        }
    }

    // 获取可用存储空间
    getAvailableStorage() {
        try {
            const testKey = '_storage_test_';
            const testData = 'x'.repeat(1024); // 1KB
            let available = 0;

            for (let i = 0; i < 10240; i++) { // 最多测试10MB
                try {
                    localStorage.setItem(testKey, testData.repeat(i));
                    available = i;
                } catch (e) {
                    break;
                }
            }

            localStorage.removeItem(testKey);
            return available * 1024; // 返回字节数
        } catch (error) {
            return 0;
        }
    }

    // 格式化字节数
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 创建全局存储管理器实例
export const storage = new StorageManager();

// 监听存储变化（跨标签页同步）
window.addEventListener('storage', (e) => {
    if (e.key && e.newValue !== e.oldValue) {
        try {
            const newValue = e.newValue ? JSON.parse(e.newValue) : null;
            storage.cache.set(e.key, newValue);
            storage.notifyListeners(e.key, newValue);
        } catch (error) {
            handleError(error, '同步存储变化');
        }
    }
});

// 导出常量和默认值
export { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_PLAYER_STATE };
