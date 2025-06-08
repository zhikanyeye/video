/**
 * 视频检测模块
 * 增强的视频URL检测和解析功能
 */

import { isValidUrl, handleError } from './utils.js';

// 支持的视频类型
export const VIDEO_TYPES = {
    MP4: 'mp4',
    M3U8: 'm3u8',
    FLV: 'flv',
    WEBM: 'webm',
    BILIBILI: 'bilibili',
    YOUTUBE: 'youtube',
    UNKNOWN: 'unknown'
};

// 视频类型检测规则
const VIDEO_PATTERNS = {
    // 直接视频文件
    [VIDEO_TYPES.MP4]: [
        /\.mp4(\?.*)?$/i,
        /\.mov(\?.*)?$/i,
        /\.avi(\?.*)?$/i
    ],
    [VIDEO_TYPES.M3U8]: [
        /\.m3u8(\?.*)?$/i,
        /\/playlist\.m3u8/i,
        /hls.*\.m3u8/i
    ],
    [VIDEO_TYPES.FLV]: [
        /\.flv(\?.*)?$/i,
        /\/live.*\.flv/i
    ],
    [VIDEO_TYPES.WEBM]: [
        /\.webm(\?.*)?$/i,
        /\.ogv(\?.*)?$/i
    ],
    
    // 平台视频
    [VIDEO_TYPES.BILIBILI]: [
        /(?:www\.)?bilibili\.com\/video\/[Bb][Vv]/i,
        /(?:www\.)?bilibili\.com\/s\/video\/[Bb][Vv]/i,
        /b23\.tv\/[a-zA-Z0-9]+/i
    ],
    [VIDEO_TYPES.YOUTUBE]: [
        /(?:www\.)?youtube\.com\/watch\?v=/i,
        /(?:www\.)?youtube\.com\/embed\//i,
        /youtu\.be\//i,
        /(?:www\.)?youtube\.com\/v\//i
    ]
};

// 视频信息提取器
export class VideoDetector {
    constructor() {
        this.cache = new Map();
    }

    /**
     * 检测视频类型
     * @param {string} url - 视频URL
     * @returns {string} 视频类型
     */
    detectType(url) {
        if (!url || !isValidUrl(url)) {
            return VIDEO_TYPES.UNKNOWN;
        }

        // 检查缓存
        if (this.cache.has(url)) {
            return this.cache.get(url).type;
        }

        for (const [type, patterns] of Object.entries(VIDEO_PATTERNS)) {
            if (patterns.some(pattern => pattern.test(url))) {
                this.cache.set(url, { type, detectedAt: Date.now() });
                return type;
            }
        }

        return VIDEO_TYPES.UNKNOWN;
    }

    /**
     * 解析视频信息
     * @param {string} url - 视频URL
     * @returns {Promise<Object>} 视频信息
     */
    async parseVideoInfo(url) {
        try {
            const type = this.detectType(url);
            const info = {
                url,
                type,
                title: '',
                duration: 0,
                thumbnail: '',
                description: ''
            };

            switch (type) {
                case VIDEO_TYPES.BILIBILI:
                    return await this.parseBilibiliInfo(url, info);
                case VIDEO_TYPES.YOUTUBE:
                    return await this.parseYouTubeInfo(url, info);
                default:
                    return await this.parseGenericInfo(url, info);
            }
        } catch (error) {
            handleError(error, '解析视频信息');
            return {
                url,
                type: VIDEO_TYPES.UNKNOWN,
                title: this.extractTitleFromUrl(url),
                duration: 0,
                thumbnail: '',
                description: ''
            };
        }
    }

    /**
     * 解析哔哩哔哩视频信息
     * @param {string} url - B站视频URL
     * @param {Object} info - 基础信息对象
     * @returns {Promise<Object>} 解析后的视频信息
     */
    async parseBilibiliInfo(url, info) {
        try {
            // 提取BV号或AV号
            const bvMatch = url.match(/[Bb][Vv]([a-zA-Z0-9]+)/);
            const avMatch = url.match(/av(\d+)/i);
            
            if (bvMatch) {
                info.id = `BV${bvMatch[1]}`;
                info.title = `B站视频 ${info.id}`;
            } else if (avMatch) {
                info.id = `av${avMatch[1]}`;
                info.title = `B站视频 ${info.id}`;
            } else {
                info.title = '哔哩哔哩视频';
            }

            // 尝试从页面标题获取更多信息（如果在同源环境中）
            try {
                const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${info.id}`, {
                    method: 'GET',
                    mode: 'cors'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.code === 0 && data.data) {
                        info.title = data.data.title || info.title;
                        info.duration = data.data.duration || 0;
                        info.description = data.data.desc || '';
                        info.thumbnail = data.data.pic || '';
                    }
                }
            } catch (apiError) {
                // API调用失败，使用默认信息
                console.warn('无法获取B站视频详细信息:', apiError);
            }

            return info;
        } catch (error) {
            handleError(error, '解析B站视频');
            return info;
        }
    }

    /**
     * 解析YouTube视频信息
     * @param {string} url - YouTube视频URL
     * @param {Object} info - 基础信息对象
     * @returns {Promise<Object>} 解析后的视频信息
     */
    async parseYouTubeInfo(url, info) {
        try {
            // 提取视频ID
            const videoIdMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            
            if (videoIdMatch) {
                info.id = videoIdMatch[1];
                info.title = `YouTube视频 ${info.id}`;
                info.thumbnail = `https://img.youtube.com/vi/${info.id}/maxresdefault.jpg`;
            } else {
                info.title = 'YouTube视频';
            }

            return info;
        } catch (error) {
            handleError(error, '解析YouTube视频');
            return info;
        }
    }

    /**
     * 解析通用视频信息
     * @param {string} url - 视频URL
     * @param {Object} info - 基础信息对象
     * @returns {Promise<Object>} 解析后的视频信息
     */
    async parseGenericInfo(url, info) {
        try {
            info.title = this.extractTitleFromUrl(url);
            
            // 对于直接的视频文件，尝试获取一些基本信息
            if (info.type !== VIDEO_TYPES.UNKNOWN) {
                try {
                    // 创建一个临时的video元素来获取元数据
                    const video = document.createElement('video');
                    video.crossOrigin = 'anonymous';
                    video.preload = 'metadata';
                    
                    const loadPromise = new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('加载超时')), 5000);
                        
                        video.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeout);
                            resolve({
                                duration: video.duration || 0,
                                width: video.videoWidth || 0,
                                height: video.videoHeight || 0
                            });
                        });
                        
                        video.addEventListener('error', () => {
                            clearTimeout(timeout);
                            reject(new Error('无法加载视频元数据'));
                        });
                    });
                    
                    video.src = url;
                    const metadata = await loadPromise;
                    
                    info.duration = metadata.duration;
                    info.resolution = metadata.width && metadata.height ? 
                        `${metadata.width}x${metadata.height}` : '';
                    
                } catch (metadataError) {
                    // 无法获取元数据，继续使用基本信息
                    console.warn('无法获取视频元数据:', metadataError);
                }
            }

            return info;
        } catch (error) {
            handleError(error, '解析通用视频');
            return info;
        }
    }

    /**
     * 从URL提取标题
     * @param {string} url - 视频URL
     * @returns {string} 提取的标题
     */
    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            
            // 提取文件名（去除扩展名）
            const filename = pathname.split('/').pop();
            if (filename) {
                const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
                if (nameWithoutExt.length > 0) {
                    return decodeURIComponent(nameWithoutExt);
                }
            }
            
            // 如果无法从路径提取，使用域名
            return `${urlObj.hostname} 视频`;
        } catch (error) {
            return '未知视频';
        }
    }

    /**
     * 批量检测视频
     * @param {Array<string>} urls - 视频URL数组
     * @returns {Promise<Array<Object>>} 批量检测结果
     */
    async batchDetect(urls) {
        const results = [];
        const batchSize = 5; // 限制并发数量
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchPromises = batch.map(url => this.parseVideoInfo(url));
            
            try {
                const batchResults = await Promise.allSettled(batchPromises);
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    } else {
                        results.push({
                            url: batch[index],
                            type: VIDEO_TYPES.UNKNOWN,
                            title: this.extractTitleFromUrl(batch[index]),
                            error: result.reason.message
                        });
                    }
                });
            } catch (error) {
                handleError(error, '批量检测视频');
            }
        }
        
        return results;
    }

    /**
     * 验证视频URL是否可访问
     * @param {string} url - 视频URL
     * @returns {Promise<boolean>} 是否可访问
     */
    async validateUrl(url) {
        try {
            if (!isValidUrl(url)) {
                return false;
            }

            const type = this.detectType(url);
            
            // 对于已知的平台，直接返回true（由平台处理可访问性）
            if ([VIDEO_TYPES.BILIBILI, VIDEO_TYPES.YOUTUBE].includes(type)) {
                return true;
            }

            // 对于直接的视频文件，尝试HEAD请求
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(url, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                return true; // 如果没有抛出错误，认为URL可访问
            } catch (fetchError) {
                // HEAD请求失败，可能是CORS限制，但不意味着视频不可播放
                return true;
            }
        } catch (error) {
            console.warn('URL验证失败:', error);
            return false;
        }
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * 获取缓存统计
     * @returns {Object} 缓存统计信息
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// 创建全局视频检测器实例
export const videoDetector = new VideoDetector();

/**
 * 便捷函数：检测单个视频类型
 * @param {string} url - 视频URL
 * @returns {string} 视频类型
 */
export function detectVideoType(url) {
    return videoDetector.detectType(url);
}

/**
 * 便捷函数：解析单个视频信息
 * @param {string} url - 视频URL
 * @returns {Promise<Object>} 视频信息
 */
export function parseVideoInfo(url) {
    return videoDetector.parseVideoInfo(url);
}

/**
 * 便捷函数：验证视频URL
 * @param {string} url - 视频URL
 * @returns {Promise<boolean>} 是否有效
 */
export function validateVideoUrl(url) {
    return videoDetector.validateUrl(url);
}

// 导出视频类型常量
export { VIDEO_TYPES as VideoTypes };
