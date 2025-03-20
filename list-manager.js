class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.gistId = null;
        this.checkGitHubToken();
    }

    checkGitHubToken() {
        const token = localStorage.getItem('githubToken');
        if (token) {
            // Token 存在，更新 UI 状态
            document.querySelector('.github-section').classList.add('token-set');
            document.getElementById('githubToken').value = '';
            document.querySelector('.token-hint').innerHTML = '✅ GitHub Token 已设置';
        }
    }

    saveGitHubToken() {
        const token = document.getElementById('githubToken').value;
        if (!token) {
            alert('请输入 GitHub Token！');
            return;
        }

        // 验证 token 格式
        if (!/^ghp_[a-zA-Z0-9]{36}$/.test(token)) {
            alert('请输入正确格式的 GitHub Token！');
            return;
        }

        localStorage.setItem('githubToken', token);
        document.getElementById('githubToken').value = '';
        document.querySelector('.github-section').classList.add('token-set');
        document.querySelector('.token-hint').innerHTML = '✅ GitHub Token 已设置';
        alert('GitHub Token 已保存！');
    }

    async addVideo() {
        const token = localStorage.getItem('githubToken');
        if (!token) {
            alert('请先设置 GitHub Token！');
            return;
        }

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

        titleInput.value = '';
        urlInput.value = '';
        this.renderPlaylist();

        // 显示清空按钮
        document.getElementById('clearPlaylistBtn').style.display = 'flex';
    }

    async addBatchVideos() {
        const token = localStorage.getItem('githubToken');
        if (!token) {
            alert('请先设置 GitHub Token！');
            return;
        }

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

        batchInput.value = '';
        this.renderPlaylist();

        // 显示清空按钮
        document.getElementById('clearPlaylistBtn').style.display = 'flex';
    }

    async generatePlayerPage() {
        if (this.playlist.length === 0) {
            alert('请先添加视频到播放列表！');
            return;
        }

        const token = localStorage.getItem('githubToken');
        if (!token) {
            alert('请先设置 GitHub Token！');
            return;
        }

        try {
            // 创建新的 Gist
            const gistData = {
                description: "Video Playlist Data",
                public: true,
                files: {
                    "playlist.json": {
                        content: JSON.stringify(this.playlist)
                    }
                }
            };

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

            // 转到播放器页面
            window.location.href = `player.html?gist=${this.gistId}`;
        } catch (error) {
            console.error('Failed to create Gist:', error);
            alert('创建播放列表失败，请检查 GitHub Token 是否正确！');
        }
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
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
    }

    removeVideo(index) {
        this.playlist.splice(index, 1);
        this.renderPlaylist();
        
        // 如果列表为空，隐藏清空按钮
        if (this.playlist.length === 0) {
            document.getElementById('clearPlaylistBtn').style.display = 'none';
        }
    }

    clearPlaylist() {
        if (confirm('确定要清空整个播放列表吗？此操作无法撤销。')) {
            this.playlist = [];
            this.renderPlaylist();
            document.getElementById('clearPlaylistBtn').style.display = 'none';
        }
    }
}

// 初始化播放列表管理器
const playlistManager = new PlaylistManager();
