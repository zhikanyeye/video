class VideoPlayer {
    constructor() {
        this.player = document.getElementById('player');
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.tempIndex = null;
        this.isFullscreen = false;
        this.loadPlaylist();
        this.setupEventListeners();
    }

    async loadPlaylist() {
        // 从 URL 获取 Gist ID
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist');

        if (gistId) {
            try {
                await this.loadFromGist(gistId);
                // 如果有播放列表，自动播放第一个视频
                if (this.playlist.length > 0) {
                    this.play(0);
                }
            } catch (error) {
                console.error('Failed to load playlist:', error);
                this.showError('加载播放列表失败，请检查链接是否正确！');
            }
        } else {
            this.showError('未找到播放列表，请检查链接是否正确！');
        }
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
            this.renderPlaylist();
        } catch (error) {
            console.error('Failed to load from Gist:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // 侧边栏切换按钮
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // 显示侧边栏按钮
        document.getElementById('showSidebar').addEventListener('click', () => {
            this.showSidebar();
        });

        // 上一个视频
        document.getElementById('prevVideo').addEventListener('click', () => {
            if (this.currentVideoIndex > 0) {
                this.play(this.currentVideoIndex - 1);
            }
        });

        // 下一个视频
        document.getElementById('nextVideo').addEventListener('click', () => {
            if (this.currentVideoIndex < this.playlist.length - 1) {
                this.play(this.currentVideoIndex + 1);
            }
        });

        // 全屏切换
        document.getElementById('toggleFullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 键盘控制
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    document.getElementById('prevVideo').click();
                    break;
                case 'ArrowRight':
                    document.getElementById('nextVideo').click();
                    break;
                case 'f':
                    this.toggleFullscreen();
                    break;
                case 'Escape':
                    if (this.isFullscreen) {
                        this.exitFullscreen();
                    }
                    break;
            }
        });

        // 监听全屏变化
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
        });
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const icon = document.querySelector('#toggleSidebar i');
        const isMobile = this.isMobileDevice();
        
        sidebar.classList.toggle('collapsed');
        
        // 根据设备类型和侧边栏状态更新图标
        if (isMobile) {
            icon.textContent = sidebar.classList.contains('collapsed') ? 'menu' : 'close';
        } else {
            icon.textContent = sidebar.classList.contains('collapsed') ? 'chevron_right' : 'chevron_left';
        }

        // 仅在桌面端自动全屏
        if (!isMobile && sidebar.classList.contains('collapsed') && !this.isFullscreen) {
            setTimeout(() => {
                this.enterFullscreen();
            }, 300);
        }
    }

    showSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const icon = document.querySelector('#toggleSidebar i');
        const isMobile = this.isMobileDevice();
        
        sidebar.classList.remove('collapsed');
        icon.textContent = isMobile ? 'close' : 'chevron_left';

        // 仅在桌面端退出全屏
        if (!isMobile && this.isFullscreen) {
            this.exitFullscreen();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();
        } else if (videoContainer.mozRequestFullScreen) {
            videoContainer.mozRequestFullScreen();
        } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();
        } else if (videoContainer.msRequestFullscreen) {
            videoContainer.msRequestFullscreen();
        }
        this.isFullscreen = true;
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        this.isFullscreen = false;
    }

    isMobileDevice() {
        return window.innerWidth <= 768;
    }

    showError(message) {
        this.player.innerHTML = `
            <div class="no-video">
                <i class="material-icons">error_outline</i>
                <p>${message}</p>
            </div>
        `;
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            const video = this.playlist[index];
            this.currentVideoIndex = index;
            let embedCode = this.createEmbedCode(video.url);
            this.player.innerHTML = embedCode;
            this.updateActiveItem();
            this.updateVideoTitle(video.title);
            this.updateNavigationButtons();
        }
    }

    updateVideoTitle(title) {
        document.getElementById('currentVideoTitle').textContent = title;
    }

    updateNavigationButtons() {
        document.getElementById('prevVideo').disabled = this.currentVideoIndex <= 0;
        document.getElementById('nextVideo').disabled = this.currentVideoIndex >= this.playlist.length - 1;
    }

    createEmbedCode(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = this.getYouTubeVideoId(url);
            return `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
        } else if (url.includes('bilibili.com')) {
            let bvid = this.getBilibiliVideoId(url);
            return `<iframe src="//player.bilibili.com/player.html?bvid=${bvid}" allowfullscreen></iframe>`;
        } else {
            return `<video src="${url}" controls autoplay></video>`;
        }
    }

    getYouTubeVideoId(url) {
        let videoId = '';
        let match = url.match(/[?&]v=([^&]+)/);
        if (match) {
            videoId = match[1];
        } else {
            match = url.match(/youtu\.be\/([^?]+)/);
            if (match) {
                videoId = match[1];
            }
        }
        return videoId;
    }

    getBilibiliVideoId(url) {
        let match = url.match(/BV\w+/);
        return match ? match[0] : '';
    }

    updateActiveItem() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            if (index === this.currentVideoIndex) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playerPlaylist');
        playlistElement.innerHTML = '';
        
        this.playlist.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item${index === this.currentVideoIndex ? ' active' : ''}`;
            item.innerHTML = `
                <div class="playlist-item-content" onclick="videoPlayer.play(${index})">
                    <i class="material-icons">${index === this.currentVideoIndex ? 'play_arrow' : 'play_circle_outline'}</i>
                    <span>${video.title}</span>
                </div>
            `;
            playlistElement.appendChild(item);
        });

        // 更新视频数量显示
        document.querySelector('.video-count').textContent = `${this.playlist.length} 个视频`;
    }
}

// 初始化视频播放器
const videoPlayer = new VideoPlayer();
