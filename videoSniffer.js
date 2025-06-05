/**
 * VideoSniffer 类
 * 用于检测和嗅探视频URL，尝试获取真实的可播放视频源
 */
class VideoSniffer {
    constructor() {
        // 支持的视频格式
        this.videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'm3u8', 'flv'];
        
        // 视频格式对应的MIME类型
        this.mimeTypes = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mov': 'video/quicktime',
            'm3u8': 'application/x-mpegURL',
            'flv': 'video/x-flv'
        };
    }    /**
     * 嗅探视频URL
     * @param {string} url - 要嗅探的URL
     * @returns {Promise<{url: string, type: string}>} - 返回视频URL和类型
     */
    async sniffVideoUrl(url) {
        try {
            // 简单检测常见的直接视频URL特征
            if (url.includes('.mp4') || url.includes('.m3u8') || url.includes('.flv') || url.includes('.webm')) {
                const extension = url.includes('.mp4') ? 'mp4' : 
                                 url.includes('.m3u8') ? 'm3u8' : 
                                 url.includes('.flv') ? 'flv' : 'webm';
                return { url, type: extension };
            }
            
            // 如果URL已经是常见视频格式，直接返回
            const extension = this.getExtensionFromUrl(url);
            if (extension && this.videoExtensions.includes(extension)) {
                return { url, type: extension };
            }
            
            // 对于特殊网站的处理
            if (url.includes('bilibili.com')) {
                return await this.handleBilibili(url);
            }
            
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                return await this.handleYouTube(url);
            }
            
            // 尝试直接访问URL并检查内容
            return await this.fetchAndCheckContent(url);
        } catch (error) {
            console.error('视频嗅探失败:', error);
            // 出错时返回原始URL，使用direct类型
            return { url, type: 'direct' };
        }
    }

    /**
     * 从URL中获取文件扩展名
     * @param {string} url - URL
     * @returns {string|null} - 文件扩展名或null
     */
    getExtensionFromUrl(url) {
        const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * 处理B站视频
     * @param {string} url - B站视频URL
     * @returns {Promise<{url: string, type: string}>} - 处理后的视频信息
     */
    async handleBilibili(url) {
        // B站视频在iframe中播放，直接返回处理后的嵌入URL
        const bvid = this.extractBilibiliId(url);
        if (bvid) {
            return { 
                url: `https://player.bilibili.com/player.html?bvid=${bvid}&page=1`, 
                type: 'iframe' 
            };
        }
        throw new Error('无法解析B站视频ID');
    }

    /**
     * 处理YouTube视频
     * @param {string} url - YouTube视频URL
     * @returns {Promise<{url: string, type: string}>} - 处理后的视频信息
     */
    async handleYouTube(url) {
        // YouTube视频使用iframe嵌入
        const videoId = this.extractYouTubeId(url);
        if (videoId) {
            return { 
                url: `https://www.youtube.com/embed/${videoId}`, 
                type: 'iframe' 
            };
        }
        throw new Error('无法解析YouTube视频ID');
    }

    /**
     * 提取B站视频ID
     * @param {string} url - B站视频URL
     * @returns {string|null} - 视频ID或null
     */
    extractBilibiliId(url) {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/([A-Za-z0-9]+)/);
        return match ? match[1] : null;
    }

    /**
     * 提取YouTube视频ID
     * @param {string} url - YouTube视频URL
     * @returns {string|null} - 视频ID或null
     */
    extractYouTubeId(url) {
        const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
        const match = url.match(regExp);
        return match && match[1].length === 11 ? match[1] : null;
    }

    /**
     * 获取并检查内容类型
     * @param {string} url - 要检查的URL
     * @returns {Promise<{url: string, type: string}>} - 视频信息
     */
    async fetchAndCheckContent(url) {
        try {
            // 因为可能存在跨域问题，嗅探可能在某些情况下失败
            // 这里我们尝试通过HEAD请求获取内容类型
            const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            
            // 如果无法获取内容类型信息，根据URL后缀尝试猜测类型
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.startsWith('video/')) {
                // 根据内容类型确定视频格式
                for (const [ext, mime] of Object.entries(this.mimeTypes)) {
                    if (contentType === mime) {
                        return { url, type: ext };
                    }
                }
                
                // 如果是视频但无法确定具体类型
                return { url, type: 'direct' };
            } 
            
            // 检查URL是否包含m3u8关键字（HLS流媒体）
            if (url.includes('.m3u8') || url.includes('m3u8')) {
                return { url, type: 'm3u8' };
            }
            
            // 检查URL是否包含flv关键字
            if (url.includes('.flv')) {
                return { url, type: 'flv' };
            }
            
            // 默认返回direct类型
            return { url, type: 'direct' };
        } catch (error) {
            console.error('获取内容类型失败:', error);
            // 出错时返回原始URL，使用direct类型
            return { url, type: 'direct' };
        }
    }

    /**
     * 从网页中提取视频源
     * 注意: 由于跨域限制，此方法在实际环境中可能无法获取外部网页内容
     * @param {string} url - 网页URL
     * @returns {Promise<{url: string, type: string}[]>} - 找到的视频源列表
     */
    async extractVideoSourcesFromPage(url) {
        try {
            // 创建一个隐藏的iframe来加载页面
            // 注意：这种方法在跨域情况下通常会失败
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;
            
            document.body.appendChild(iframe);
            
            // 等待iframe加载完成
            await new Promise((resolve) => {
                iframe.onload = resolve;
                // 设置超时防止无限等待
                setTimeout(resolve, 5000);
            });
            
            // 尝试访问iframe内容
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                
                // 查找video标签
                const videoTags = iframeDoc.querySelectorAll('video source');
                const videoSources = [];
                
                videoTags.forEach(source => {
                    if (source.src) {
                        const ext = this.getExtensionFromUrl(source.src);
                        videoSources.push({
                            url: source.src,
                            type: this.videoExtensions.includes(ext) ? ext : 'direct'
                        });
                    }
                });
                
                // 移除iframe
                document.body.removeChild(iframe);
                
                if (videoSources.length > 0) {
                    return videoSources[0]; // 返回第一个找到的视频源
                }
            } catch (e) {
                console.error('无法访问iframe内容（跨域限制）:', e);
                // 移除iframe
                document.body.removeChild(iframe);
            }
            
            // 如果找不到视频源，返回原始URL
            return { url, type: 'direct' };
        } catch (error) {
            console.error('从页面提取视频源失败:', error);
            return { url, type: 'direct' };
        }
    }
}
