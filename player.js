class VideoPlayer {
    constructor() {
        this.artInstance = null;
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.isFullscreen = false;
        this.loadPlaylist();
        this.setupEventListeners();
    }

    async loadPlaylist() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist');

        if (gistId) {
            try {
                await this.loadFromGist(gistId);
                if (this.playlist.length > 0) {
                    this.play(0);
                }
            } catch (error) {
                this.showError('加载播放列表失败，请检查链接！');
            }
        } else {
            this.showError('无效的播放列表链接！');
        }
    }

    async loadFromGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            const data = await response.json();
            this.playlist = JSON.parse(data.files['playlist.json'].content);
            this.renderPlaylist();
        } catch (error) {
            throw new Error('Gist加载失败');
        }
    }

    setupEventListeners() {
        // 侧边栏切换
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('showSidebar').addEventListener('click', () => this.showSidebar());

        // 视频控制
        document.getElementById('prevVideo').addEventListener('click', () => this.prev());
        document.getElementById('nextVideo').addEventListener('click', () => this.next());
        document.getElementById('toggleFullscreen').addEventListener('click', () => this.toggleFullscreen());

        // 键盘控制
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft': this.seek(-5); break;
                case 'ArrowRight': this.seek(5); break;
                case 'f': this.toggleFullscreen(); break;
                case 'Escape': this.exitFullscreen(); break;
            }
        });
    }

    initArtPlayer(url, title) {
        if (this.artInstance) this.artInstance.destroy();
        
        this.artInstance = new Artplayer({
            container: '#player',
            url: url,
            title: title,
            volume: 0.7,
            autoplay: true,
            theme: '#2196F3',
            pip: true,
            autoSize: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            mutex: true,
            plugins: [
                ArtplayerPluginHls((url) => {
                    return url.includes('m3u8');
                })
            ]
        });

        // 监听播放结束事件
        this.artInstance.on('video:ended', () => this.next());
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentVideoIndex = index;
            const video = this.playlist[index];
            this.initArtPlayer(video.url, video.title);
            this.updateVideoTitle(video.title);
            this.updateActiveItem();
            this.updateNavigationButtons();
        }
    }

    prev() {
        if (this.currentVideoIndex > 0) {
            this.play(this.currentVideoIndex - 1);
        }
    }

    next() {
        if (this.currentVideoIndex < this.playlist.length - 1) {
            this.play(this.currentVideoIndex + 1);
        }
    }

    seek(seconds) {
        if (this.artInstance) {
            this.artInstance.seek = this.artInstance.currentTime + seconds;
        }
    }

    toggleFullscreen() {
        if (this.artInstance) {
            this.artInstance.fullscreen = !this.artInstance.fullscreen;
        }
    }

    exitFullscreen() {
        if (this.artInstance && this.artInstance.fullscreen) {
            this.artInstance.fullscreen = false;
        }
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

    isMobileDevice() {
        return window.innerWidth <= 768;
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

    updateVideoTitle(title) {
        document.getElementById('currentVideoTitle').textContent = title;
    }

    updateNavigationButtons() {
        document.getElementById('prevVideo').disabled = this.currentVideoIndex <= 0;
        document.getElementById('nextVideo').disabled = this.currentVideoIndex >= this.playlist.length - 1;
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

    showError(message) {
        document.querySelector('.no-video').innerHTML = `
            <i class="material-icons">error_outline</i>
            <p>${message}</p>
        `;
    }
}

// 初始化视频播放器
const videoPlayer = new VideoPlayer();
