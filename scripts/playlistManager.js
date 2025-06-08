/**
 * 播放列表管理模块
 * 处理播放列表的增删改查、排序、搜索等操作
 */

import { generateId, debounce, handleError, showToast } from './utils.js';
import { storage } from './storage.js';
import { videoDetector, VIDEO_TYPES } from './videoDetector.js';

export class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.filteredPlaylist = [];
        this.currentFilter = '';
        this.currentSort = 'index';
        this.listeners = new Map();
        
        // 防抖搜索
        this.debouncedSearch = debounce(this.search.bind(this), 300);
        
        this.init();
    }

    init() {
        // 从存储加载播放列表
        this.loadFromStorage();
        
        // 监听存储变化
        storage.addListener('video_playlist', (playlist) => {
            this.playlist = playlist || [];
            this.applyCurrentFilter();
            this.notifyListeners('update', this.filteredPlaylist);
        });
    }

    /**
     * 从存储加载播放列表
     */
    loadFromStorage() {
        this.playlist = storage.getPlaylist();
        this.applyCurrentFilter();
    }

    /**
     * 保存到存储
     */
    saveToStorage() {
        return storage.setPlaylist(this.playlist);
    }

    /**
     * 添加视频监听器
     * @param {string} event - 事件类型
     * @param {Function} callback - 回调函数
     */
    addListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * 移除监听器
     * @param {string} event - 事件类型
     * @param {Function} callback - 回调函数
     */
    removeListener(event, callback) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 通知监听器
     * @param {string} event - 事件类型
     * @param {*} data - 事件数据
     */
    notifyListeners(event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data, event);
                } catch (error) {
                    handleError(error, '播放列表监听器');
                }
            });
        }
    }

    /**
     * 添加单个视频
     * @param {Object} videoData - 视频数据
     * @returns {Promise<Object>} 添加的视频对象
     */
    async addVideo(videoData) {
        try {
            // 验证必要字段
            if (!videoData.title || !videoData.url) {
                throw new Error('标题和链接不能为空');
            }

            // 检测视频类型（如果未指定）
            let type = videoData.type || 'auto';
            if (type === 'auto') {
                type = videoDetector.detectType(videoData.url);
            }

            // 创建视频对象
            const video = {
                id: videoData.id || generateId(),
                title: videoData.title.trim(),
                url: videoData.url.trim(),
                type: type,
                addedAt: new Date().toISOString(),
                duration: videoData.duration || 0,
                thumbnail: videoData.thumbnail || '',
                description: videoData.description || ''
            };

            // 检查是否已存在相同URL
            const existingIndex = this.playlist.findIndex(v => v.url === video.url);
            if (existingIndex > -1) {
                const confirmed = confirm(`视频"${video.title}"已存在于播放列表中，是否要替换？`);
                if (confirmed) {
                    this.playlist[existingIndex] = video;
                } else {
                    return null;
                }
            } else {
                this.playlist.push(video);
            }

            // 保存到存储
            this.saveToStorage();
            this.applyCurrentFilter();

            // 通知监听器
            this.notifyListeners('add', video);
            this.notifyListeners('update', this.filteredPlaylist);

            showToast(`已添加视频：${video.title}`, 'success');
            return video;
        } catch (error) {
            handleError(error, '添加视频');
            return null;
        }
    }

    /**
     * 批量添加视频
     * @param {Array<Object>} videos - 视频数据数组
     * @returns {Promise<Array<Object>>} 添加的视频列表
     */
    async addVideos(videos) {
        try {
            const results = [];
            let successCount = 0;
            let skipCount = 0;

            for (const videoData of videos) {
                const result = await this.addVideo(videoData);
                if (result) {
                    results.push(result);
                    successCount++;
                } else {
                    skipCount++;
                }
            }

            const message = `批量添加完成：成功 ${successCount} 个${skipCount > 0 ? `，跳过 ${skipCount} 个` : ''}`;
            showToast(message, successCount > 0 ? 'success' : 'warning');

            return results;
        } catch (error) {
            handleError(error, '批量添加视频');
            return [];
        }
    }

    /**
     * 删除视频
     * @param {string} videoId - 视频ID
     * @returns {boolean} 是否删除成功
     */
    removeVideo(videoId) {
        try {
            const index = this.playlist.findIndex(video => video.id === videoId);
            if (index > -1) {
                const removedVideo = this.playlist.splice(index, 1)[0];
                this.saveToStorage();
                this.applyCurrentFilter();

                this.notifyListeners('remove', removedVideo);
                this.notifyListeners('update', this.filteredPlaylist);

                showToast(`已删除视频：${removedVideo.title}`, 'success');
                return true;
            }
            return false;
        } catch (error) {
            handleError(error, '删除视频');
            return false;
        }
    }

    /**
     * 更新视频信息
     * @param {string} videoId - 视频ID
     * @param {Object} updates - 更新的数据
     * @returns {boolean} 是否更新成功
     */
    updateVideo(videoId, updates) {
        try {
            const index = this.playlist.findIndex(video => video.id === videoId);
            if (index > -1) {
                const oldVideo = { ...this.playlist[index] };
                this.playlist[index] = { ...this.playlist[index], ...updates };
                
                this.saveToStorage();
                this.applyCurrentFilter();

                this.notifyListeners('update-item', {
                    old: oldVideo,
                    new: this.playlist[index]
                });
                this.notifyListeners('update', this.filteredPlaylist);

                return true;
            }
            return false;
        } catch (error) {
            handleError(error, '更新视频');
            return false;
        }
    }

    /**
     * 移动视频位置
     * @param {number} fromIndex - 原位置
     * @param {number} toIndex - 目标位置
     * @returns {boolean} 是否移动成功
     */
    moveVideo(fromIndex, toIndex) {
        try {
            if (fromIndex < 0 || fromIndex >= this.playlist.length ||
                toIndex < 0 || toIndex >= this.playlist.length ||
                fromIndex === toIndex) {
                return false;
            }

            const [movedVideo] = this.playlist.splice(fromIndex, 1);
            this.playlist.splice(toIndex, 0, movedVideo);

            this.saveToStorage();
            this.applyCurrentFilter();

            this.notifyListeners('move', { video: movedVideo, fromIndex, toIndex });
            this.notifyListeners('update', this.filteredPlaylist);

            return true;
        } catch (error) {
            handleError(error, '移动视频');
            return false;
        }
    }

    /**
     * 清空播放列表
     * @returns {boolean} 是否清空成功
     */
    clear() {
        try {
            if (this.playlist.length === 0) {
                showToast('播放列表已经为空', 'info');
                return true;
            }

            const confirmed = confirm(`确定要清空播放列表中的 ${this.playlist.length} 个视频吗？`);
            if (confirmed) {
                this.playlist = [];
                this.saveToStorage();
                this.applyCurrentFilter();

                this.notifyListeners('clear', null);
                this.notifyListeners('update', this.filteredPlaylist);

                showToast('播放列表已清空', 'success');
                return true;
            }
            return false;
        } catch (error) {
            handleError(error, '清空播放列表');
            return false;
        }
    }

    /**
     * 获取视频
     * @param {string} videoId - 视频ID
     * @returns {Object|null} 视频对象
     */
    getVideo(videoId) {
        return this.playlist.find(video => video.id === videoId) || null;
    }

    /**
     * 获取视频索引
     * @param {string} videoId - 视频ID
     * @returns {number} 视频索引，-1表示未找到
     */
    getVideoIndex(videoId) {
        return this.playlist.findIndex(video => video.id === videoId);
    }

    /**
     * 获取播放列表
     * @param {boolean} filtered - 是否返回过滤后的列表
     * @returns {Array<Object>} 播放列表
     */
    getPlaylist(filtered = true) {
        return filtered ? this.filteredPlaylist : this.playlist;
    }

    /**
     * 获取播放列表长度
     * @param {boolean} filtered - 是否计算过滤后的列表
     * @returns {number} 播放列表长度
     */
    getLength(filtered = true) {
        return filtered ? this.filteredPlaylist.length : this.playlist.length;
    }

    /**
     * 搜索播放列表
     * @param {string} query - 搜索关键词
     */
    search(query) {
        this.currentFilter = query.toLowerCase().trim();
        this.applyCurrentFilter();
        this.notifyListeners('search', { query, results: this.filteredPlaylist });
    }

    /**
     * 应用当前过滤条件
     */
    applyCurrentFilter() {
        let filtered = [...this.playlist];

        // 应用搜索过滤
        if (this.currentFilter) {
            filtered = filtered.filter(video => 
                video.title.toLowerCase().includes(this.currentFilter) ||
                video.url.toLowerCase().includes(this.currentFilter) ||
                video.type.toLowerCase().includes(this.currentFilter)
            );
        }

        // 应用排序
        filtered = this.sortPlaylist(filtered, this.currentSort);

        this.filteredPlaylist = filtered;
    }

    /**
     * 排序播放列表
     * @param {Array<Object>} playlist - 要排序的播放列表
     * @param {string} sortBy - 排序方式
     * @returns {Array<Object>} 排序后的播放列表
     */
    sortPlaylist(playlist, sortBy) {
        const sorted = [...playlist];

        switch (sortBy) {
            case 'title':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'type':
                sorted.sort((a, b) => a.type.localeCompare(b.type));
                break;
            case 'date':
                sorted.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
                break;
            case 'duration':
                sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
                break;
            case 'index':
            default:
                // 保持原始顺序
                break;
        }

        return sorted;
    }

    /**
     * 设置排序方式
     * @param {string} sortBy - 排序方式
     */
    setSorting(sortBy) {
        this.currentSort = sortBy;
        this.applyCurrentFilter();
        this.notifyListeners('sort', { sortBy, results: this.filteredPlaylist });
    }

    /**
     * 导出播放列表
     * @param {string} format - 导出格式
     * @returns {string|Object} 导出的数据
     */
    export(format = 'json') {
        try {
            const data = {
                playlist: this.playlist,
                meta: {
                    total: this.playlist.length,
                    exportedAt: new Date().toISOString(),
                    version: '1.0'
                }
            };

            switch (format.toLowerCase()) {
                case 'json':
                    return JSON.stringify(data, null, 2);
                case 'csv':
                    return this.exportToCsv();
                case 'm3u':
                    return this.exportToM3u();
                default:
                    return data;
            }
        } catch (error) {
            handleError(error, '导出播放列表');
            return null;
        }
    }

    /**
     * 导出为CSV格式
     * @returns {string} CSV数据
     */
    exportToCsv() {
        const headers = ['标题', '链接', '类型', '时长', '添加时间'];
        const rows = this.playlist.map(video => [
            `"${video.title.replace(/"/g, '""')}"`,
            `"${video.url}"`,
            `"${video.type}"`,
            video.duration || 0,
            `"${video.addedAt}"`
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * 导出为M3U格式
     * @returns {string} M3U数据
     */
    exportToM3u() {
        const lines = ['#EXTM3U'];
        
        this.playlist.forEach(video => {
            const duration = Math.floor(video.duration || 0);
            lines.push(`#EXTINF:${duration},${video.title}`);
            lines.push(video.url);
        });

        return lines.join('\n');
    }

    /**
     * 导入播放列表
     * @param {string|Object} data - 导入的数据
     * @param {string} format - 数据格式
     * @param {boolean} append - 是否追加到现有列表
     * @returns {Promise<boolean>} 是否导入成功
     */
    async importPlaylist(data, format = 'json', append = false) {
        try {
            let videos = [];

            switch (format.toLowerCase()) {
                case 'json':
                    videos = this.parseJsonImport(data);
                    break;
                case 'csv':
                    videos = this.parseCsvImport(data);
                    break;
                case 'm3u':
                    videos = this.parseM3uImport(data);
                    break;
                case 'text':
                    videos = this.parseTextImport(data);
                    break;
                default:
                    throw new Error(`不支持的导入格式: ${format}`);
            }

            if (videos.length === 0) {
                showToast('没有找到有效的视频数据', 'warning');
                return false;
            }

            // 清空现有列表（如果不是追加模式）
            if (!append) {
                this.playlist = [];
            }

            // 批量添加视频
            await this.addVideos(videos);

            showToast(`成功导入 ${videos.length} 个视频`, 'success');
            return true;
        } catch (error) {
            handleError(error, '导入播放列表');
            return false;
        }
    }

    /**
     * 解析JSON导入数据
     * @param {string|Object} data - JSON数据
     * @returns {Array<Object>} 视频列表
     */
    parseJsonImport(data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (parsed.playlist && Array.isArray(parsed.playlist)) {
            return parsed.playlist;
        } else if (Array.isArray(parsed)) {
            return parsed;
        } else {
            throw new Error('无效的JSON格式');
        }
    }

    /**
     * 解析CSV导入数据
     * @param {string} data - CSV数据
     * @returns {Array<Object>} 视频列表
     */
    parseCsvImport(data) {
        const lines = data.split('\n').filter(line => line.trim());
        const videos = [];

        for (let i = 1; i < lines.length; i++) { // 跳过标题行
            const parts = this.parseCsvLine(lines[i]);
            if (parts.length >= 2) {
                videos.push({
                    title: parts[0],
                    url: parts[1],
                    type: parts[2] || 'auto'
                });
            }
        }

        return videos;
    }

    /**
     * 解析CSV行
     * @param {string} line - CSV行
     * @returns {Array<string>} 解析后的字段
     */
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    /**
     * 解析M3U导入数据
     * @param {string} data - M3U数据
     * @returns {Array<Object>} 视频列表
     */
    parseM3uImport(data) {
        const lines = data.split('\n').filter(line => line.trim());
        const videos = [];
        let currentTitle = '';

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('#EXTINF:')) {
                const match = trimmed.match(/#EXTINF:[\d-]+,(.+)/);
                currentTitle = match ? match[1] : '';
            } else if (trimmed && !trimmed.startsWith('#')) {
                videos.push({
                    title: currentTitle || `视频 ${videos.length + 1}`,
                    url: trimmed,
                    type: 'auto'
                });
                currentTitle = '';
            }
        }

        return videos;
    }

    /**
     * 解析文本导入数据
     * @param {string} data - 文本数据
     * @returns {Array<Object>} 视频列表
     */
    parseTextImport(data) {
        const lines = data.split('\n').filter(line => line.trim());
        const videos = [];

        for (const line of lines) {
            const parts = line.split(',').map(part => part.trim());
            
            if (parts.length >= 2) {
                videos.push({
                    title: parts[0],
                    url: parts[1],
                    type: parts[2] || 'auto'
                });
            }
        }

        return videos;
    }

    /**
     * 获取播放列表统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {
            total: this.playlist.length,
            filtered: this.filteredPlaylist.length,
            types: {},
            totalDuration: 0
        };

        this.playlist.forEach(video => {
            // 统计类型
            stats.types[video.type] = (stats.types[video.type] || 0) + 1;
            
            // 统计总时长
            if (video.duration) {
                stats.totalDuration += video.duration;
            }
        });

        return stats;
    }
}

// 创建全局播放列表管理器实例
export const playlistManager = new PlaylistManager();
