class VideoPlayer {
    constructor() {
        this.artInstance = null;
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.isFullscreen = false;
        this.currentIframe = null;
        this.muted = false;
        this.volume = 0.7;
        this.autoFullscreen = true; // 新增：自动全屏配置
        this.loadPlaylist();
        this.setupEventListeners();
        this.setupOrientationListener();
    }

    async loadPlaylist() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist');
        const directUrl = urlParams.get('url');
        const title = urlParams.get('title') || '未命名视频';

        if (directUrl) {
            // 支持直接通过URL参数播放单个视频
            this.playlist = [{
                title: title,
                url: decodeURIComponent(directUrl),
                type: this.detectVideoType(directUrl)
            }];
            this.renderPlaylist();
            this.play(0);
        } else if (gistId) {
            try {
                await this.loadFromGist(gistId);
                if (this.playlist.length > 0) {
                    this.play(0);
                }
            } catch (error) {
                this.showError('加载播放列表失败，请检查链接！');
            }
        } else {
            this.showError('请提供有效的视频链接或播放列表！');
        }
    }

    detectVideoType(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;
            
            if (hostname.includes('bilibili.com')) return 'bilibili';
            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
            if (pathname.endsWith('.m3u8')) return 'm3u8';
            if (pathname.endsWith('.flv')) return 'flv';
            if (pathname.endsWith('.mp4')) return 'mp4';
            
            // 检查流媒体格式
            if (url.includes('m3u8')) return 'm3u8';
            if (url.includes('.flv')) return 'flv';
            
            return 'direct';
        } catch (error) {
            return 'direct';
        }
    }

    async loadFromGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            if (!response.ok) {
                throw new Error('Failed to load gist');
            }
            const data = await response.json();
            
            if (!data.files['playlist.json']) {
                throw new Error('Invalid playlist format');
            }
            
            this.playlist = JSON.parse(data.files['playlist.json'].content);
            this.playlist = this.playlist.map(video => ({
                ...video,
                type: video.type || this.detectVideoType(video.url)
            }));
            this.renderPlaylist();
        } catch (error) {
            console.error('Failed to load playlist:', error);
            throw new Error('播放列表加载失败');
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
            if (e.target.tagName === 'INPUT') return; // 输入框中不触发快捷键

            switch(e.key.toLowerCase()) {
                case 'arrowleft': 
                    if (e.ctrlKey) this.prev();
                    else this.seek(-5);
                    break;
                case 'arrowright':
                    if (e.ctrlKey) this.next();
                    else this.seek(5);
                    break;
                case 'f': this.toggleFullscreen(); break;
                case 'escape': this.exitFullscreen(); break;
                case ' ': this.togglePlay(e); break;
                case 'm': this.toggleMute(); break;
                case 'arrowup': this.adjustVolume(0.1); break;
                case 'arrowdown': this.adjustVolume(-0.1); break;
            }
        });

        // 监听全屏变化
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
        });

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (this.artInstance) {
                this.artInstance.autoSize();
            }
        });
    }

    setupOrientationListener() {
        if (this.isMobileDevice()) {
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    if (window.orientation === 90 || window.orientation === -90) {
                        if (this.artInstance) {
                            this.artInstance.fullscreen = true;
                        } else if (this.currentIframe) {
                            this.currentIframe.classList.add('iframe-fullscreen');
                            this.isFullscreen = true;
                        }
                    } else {
                        if (this.artInstance) {
                            this.artInstance.fullscreen = false;
                        } else if (this.currentIframe) {
                            this.currentIframe.classList.remove('iframe-fullscreen');
                            this.isFullscreen = false;
                        }
                    }
                }, 300);
            });
        }
    }

    initArtPlayer(url, title, type) {
        const playerContainer = document.getElementById('player');
        
        // 清理现有播放器
        if (this.artInstance) {
            this.artInstance.destroy();
            this.artInstance = null;
        }
        if (this.currentIframe) {
            this.currentIframe = null;
        }
        playerContainer.innerHTML = '';

        if (type === 'bilibili' || type === 'youtube') {
            // iframe播放器处理
            const iframe = document.createElement('iframe');
            iframe.src = this.processVideoUrl(url, type);
            iframe.frameBorder = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            playerContainer.appendChild(iframe);
            this.currentIframe = iframe;
            
            // iframe自动全屏
            if (this.autoFullscreen && !this.isMobileDevice()) {
                setTimeout(() => this.toggleFullscreen(), 1000);
            }
        } else {
            // Artplayer配置
            const config = {
                container: playerContainer,
                url: url,
                title: title,
                volume: this.volume,
                muted: this.muted,
                autoplay: true,
                theme: '#2196F3',
                pip: true,
                autoSize: true,
                autoMini: true,
                screenshot: true,
                setting: true,
                loop: false,
                flip: true,
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
                lang: navigator.language.toLowerCase(),
                whitelist: ['*'],
                moreVideoAttr: {
                    crossOrigin: 'anonymous',
                    preload: 'auto'
                },
                controls: [
                    {
                        position: 'right',
                        html: '下一集',
                        index: 1,
                        tooltip: '播放下一集',
                        style: {
                            marginRight: '20px',
                        },
                        click: () => this.next(),
                    },
                ],
                plugins: []
            };

            // 添加对应格式的插件
            if (type === 'm3u8') {
                config.plugins.push(ArtplayerPluginHls());
            } else if (type === 'flv') {
                config.plugins.push(ArtplayerPluginFlv());
            }

            this.artInstance = new Artplayer(config);

            // 视频加载完成后的处理
            this.artInstance.on('ready', () => {
                const video = this.artInstance.video;
                
                // 自动播放
                this.artInstance.play().catch(() => {
                    console.log('自动播放失败，需要用户交互');
                });

                // 检测视频尺寸并决定是否全屏
                if (video) {
                    video.addEventListener('loadedmetadata', () => {
                        const videoRatio = video.videoWidth / video.videoHeight;
                        const screenRatio = window.innerWidth / window.innerHeight;
                        
                        if (this.autoFullscreen && videoRatio > screenRatio && !this.isMobileDevice()) {
                            setTimeout(() => {
                                this.artInstance.fullscreen = true;
                            }, 1000);
                        }
                    });
                }
            });

            // 视频结束时播放下一个
            this.artInstance.on('video:ended', () => this.next());
            
            // 错误处理
            this.artInstance.on('error', () => {
                this.showError('视频加载失败，尝试使用备用播放器...');
                this.initFallbackPlayer(url, title);
            });
        }
    }

    processVideoUrl(url, type) {
        if (type === 'bilibili') {
            const bvMatch = url.match(/BV\w+/);
            if (bvMatch) {
                return `//player.bilibili.com/player.html?bvid=${bvMatch[0]}&high_quality=1&danmaku=0`;
            }
            const avMatch = url.match(/av(\d+)/);
            if (avMatch) {
                return `//player.bilibili.com/player.html?aid=${avMatch[1]}&high_quality=1&danmaku=0`;
            }
        } else if (type === 'youtube') {
            const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId[1]}?autoplay=1`;
            }
        }
        return url;
    }

    initFallbackPlayer(url, title) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.title = title;
        video.autoplay = true;
        
        const playerContainer = document.getElementById('player');
        playerContainer.innerHTML = '';
        playerContainer.appendChild(video);
        
        video.onerror = () => {
            this.showError('视频播放失败，请检查链接或尝试其他浏览器');
        };
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentVideoIndex = index;
            const video = this.playlist[index];
            this.initArtPlayer(video.url, video.title, video.type);
            this.updateVideoTitle(video.title);
            this.updateActiveItem();
            this.updateNavigationButtons();
            
            // 更新URL参数但不重新加载页面
            const url = new URL(window.location.href);
            if (this.playlist.length > 1) {
                url.searchParams.set('index', index);
                window.history.replaceState({}, '', url);
            }
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

    togglePlay(e) {
        if (e) e.preventDefault();
        if (this.artInstance) {
            this.artInstance.playing = !this.artInstance.playing;
        }
    }

    toggleMute() {
        if (this.artInstance) {
            this.muted = !this.muted;
            this.artInstance.muted = this.muted;
        }
    }

    adjustVolume(delta) {
        if (this.artInstance) {
            this.volume = Math.max(0, Math.min(1, this.volume + delta));
            this.artInstance.volume = this.volume;
        }
    }

    toggleFullscreen() {
        if (this.currentIframe) {
            this.currentIframe.classList.toggle('iframe-fullscreen');
            this.isFullscreen = this.currentIframe.classList.contains('iframe-fullscreen');
        } else if (this.artInstance) {
            this.artInstance.fullscreen = !this.artInstance.fullscreen;
        }
    }

    exitFullscreen() {
        if (this.currentIframe && this.currentIframe.classList.contains('iframe-fullscreen')) {
            this.currentIframe.classList.remove('iframe-fullscreen');
            this.isFullscreen = false;
        } else if (this.artInstance && this.artInstance.fullscreen) {
            this.artInstance.fullscreen = false;
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const icon = document.querySelector('#toggleSidebar i');
        const isMobile = this.isMobileDevice();
        
        sidebar.classList.toggle('collapsed');
        
        if (isMobile) {
            icon.textContent = sidebar.classList.contains('collapsed') ? 'menu' : 'close';
        } else {
            icon.textContent = sidebar.classList.contains('collapsed') ? 'chevron_right' : 'chevron_left';
        }

        const mainContent = document.querySelector('.main-content');
        if (sidebar.classList.contains('collapsed')) {
            mainContent.classList.add('expanded');
        } else {
            mainContent.classList.remove('expanded');
        }
    }

    showSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const icon = document.querySelector('#toggleSidebar i');
        const isMobile = this.isMobileDevice();
        
        sidebar.classList.remove('collapsed');
        icon.textContent = isMobile ? 'close' : 'chevron_left';

        const mainContent = document.querySelector('.main-content');
        mainContent.classList.remove('expanded');
    }

    isMobileDevice() {
        return (window.innerWidth <= 768) || 
               (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
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
                    <span class="video-type">${video.type}</span>
                </div>
            `;
            playlistElement.appendChild(item);
        });

        // 更新视频数量显示
        document.querySelector('.video-count').textContent = `${this.playlist.length} 个视频`;
    }

    showError(message) {
        const errorContainer = document.querySelector('.no-video');
        errorContainer.innerHTML = `
            <i class="material-icons">error_outline</i>
            <p>${message}</p>
            <button onclick="window.location.reload()" class="retry-button">
                <i class="material-icons">refresh</i>
                重试
            </button>
        `;
        errorContainer.style.display = 'flex';
    }
}

// 初始化视频播放器
const videoPlayer = new VideoPlayer();
