class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.gistId = null;
        this.checkGitHubToken();
        this.loadPlaylist();
    }

    checkGitHubToken() {
        const token = localStorage.getItem('githubToken');
        if (token) {
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

        // 验证 token 前缀
        if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            alert('请输入正确格式的 GitHub Token！\n应以 ghp_ 或 github_pat_ 开头');
            return;
        }

        // 验证 token 长度
        if (token.length < 30) {
            alert('Token 长度不正确，请检查！');
            return;
        }

        localStorage.setItem('githubToken', token);
        document.getElementById('githubToken').value = '';
        document.querySelector('.github-section').classList.add('token-set');
        document.querySelector('.token-hint').innerHTML = '✅ GitHub Token 已设置';
        alert('GitHub Token 已保存！');
    }

    loadPlaylist() {
        const savedPlaylist = localStorage.getItem('currentPlaylist');
        if (savedPlaylist) {
            try {
                this.playlist = JSON.parse(savedPlaylist);
                this.renderPlaylist();
                if (this.playlist.length > 0) {
                    document.getElementById('clearPlaylistBtn').style.display = 'flex';
                }
            } catch (e) {
                console.error('加载播放列表失败:', e);
                localStorage.removeItem('currentPlaylist');
            }
        }

        // 尝试从 URL 加载 gistId
        const urlParams = new URLSearchParams(window.location.search);
        this.gistId = urlParams.get('gist');
    }

    savePlaylist() {
        localStorage.setItem('currentPlaylist', JSON.stringify(this.playlist));
    }

    addVideo() {
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
        this.savePlaylist();

        document.getElementById('clearPlaylistBtn').style.display = 'flex';
    }

    addBatchVideos() {
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
        let addedCount = 0;

        for (const line of lines) {
            const [title, url] = line.split(',').map(item => item.trim());
            if (title && url) {
                this.playlist.push({ title, url });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            batchInput.value = '';
            this.renderPlaylist();
            this.savePlaylist();
            document.getElementById('clearPlaylistBtn').style.display = 'flex';
            alert(`成功添加 ${addedCount} 个视频！`);
        } else {
            alert('没有找到有效的视频数据，请检查格式！');
        }
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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`创建 Gist 失败: ${errorData.message}`);
            }

            const data = await response.json();
            this.gistId = data.id;

            // 转到播放器页面
            window.location.href = `player.html?gist=${this.gistId}`;
        } catch (error) {
            console.error('创建 Gist 失败:', error);
            alert(error.message || '创建播放列表失败，请检查 GitHub Token 是否正确！');
        }
    }

    clearPlaylist() {
        if (confirm('确定要清空当前播放列表吗？')) {
            this.playlist = [];
            this.savePlaylist();
            this.renderPlaylist();
            document.getElementById('clearPlaylistBtn').style.display = 'none';
        }
    }

    removeVideo(index) {
        this.playlist.splice(index, 1);
        this.savePlaylist();
        this.renderPlaylist();
        
        if (this.playlist.length === 0) {
            document.getElementById('clearPlaylistBtn').style.display = 'none';
        }
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
        playlistElement.innerHTML = '';
        
        if (this.playlist.length === 0) {
            playlistElement.innerHTML = '<div class="empty-playlist">播放列表为空，请添加视频</div>';
            return;
        }
        
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
}

// 初始化播放列表管理器
const playlistManager = new PlaylistManager();
