/**
 * GitHub Gist 服务模块
 * 处理播放列表的云端保存和分享功能
 */

import { handleError, showToast, generateId } from './utils.js';
import { storage } from './storage.js';

export class GitHubService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.token = '';
        this.init();
    }

    init() {
        // 从存储加载token
        this.token = storage.getGithubToken();
    }

    /**
     * 设置GitHub Token
     * @param {string} token - GitHub Personal Access Token
     */
    setToken(token) {
        this.token = token.trim();
        storage.setGithubToken(this.token);
    }

    /**
     * 获取当前token
     * @returns {string} 当前token
     */
    getToken() {
        return this.token;
    }

    /**
     * 验证token是否有效
     * @returns {Promise<boolean>} token是否有效
     */
    async validateToken() {
        try {
            if (!this.token) {
                return false;
            }

            const response = await this.makeRequest('/user');
            return response.ok;
        } catch (error) {
            console.warn('Token验证失败:', error);
            return false;
        }
    }

    /**
     * 发起GitHub API请求
     * @param {string} endpoint - API端点
     * @param {Object} options - 请求选项
     * @returns {Promise<Response>} 响应对象
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查网络设置');
            }
            throw error;
        }
    }

    /**
     * 创建Gist
     * @param {Object} gistData - Gist数据
     * @returns {Promise<Object>} 创建的Gist信息
     */
    async createGist(gistData) {
        try {
            if (!this.token) {
                throw new Error('请先设置GitHub Token');
            }

            const response = await this.makeRequest('/gists', {
                method: 'POST',
                body: JSON.stringify(gistData)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            handleError(error, '创建Gist');
            throw error;
        }
    }

    /**
     * 更新Gist
     * @param {string} gistId - Gist ID
     * @param {Object} gistData - 更新的Gist数据
     * @returns {Promise<Object>} 更新后的Gist信息
     */
    async updateGist(gistId, gistData) {
        try {
            if (!this.token) {
                throw new Error('请先设置GitHub Token');
            }

            const response = await this.makeRequest(`/gists/${gistId}`, {
                method: 'PATCH',
                body: JSON.stringify(gistData)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            handleError(error, '更新Gist');
            throw error;
        }
    }

    /**
     * 获取Gist
     * @param {string} gistId - Gist ID
     * @returns {Promise<Object>} Gist信息
     */
    async getGist(gistId) {
        try {
            const response = await this.makeRequest(`/gists/${gistId}`);
            const result = await response.json();
            return result;
        } catch (error) {
            handleError(error, '获取Gist');
            throw error;
        }
    }

    /**
     * 删除Gist
     * @param {string} gistId - Gist ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteGist(gistId) {
        try {
            if (!this.token) {
                throw new Error('请先设置GitHub Token');
            }

            await this.makeRequest(`/gists/${gistId}`, {
                method: 'DELETE'
            });

            return true;
        } catch (error) {
            handleError(error, '删除Gist');
            return false;
        }
    }

    /**
     * 获取用户的Gist列表
     * @returns {Promise<Array>} Gist列表
     */
    async getUserGists() {
        try {
            if (!this.token) {
                throw new Error('请先设置GitHub Token');
            }

            const response = await this.makeRequest('/gists');
            const gists = await response.json();
            
            // 过滤出播放列表相关的Gist
            return gists.filter(gist => 
                gist.description && 
                gist.description.includes('青云播播放列表') ||
                Object.keys(gist.files).some(filename => 
                    filename.includes('playlist') || filename.includes('video')
                )
            );
        } catch (error) {
            handleError(error, '获取Gist列表');
            return [];
        }
    }

    /**
     * 保存播放列表到Gist
     * @param {Array} playlist - 播放列表
     * @param {Object} options - 保存选项
     * @returns {Promise<Object>} 保存结果
     */
    async savePlaylist(playlist, options = {}) {
        try {
            if (!this.token) {
                throw new Error('请先配置GitHub Token才能保存到云端');
            }

            if (!playlist || playlist.length === 0) {
                throw new Error('播放列表为空，无法保存');
            }

            const timestamp = new Date().toISOString();
            const playlistData = {
                playlist,
                metadata: {                    title: options.title || '青云播播放列表',
                    description: options.description || '通过青云播管理器创建',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    version: '1.0',
                    total: playlist.length
                }
            };

            const filename = options.filename || `playlist_${Date.now()}.json`;
            const gistData = {
                description: `青云播播放列表 - ${playlistData.metadata.title} (${playlist.length}个视频)`,
                public: options.public !== false, // 默认公开
                files: {
                    [filename]: {
                        content: JSON.stringify(playlistData, null, 2)
                    }
                }
            };

            // 如果提供了gistId，则更新现有Gist
            let result;
            if (options.gistId) {
                result = await this.updateGist(options.gistId, gistData);
            } else {
                result = await this.createGist(gistData);
            }

            // 保存Gist信息到本地
            this.saveGistInfo(result);

            showToast('播放列表已保存到云端', 'success');
            return {
                success: true,
                gist: result,
                shareUrl: this.generateShareUrl(result.id),
                directUrl: result.html_url
            };
        } catch (error) {
            handleError(error, '保存播放列表');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 从Gist加载播放列表
     * @param {string} gistId - Gist ID或完整URL
     * @returns {Promise<Object>} 加载结果
     */
    async loadPlaylist(gistId) {
        try {
            // 从URL中提取Gist ID
            const extractedId = this.extractGistId(gistId);
            if (!extractedId) {
                throw new Error('无效的Gist ID或URL');
            }

            const gist = await this.getGist(extractedId);
            
            // 查找播放列表文件
            const playlistFile = this.findPlaylistFile(gist.files);
            if (!playlistFile) {
                throw new Error('Gist中没有找到播放列表文件');
            }

            const content = playlistFile.content;
            const data = JSON.parse(content);

            if (!data.playlist || !Array.isArray(data.playlist)) {
                throw new Error('无效的播放列表格式');
            }

            showToast(`成功加载播放列表：${data.playlist.length} 个视频`, 'success');
            return {
                success: true,
                playlist: data.playlist,
                metadata: data.metadata || {},
                gist: {
                    id: gist.id,
                    url: gist.html_url,
                    description: gist.description,
                    updated_at: gist.updated_at
                }
            };
        } catch (error) {
            handleError(error, '加载播放列表');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 从Gist文件中查找播放列表文件
     * @param {Object} files - Gist文件对象
     * @returns {Object|null} 播放列表文件
     */
    findPlaylistFile(files) {
        // 优先查找明确的播放列表文件
        for (const [filename, file] of Object.entries(files)) {
            if (filename.toLowerCase().includes('playlist') && 
                filename.toLowerCase().endsWith('.json')) {
                return file;
            }
        }

        // 查找其他JSON文件
        for (const [filename, file] of Object.entries(files)) {
            if (filename.toLowerCase().endsWith('.json')) {
                try {
                    const content = JSON.parse(file.content);
                    if (content.playlist && Array.isArray(content.playlist)) {
                        return file;
                    }
                } catch (e) {
                    // 忽略解析错误，继续查找
                }
            }
        }

        return null;
    }

    /**
     * 从URL或字符串中提取Gist ID
     * @param {string} input - 输入字符串
     * @returns {string|null} Gist ID
     */
    extractGistId(input) {
        if (!input) return null;

        // 直接的Gist ID（32位十六进制字符串）
        if (/^[a-f0-9]{32}$/i.test(input)) {
            return input;
        }

        // GitHub Gist URL
        const gistMatch = input.match(/gist\.github\.com\/[^\/]*\/([a-f0-9]{32})/i);
        if (gistMatch) {
            return gistMatch[1];
        }

        // 应用的分享链接
        const shareMatch = input.match(/[?&]gist=([a-f0-9]{32})/i);
        if (shareMatch) {
            return shareMatch[1];
        }

        return null;
    }

    /**
     * 生成分享链接
     * @param {string} gistId - Gist ID
     * @returns {string} 分享链接
     */
    generateShareUrl(gistId) {
        const baseUrl = window.location.origin + window.location.pathname;
        const playerUrl = baseUrl.replace('index.html', 'player.html');
        return `${playerUrl}?gist=${gistId}`;
    }

    /**
     * 保存Gist信息到本地
     * @param {Object} gist - Gist对象
     */
    saveGistInfo(gist) {
        try {
            const gistHistory = storage.get('gist_history', []);
            
            // 检查是否已存在
            const existingIndex = gistHistory.findIndex(item => item.id === gist.id);
            
            const gistInfo = {
                id: gist.id,
                description: gist.description,
                url: gist.html_url,
                updatedAt: gist.updated_at,
                savedAt: new Date().toISOString()
            };

            if (existingIndex > -1) {
                gistHistory[existingIndex] = gistInfo;
            } else {
                gistHistory.unshift(gistInfo);
            }

            // 只保留最近的20个记录
            if (gistHistory.length > 20) {
                gistHistory.splice(20);
            }

            storage.set('gist_history', gistHistory);
        } catch (error) {
            console.warn('保存Gist历史失败:', error);
        }
    }

    /**
     * 获取Gist历史记录
     * @returns {Array} Gist历史记录
     */
    getGistHistory() {
        return storage.get('gist_history', []);
    }

    /**
     * 清除Gist历史记录
     */
    clearGistHistory() {
        storage.remove('gist_history');
    }

    /**
     * 分享播放列表
     * @param {Array} playlist - 播放列表
     * @param {Object} options - 分享选项
     * @returns {Promise<Object>} 分享结果
     */
    async sharePlaylist(playlist, options = {}) {
        try {
            const result = await this.savePlaylist(playlist, {
                ...options,
                public: true // 分享时强制设为公开
            });

            if (result.success) {
                // 复制分享链接到剪贴板
                try {
                    await navigator.clipboard.writeText(result.shareUrl);
                    showToast('分享链接已复制到剪贴板', 'success');
                } catch (clipboardError) {
                    console.warn('复制到剪贴板失败:', clipboardError);
                }

                return {
                    ...result,
                    shareUrl: result.shareUrl,
                    qrCode: this.generateQRCodeUrl(result.shareUrl)
                };
            }

            return result;
        } catch (error) {
            handleError(error, '分享播放列表');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 生成二维码URL
     * @param {string} url - 要生成二维码的URL
     * @returns {string} 二维码图片URL
     */
    generateQRCodeUrl(url) {
        const encodedUrl = encodeURIComponent(url);
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
    }

    /**
     * 获取用户信息
     * @returns {Promise<Object>} 用户信息
     */
    async getUserInfo() {
        try {
            if (!this.token) {
                return null;
            }

            const response = await this.makeRequest('/user');
            const user = await response.json();
            
            return {
                login: user.login,
                name: user.name,
                avatar_url: user.avatar_url,
                html_url: user.html_url
            };
        } catch (error) {
            console.warn('获取用户信息失败:', error);
            return null;
        }
    }

    /**
     * 测试GitHub连接
     * @returns {Promise<Object>} 测试结果
     */
    async testConnection() {
        try {
            if (!this.token) {
                return {
                    success: false,
                    error: '未设置GitHub Token'
                };
            }

            const user = await this.getUserInfo();
            if (user) {
                return {
                    success: true,
                    user: user,
                    message: `已连接到GitHub账户: ${user.login}`
                };
            } else {
                return {
                    success: false,
                    error: 'Token无效或权限不足'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 创建全局GitHub服务实例
export const githubService = new GitHubService();

// 导出便捷函数
export async function savePlaylistToGist(playlist, options) {
    return await githubService.savePlaylist(playlist, options);
}

export async function loadPlaylistFromGist(gistId) {
    return await githubService.loadPlaylist(gistId);
}

export async function sharePlaylist(playlist, options) {
    return await githubService.sharePlaylist(playlist, options);
}
