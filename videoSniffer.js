/**
 * VideoSniffer 类
 * 用于检测和嗅探视频URL，尝试获取真实的可播放视频源
 * 重构版本：增强对直连视频格式的支持
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
    }

    /**
     * 嗅探视频URL
     * @param {string} url - 要嗅探的URL
     * @returns {Promise<{url: string, type: string}>} - 返回视频URL和类型
     */
    async sniffVideoUrl(url) {
        try {
            console.log('开始嗅探视频URL:', url);
            
            // 直连视频格式检测 - 最高优先级
            // 通过URL中的扩展名或关键字直接判断视频类型
            if (url.includes('.mp4') || url.endsWith('mp4')) {
                console.log('直接检测到MP4视频');
                return { url, type: 'mp4' };
            }
            if (url.includes('.m3u8') || url.endsWith('m3u8')) {
                console.log('直接检测到M3U8视频流');
                return { url, type: 'm3u8' };
            }
            if (url.includes('.flv') || url.endsWith('flv')) {
                console.log('直接检测到FLV视频');
                return { url, type: 'flv' };
            }
            if (url.includes('.webm') || url.endsWith('webm')) {
                console.log('直接检测到WebM视频');
                return { url, type: 'webm' };
            }
            
            // 特殊网站处理
            if (url.includes('bilibili.com')) {
                console.log('检测到B站链接');
                return this.handleBilibili(url);
            }
            
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                console.log('检测到YouTube链接');
                return this.handleYouTube(url);
            }
            
            // 尝试从URL获取扩展名
            const extension = this.getExtensionFromUrl(url);
            if (extension && this.videoExtensions.includes(extension)) {
                console.log(`通过URL扩展名检测到${extension}视频`);
                return { url, type: extension };
            }

            // 默认返回direct类型，由播放器自动判断
            console.log('无法确定视频类型，使用direct类型');
            return { url, type: 'direct' };
        } catch (error) {
            console.error('视频嗅探出错:', error);
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
        try {
            // 尝试解析URL
            const parsedUrl = new URL(url);
            // 从路径中提取扩展名
            const match = parsedUrl.pathname.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            return match ? match[1].toLowerCase() : null;
        } catch (e) {
            // 如果URL无效，尝试简单匹配
            const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            return match ? match[1].toLowerCase() : null;
        }
    }

    /**
     * 处理B站视频
     * @param {string} url - B站视频URL
     * @returns {{url: string, type: string}} - 处理后的视频信息
     */
    handleBilibili(url) {
        // B站视频在iframe中播放，直接返回处理后的嵌入URL
        const bvid = this.extractBilibiliId(url);
        if (bvid) {
            return { 
                url: `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0`,
                type: 'iframe' 
            };
        }
        console.warn('无法解析B站视频ID');
        return { url, type: 'iframe' };
    }

    /**
     * 处理YouTube视频
     * @param {string} url - YouTube视频URL
     * @returns {{url: string, type: string}} - 处理后的视频信息
     */
    handleYouTube(url) {
        // YouTube视频使用iframe嵌入
        const videoId = this.extractYouTubeId(url);
        if (videoId) {
            return { 
                url: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
                type: 'iframe' 
            };
        }
        console.warn('无法解析YouTube视频ID');
        return { url, type: 'iframe' };
    }

    /**
     * 提取B站视频ID
     * @param {string} url - B站视频URL
     * @returns {string|null} - 视频ID或null
     */
    extractBilibiliId(url) {
        const bvMatch = url.match(/(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/([A-Za-z0-9]+)/);
        if (bvMatch) return bvMatch[1];
        
        // 尝试提取BV号
        const bvPattern = /BV([A-Za-z0-9]+)/;
        const bvResult = url.match(bvPattern);
        if (bvResult) return `BV${bvResult[1]}`;
        
        return null;
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
}
