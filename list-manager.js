class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.loadPlaylist();
    }

    async loadPlaylist() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist') || localStorage.getItem('playlistGistId');

        if (gistId) {
            try {
                await this.loadFromGist(gistId);
            } catch (error) {
                console.error('Failed to load from Gist:', error);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('videoPlaylist');
        this.playlist = saved ? JSON.parse(saved) : [];
        this.renderPlaylist();
    }

    async loadFromGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch Gist');
            }
            const data = await response.json();
            const content = data.files['playlist.json'].content;
            this.playlist = JSON.parse(content);
            localStorage.setItem('playlistGistId', gistId);
            this.saveToLocalStorage();
            this.renderPlaylist();
        } catch (error) {
            console.error('Failed to load playlist from Gist:', error);
            throw error;
        }
    }

    async saveToGist() {
        const token = localStorage.getItem('githubToken');
        if (!token) {
            alert('请先设置 GitHub Token！');
            return;
        }

        const gistId = localStorage.getItem('playlistGistId');
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
            let response;
            let url;

            if (gistId) {
                response = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
                url = `player.html?gist=${gistId}`;
            } else {
                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
                const data = await response.json();
                localStorage.setItem('playlistGistId', data.id);
                url = `player.html?gist=${data.id}`;
            }

            if (!response.ok) {
                throw new Error('Failed to save to Gist');
            }

            return url;
        } catch (error) {
            console.error('Failed to save playlist to Gist:', error);
            throw error;
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('videoPlaylist', JSON.stringify(this.playlist));
    }

    async addVideo() {
        const titleInput = document.getElementById('videoTitle');
        const urlInput = document.getElementById('videoUrl');
        
        if (titleInput.value && urlInput.value) {
            this.playlist.push({ 
                title: titleInput.value, 
                url: urlInput.value 
            });
            this.saveToLocalStorage();
            this.renderPlaylist();
            
            try {
                await this.saveToGist();
                titleInput.value = '';
                urlInput.value = '';
            } catch (error) {
                console.error('Failed to save to Gist:', error);
                alert('保存到 Gist 失败，请检查 GitHub Token 是否正确设置！');
            }
        } else {
            alert('请输入视频标题和链接！');
        }
    }

    async addBatchVideos() {
        const batchInput = document.getElementById('batchInput');
        if (batchInput.value) {
            const lines = batchInput.value.split('\n');
            for (const line of lines) {
                const [title, url] = line.split(',').map(item => item.trim());
                if (title && url) {
                    this.playlist.push({ title, url });
                }
            }
            this.saveToLocalStorage();
            this.renderPlaylist();
            
            try {
                await this.saveToGist();
                batchInput.value = '';
            } catch (error) {
                console.error('Failed to save to Gist:', error);
                alert('保存到 Gist 失败，请检查 GitHub Token 是否正确设置！');
            }
        } else {
            alert('请输入批量添加的视频数据！');
        }
    }

    async removeVideo(index) {
        this.playlist.splice(index, 1);
        this.saveToLocalStorage();
        this.renderPlaylist();
        try {
            await this.saveToGist();
        } catch (error) {
            console.error('Failed to save to Gist:', error);
        }
    }

    async clearPlaylist() {
        if (confirm('确定要清空整个播放列表吗？此操作无法撤销。')) {
            this.playlist = [];
            this.saveToLocalStorage();
            this.renderPlaylist();
            try {
                await this.saveToGist();
            } catch (error) {
                console.error('Failed to save to Gist:', error);
            }
        }
    }

        renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
        const clearButton = document.getElementById('clearPlaylistBtn');
        
        playlistElement.innerHTML = '';
        
        this.playlist.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.innerHTML = `
                <div class="playlist-item-content">
                    <i class="material-icons">play_circle_outline</i>
                    <span>${video.title}</span>
                </div>
                <button class="delete-button" onclick="playlistManager.removeVideo(${index})">
                    <i class="material-icons">delete</i>
                </button>
            `;
            playlistElement.appendChild(item);
        });

        if (clearButton) {
            clearButton.style.display = this.playlist.length > 0 ? 'flex' : 'none';
        }
    }

    async generatePlayerPage() {
        try {
            const url = await this.saveToGist();
            window.open(url, '_blank');
        } catch (error) {
            alert('生成播放页面失败，请确认 GitHub Token 是否正确设置！');
        }
    }

    async copyShareableLink() {
        try {
            const url = await this.saveToGist();
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
        } catch (error) {
            alert('生成分享链接失败，请确认 GitHub Token 是否正确设置！');
        }
    }

    saveGitHubToken() {
        const token = document.getElementById('githubToken').value;
        if (token) {
            localStorage.setItem('githubToken', token);
            alert('GitHub Token 已保存！');
            document.getElementById('githubToken').value = '';
        } else {
            alert('请输入 GitHub Token！');
        }
    }
}

// 初始化播放列表管理器
const playlistManager = new PlaylistManager();
