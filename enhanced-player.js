class EnhancedVideoPlayer {
    constructor() {
        this.player = null;
        this.playlist = [];
        this.currentVideoIndex = -1;
        
        this.setupVideoPlayer();
        this.setupEventListeners();
    }

    setupVideoPlayer() {
        // 创建 ArtPlayer 实例
        this.player = new Artplayer({
            container: '#player',
            url: '',
            title: '',
            volume: 0.7,
            isLive: false,
            muted: false,
            autoplay: false,
            pip: true,
            autoSize: true,
            autoMini: true,
            screenshot: true,
            setting: true,
            loop: false,
            flip: true,
            rotate: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: true,
            subtitleOffset: true,
            miniProgressBar: true,
            mutex: true,
            backdrop: true,
            playsInline: true,
            autoPlayback: true,
            airplay: true,
            theme: '#23ade5',
            lang: navigator.language.toLowerCase(),
            whitelist: ['*'],
            moreVideoAttr: {
                crossOrigin: 'anonymous',
            },
            settings: [
                {
                    html: '字幕',
                    selector: [
                        {
                            html: '显示',
                            value: true,
                        },
                        {
                            html: '隐藏',
                            value: false,
                        },
                    ],
                    onSelect: function (item) {
                        this.subtitle.show = item.value;
                        return item.html;
                    },
                },
            ],
            plugins: [
                artplayerPluginHls({
                    // hls 配置
                    debug: false,
                    manifestLoadingTimeOut: 10000,
                }),
            ],
        });

        // 错误处理
        this.player.on('error', () => {
            console.error('Player Error');
            this.showError('视频加载失败，请检查视频链接是否有效');
        });

        // 播放结束自动播放下一个
        this.player.on('ended', () => {
            if (this.currentVideoIndex < this.playlist.length - 1) {
                this.play(this.currentVideoIndex + 1);
            }
        });
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            const video = this.playlist[index];
            this.currentVideoIndex = index;
            this.playVideo(video);
            this.updateActiveItem();
            this.updateVideoTitle(video.title);
            this.updateNavigationButtons();
        }
    }

    playVideo(video) {
        this.player.switchUrl(video.url, video.title);
        setTimeout(() => {
            this.player.play();
        }, 100);
    }

    setupEventListeners() {
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        document.getElementById('showSidebar').addEventListener('click', () => {
            this.showSidebar();
        });

        document.getElementById('prevVideo').addEventListener('click', () => {
            if (this.currentVideoIndex > 0) {
                this.play(this.currentVideoIndex - 1);
            }
        });

        document.getElementById('nextVideo').addEventListener('click', () => {
            if (this.currentVideoIndex < this.playlist.length - 1) {
                this.play(this.currentVideoIndex + 1);
            }
        });

        document.getElementById('toggleFullscreen').addEventListener('click', () => {
            this.player.fullscreen = !this.player.fullscreen;
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch(e.key) {
                case 'ArrowLeft':
                    if (this.currentVideoIndex > 0) {
                        this.play(this.currentVideoIndex - 1);
                    }
                    break;
                case 'ArrowRight':
                    if (this.currentVideoIndex < this.playlist.length - 1) {
                        this.play(this.currentVideoIndex + 1);
                    }
                    break;
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('collapsed');
    }

    showSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('collapsed');
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

        document.querySelector('.video-count').textContent = `${this.playlist.length} 个视频`;
    }

    addVideo(title, url) {
        this.playlist.push({ title, url });
        this.renderPlaylist();

        // 如果是第一个视频，自动播放
        if (this.playlist.length === 1) {
            this.play(0);
        }
    }

    clearPlaylist() {
        if (confirm('确定要清空整个播放列表吗？此操作无法撤销。')) {
            this.playlist = [];
            this.currentVideoIndex = -1;
            this.renderPlaylist();
            this.updateVideoTitle('等待播放...');
            this.updateNavigationButtons();
            this.player.destroy();
            this.setupVideoPlayer();
        }
    }

    showError(message) {
        console.error('Error:', message);
        const errorContainer = document.getElementById('errorContainer');
        const errorText = document.getElementById('errorText');
        
        if (errorContainer && errorText) {
            errorText.textContent = message;
            errorContainer.style.display = 'flex';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }

    destroy() {
        if (this.player) {
            this.player.destroy();
        }
        document.removeEventListener('keydown', this.handleKeydown);
    }
}

// 确保在页面卸载时清理资源
window.addEventListener('unload', () => {
    if (window.videoPlayer) {
        window.videoPlayer.destroy();
    }
});
