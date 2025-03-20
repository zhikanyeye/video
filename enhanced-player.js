class EnhancedVideoPlayer {
    constructor() {
        this.player = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.loadPlaylist().then(() => {
            this.setupVideoPlayer();
            this.setupEventListeners();
        });
    }

    async loadPlaylist() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist');

        if (!gistId) {
            // 如果没有 gist 参数，尝试从本地存储加载
            const saved = localStorage.getItem('videoPlaylist');
            this.playlist = saved ? JSON.parse(saved) : [];
        } else {
            try {
                // 从 Gist 加载播放列表
                const response = await fetch(`https://api.github.com/gists/${gistId}`);
                if (!response.ok) throw new Error('Failed to fetch Gist');
                
                const data = await response.json();
                this.playlist = JSON.parse(data.files['playlist.json'].content);
            } catch (error) {
                console.error('Failed to load playlist from Gist:', error);
                throw new Error('播放列表加载失败');
            }
        }

        // 更新视频数量显示
        document.querySelector('.video-count').textContent = `${this.playlist.length} 个视频`;
        
        // 渲染播放列表
        this.renderPlaylist();
    }

    setupVideoPlayer() {
        if (this.playlist.length === 0) return;

        this.player = new Artplayer({
            container: '#player',
            url: this.playlist[0].url,
            title: this.playlist[0].title,
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
            theme: '#23ade5',
            lang: navigator.language.toLowerCase(),
            plugins: [
                artplayerPluginHls,
            ],
            customType: {
                m3u8: function (video, url) {
                    if (Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        hls.on(Hls.Events.ERROR, function (event, data) {
                            if (data.fatal) {
                                console.error('HLS Error:', data);
                                switch (data.type) {
                                    case Hls.ErrorTypes.NETWORK_ERROR:
                                        hls.startLoad();
                                        break;
                                    case Hls.ErrorTypes.MEDIA_ERROR:
                                        hls.recoverMediaError();
                                        break;
                                    default:
                                        hls.destroy();
                                        break;
                                }
                            }
                        });
                    }
                }
            }
        });

        this.currentIndex = 0;
        this.updateVideoTitle(this.playlist[0].title);
        this.updateNavigationButtons();
    }

    setupEventListeners() {
        // 侧边栏切换
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });

        document.getElementById('showSidebar').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.remove('collapsed');
        });

        // 播放控制
        document.getElementById('prevVideo').addEventListener('click', () => {
            this.playPrevious();
        });

        document.getElementById('nextVideo').addEventListener('click', () => {
            this.playNext();
        });

        // 视频结束时自动播放下一个
        if (this.player) {
            this.player.on('ended', () => {
                this.playNext();
            });
        }
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playerPlaylist');
        playlistElement.innerHTML = this.playlist.map((video, index) => `
            <div class="playlist-item${index === this.currentIndex ? ' active' : ''}" 
                 onclick="videoPlayer.play(${index})">
                <div class="playlist-item-content">
                    <i class="material-icons">
                        ${index === this.currentIndex ? 'play_arrow' : 'play_circle_outline'}
                    </i>
                    <span>${video.title}</span>
                </div>
            </div>
        `).join('');
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length && this.player) {
            this.currentIndex = index;
            const video = this.playlist[index];
            this.player.switchUrl(video.url);
            this.updateVideoTitle(video.title);
            this.updateNavigationButtons();
            this.renderPlaylist();
        }
    }

    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.play(this.currentIndex + 1);
        }
    }

    playPrevious() {
        if (this.currentIndex > 0) {
            this.play(this.currentIndex - 1);
        }
    }

    updateVideoTitle(title) {
        document.getElementById('currentVideoTitle').textContent = title;
    }

    updateNavigationButtons() {
        document.getElementById('prevVideo').disabled = this.currentIndex <= 0;
        document.getElementById('nextVideo').disabled = this.currentIndex >= this.playlist.length - 1;
    }

    clearPlaylist() {
        if (confirm('确定要清空播放列表吗？')) {
            this.playlist = [];
            this.currentIndex = -1;
            if (this.player) {
                this.player.destroy();
                this.player = null;
            }
            this.renderPlaylist();
            this.updateVideoTitle('等待播放...');
            this.updateNavigationButtons();
            document.querySelector('.video-count').textContent = '0 个视频';
        }
    }

    addVideo(title, url) {
        this.playlist.push({ title, url });
        this.renderPlaylist();
        document.querySelector('.video-count').textContent = `${this.playlist.length} 个视频`;
        
        if (this.playlist.length === 1) {
            this.setupVideoPlayer();
        }
    }
}
