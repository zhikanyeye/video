class VideoSniffer {
    constructor() {
        this.videoPatterns = {
            direct: /\.(mp4|m3u8|flv)($|\?)/i,
            m3u8: /(http[s]?:)?\/\/[^"]*\.m3u8([^"]*)/i,
            mp4: /(http[s]?:)?\/\/[^"]*\.mp4([^"]*)/i,
            video: /(?:video|source|iframe)[^>]*src=["']([^"']+)["']/gi
        };
    }

    async sniffVideoUrl(url) {
        try {
            // 首先检查是否是直接视频链接
            if (this.isDirectVideoUrl(url)) {
                return {
                    type: this.getVideoType(url),
                    url: url
                };
            }

            // 尝试获取页面内容
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const html = await response.text();

            // 搜索页面中的视频链接
            const videoUrls = this.extractVideoUrls(html);
            
            if (videoUrls.length > 0) {
                // 返回找到的第一个视频链接
                return {
                    type: this.getVideoType(videoUrls[0]),
                    url: videoUrls[0]
                };
            }

            throw new Error('No video found');
        } catch (error) {
            console.error('Video sniffing failed:', error);
            throw error;
        }
    }

    isDirectVideoUrl(url) {
        return Object.values(this.videoPatterns).some(pattern => 
            pattern.test(url));
    }

    getVideoType(url) {
        if (url.match(/\.m3u8/i)) return 'm3u8';
        if (url.match(/\.flv/i)) return 'flv';
        return 'mp4';
    }

    extractVideoUrls(html) {
        const urls = new Set();
        
        // 查找所有可能的视频URL
        Object.values(this.videoPatterns).forEach(pattern => {
            const matches = html.matchAll(pattern);
            for (const match of matches) {
                const url = match[1] || match[0];
                if (url && !url.includes('data:')) {
                    urls.add(url);
                }
            }
        });

        return Array.from(urls);
    }
}
