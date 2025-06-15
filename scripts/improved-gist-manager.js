// 改进的Gist管理器 - 支持用户授权
class ImprovedGistManager {
    constructor() {
        this.authManager = new GitHubAuthManager();
        this.baseUrl = 'https://api.github.com/gists';
    }

    // 检查是否可以分享（需要授权）
    canShare() {
        return this.authManager.isAuthenticated();
    }

    // 分享播放列表到Gist
    async sharePlaylist(videos, title = '青云播视频播放列表', description = '') {
        if (!this.canShare()) {
            this.authManager.showAuthGuide();
            return null;
        }

        try {
            const gistData = {
                description: description || `${title} - 共${videos.length}个视频`,
                public: true,
                files: {
                    "playlist.json": {
                        content: JSON.stringify({
                            title,
                            description,
                            created: new Date().toISOString(),
                            videos: videos,
                            player_url: window.location.origin + '/player.html'
                        }, null, 2)
                    },
                    "README.md": {
                        content: this.generateReadme(title, description, videos)
                    }
                }
            };

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.authManager.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '分享失败');
            }

            const gist = await response.json();
            
            return {
                id: gist.id,
                url: gist.html_url,
                shareUrl: `${window.location.origin}/player.html?gist=${gist.id}`,
                rawUrl: gist.files['playlist.json'].raw_url
            };
        } catch (error) {
            console.error('分享失败:', error);
            throw error;
        }
    }

    // 从Gist加载播放列表（无需授权）
    async loadPlaylist(gistId) {
        try {
            const response = await fetch(`${this.baseUrl}/${gistId}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('加载失败，请检查分享链接是否正确');
            }

            const gist = await response.json();
            const playlistFile = gist.files['playlist.json'];
            
            if (!playlistFile) {
                throw new Error('无效的播放列表格式');
            }

            const playlist = JSON.parse(playlistFile.content);
            return playlist;
        } catch (error) {
            console.error('加载播放列表失败:', error);
            throw error;
        }
    }

    // 更新现有Gist（需要授权）
    async updatePlaylist(gistId, videos, title, description) {
        if (!this.canShare()) {
            throw new Error('需要GitHub授权才能更新播放列表');
        }

        try {
            const gistData = {
                description: `${title} - 共${videos.length}个视频`,
                files: {
                    "playlist.json": {
                        content: JSON.stringify({
                            title,
                            description,
                            updated: new Date().toISOString(),
                            videos: videos,
                            player_url: window.location.origin + '/player.html'
                        }, null, 2)
                    },
                    "README.md": {
                        content: this.generateReadme(title, description, videos)
                    }
                }
            };

            const response = await fetch(`${this.baseUrl}/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.authManager.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '更新失败');
            }

            return await response.json();
        } catch (error) {
            console.error('更新播放列表失败:', error);
            throw error;
        }
    }

    // 生成README文档
    generateReadme(title, description, videos) {
        const playerUrl = window.location.origin + '/player.html';
        
        return `# ${title}

${description ? description + '\n' : ''}
**创建时间**: ${new Date().toLocaleString('zh-CN')}
**视频数量**: ${videos.length}

## 🎬 视频列表

${videos.map((video, index) => 
    `${index + 1}. **${video.title}**\n   ${video.url}\n`
).join('\n')}

## 🚀 如何播放

1. **在线播放**: [点击这里直接播放](${playerUrl}?gist=${this.lastGistId})
2. **手动播放**: 复制上方视频链接到青云播放器

---
*由青云播生成 - ${window.location.origin}*`;
    }

    // 获取用户的所有播放列表Gists
    async getUserPlaylists() {
        if (!this.canShare()) {
            return [];
        }

        try {
            const user = this.authManager.getUser();
            const response = await fetch(`https://api.github.com/users/${user.login}/gists`, {
                headers: {
                    'Authorization': `token ${this.authManager.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('获取播放列表失败');
            }

            const gists = await response.json();
            
            // 过滤出包含playlist.json的Gist
            return gists.filter(gist => 
                gist.files['playlist.json'] && 
                gist.description.includes('青云播') || gist.description.includes('播放列表')
            ).map(gist => ({
                id: gist.id,
                title: gist.description,
                url: gist.html_url,
                shareUrl: `${window.location.origin}/player.html?gist=${gist.id}`,
                created: gist.created_at,
                updated: gist.updated_at
            }));
        } catch (error) {
            console.error('获取用户播放列表失败:', error);
            return [];
        }
    }
}

// 全局实例
const improvedGistManager = new ImprovedGistManager();
