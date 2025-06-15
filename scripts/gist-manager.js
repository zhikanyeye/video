// 视频分享管理器 - 使用自建后端服务
class ShareManager {
    constructor() {
        this.apiUrl = window.location.origin + '/api';
        this.baseUrl = window.location.origin;
    }

    // 创建分享链接
    async createShare(videoData, title = '', description = '') {
        try {
            const shareData = {
                title: title || `播放列表 - ${new Date().toLocaleString()}`,
                description: description,
                videos: videoData
            };

            const response = await fetch(`${this.apiUrl}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shareData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `创建分享失败: ${response.status}`);
            }

            const result = await response.json();
            return {
                shareId: result.shareId,
                shareUrl: result.shareUrl,
                title: result.title,
                videoCount: result.videoCount
            };

        } catch (error) {
            console.error('创建分享失败:', error);
            throw error;
        }
    }

    // 从分享ID加载视频数据
    async loadFromShare(shareId) {
        try {
            const response = await fetch(`${this.apiUrl}/playlist/${shareId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('分享链接不存在或已失效');
                }
                const errorData = await response.json();
                throw new Error(errorData.error || `加载分享数据失败: ${response.status}`);
            }

            const playlistData = await response.json();
            return playlistData;

        } catch (error) {
            console.error('从分享链接加载数据失败:', error);
            throw error;
        }
    }

    // 生成分享链接
    generateShareUrl(shareId) {
        return `${this.baseUrl}/player.html?share=${shareId}`;
    }

    // 解析URL中的share参数
    getShareIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('share');
    }

    // 获取分享统计信息
    async getShareStats(shareId) {
        try {
            const response = await fetch(`${this.apiUrl}/stats/${shareId}`);
            
            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('获取分享统计失败:', error);
            return null;
        }
    }

    // 生成二维码
    generateQRCode(url) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    }

    // 验证分享ID格式
    isValidShareId(shareId) {
        return /^[a-f0-9]{12}$/i.test(shareId);
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShareManager;
} else {
    window.ShareManager = ShareManager;
}
