class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.gistId = null;
        this.init();
    }

    async init() {
        // 尝试从 URL 参数获取 gistId
        const urlParams = new URLSearchParams(window.location.search);
        this.gistId = urlParams.get('gist');
        
        if (this.gistId) {
            await this.loadFromGist(this.gistId);
        }
    }

    async createNewGist() {
        const token = localStorage.getItem('githubToken');
        if (!token) {
            alert('请先设置 GitHub Token！');
            return null;
        }

        const gistData = {
            description: "Video Playlist Data",
            public: true,
            files: {
                "playlist.json": {
                    content: JSON.stringify(this.playlist)
                }
            }
        };

        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                throw new Error('Failed to create Gist');
            }

            const data = await response.json();
            this.gistId = data.id;
            return this.gistId;
        } catch (error) {
            console.error('Failed to create Gist:', error);
            alert('创建 Gist 失败，请检查 GitHub Token 是否正确设置！');
            return null;
        }
    }

    async addVideo() {
        const titleInput = document.getElementById('videoTitle');
        const urlInput = document.getElementById('videoUrl');
        
        if (!titleInput.value || !urlInput.value) {
            alert('请输入视频标题和链接！');
            return;
        }

        this.playlist.push({ 
            title: titleInput.value, 
            url: urlInput.value 
        });

        // 如果没有 gistId，先创建新的 Gist
        if (!this.gistId) {
            this.gistId = await this.createNewGist();
            if (!this.gistId) return;
        } else {
            // 更新现有的 Gist
            await this.saveToGist(this.gistId);
        }

        titleInput.value = '';
        urlInput.value = '';
        this.renderPlaylist();
    }

    async addBatchVideos() {
        const batchInput = document.getElementById('batchInput');
        if (!batchInput.value) {
            alert('请输入批量添加的视频数据！');
            return;
        }

        const lines = batchInput.value.split('\n');
        for (const line of lines) {
            const [title, url] = line.split(',').map(item => item.trim());
            if (title && url) {
                this.playlist.push({ title, url });
            }
        }

        // 如果没有 gistId，先创建新的 Gist
        if (!this.gistId) {
            this.gistId = await this.createNewGist();
            if (!this.gistId) return;
        } else {
            // 更新现有的 Gist
            await this.saveToGist(this.gistId);
        }

        batchInput.value = '';
        this.renderPlaylist();
    }

    async saveToGist(gistId) {
        const token = localStorage.getItem('githubToken');
        if (!token) {
            alert('请先设置 GitHub Token！');
            return null;
        }

        const gistData = {
            files: {
                "playlist.json": {
                    content: JSON.stringify(this.playlist)
                }
            }
        };

        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                throw new Error('Failed to save to Gist');
            }

            return true;
        } catch (error) {
            console.error('Failed to save to Gist:', error);
            alert('保存到 Gist 失败，请检查 GitHub Token 是否正确设置！');
            return false;
        }
    }

    generatePlayerPage() {
        if (!this.gistId) {
            alert('请先添加视频到播放列表！');
            return;
        }
        window.location.href = `player.html?gist=${this.gistId}`;
    }

    async copyShareableLink() {
        if (!this.gistId) {
            alert('请先添加视频到播放列表！');
            return;
        }

        const url = `player.html?gist=${this.gistId}`;
        const fullUrl = new URL(url, window.location.href).href;
        
        try {
            await navigator.clipboard.writeText(fullUrl);
            alert('播放列表链接已复制到剪贴板！');
        } catch (err) {
            const tempInput = document.createElement('input');
            tempInput.value = fullUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            alert('播放列表链接已复制到剪贴板！');
        }
    }

    // ... 其他方法保持不变
}

// 初始化播放列表管理器
const playlistManager = new PlaylistManager();
