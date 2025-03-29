class VideoPlayer {
    constructor() {
        this.artInstance = null;
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.isFullscreen = false;
        this.currentIframe = null;
        this.muted = false;
        this.volume = 0.7;
        this.loadPlaylist();
        this.setupEventListeners();
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
        // 增强视频类型检测
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
    }

    initArtPlayer(url, title, type) {
        const playerContainer = document.getElementById('player');
        
        // 清理现有的播放器
        if (this.artInstance) {
            this.artInstance.destroy();
            this.artInstance = null;
        }
        if (this.currentIframe) {
            this.currentIframe = null;
        }
        playerContainer.innerHTML = '';

        if (type === 'bilibili' || type === 'youtube') {
            // 使用iframe播放B站和YouTube视频
            const iframe = document.createElement('iframe');
            iframe.src = this.processVideoUrl(url, type);
            iframe.frameBorder = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            playerContainer.appendChild(iframe);
            this.currentIframe = iframe;
        } else {
            // 使用Artplayer播放其他格式视频
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

            // 根据视频类型添加对应的插件
            if (type === 'm3u8') {
                config.plugins.push(ArtplayerPluginHls());
            } else if (type === 'flv') {
                config.plugins.push(ArtplayerPluginFlv());
            }

            this.artInstance = new Artplayer(config);

            // 事件监听
            this.artInstance.on('video:ended', () => this.next());
            this.artInstance.on('error', () => {
                this.showError('视频加载失败，尝试使用备用播放器...');
                this.initFallbackPlayer(url, title);
            });
        }
    }

    processVideoUrl(url, type) {
        if (type === 'bilibili') {
            // 处理B站链接
            const bvMatch = url.match(/BV\w+/);
            if (bvMatch) {
                return `//player.bilibili.com/player.html?bvid=${bvMatch[0]}&high_quality=1&danmaku=0`;
            }
            const avMatch = url.match(/av(\d+)/);
            if (avMatch) {
                return `//player.bilibili.com/player.html?aid=${avMatch[1]}&high_quality=1&danmaku=0`;
            }
        } else if (type === 'youtube') {
            // 处理YouTube链接
            const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId[1]}?autoplay=1`;
            }
        }
        return url;
    }

    initFallbackPlayer(url, title) {
        // 使用原生HTML5播放器作为备用
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
        // 已有的事件监听保持不变...
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('showSidebar').addEventListener('click', () => this.showSidebar());
        document.getElementById('prevVideo').addEventListener('click', () => this.prev());
        document.getElementById('nextVideo').addEventListener('click', () => this.next());
        document.getElementById('toggleFullscreen').addEventListener('click', () => this.toggleFullscreen());

        // 增加键盘快捷键
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

    // 其他方法保持不变...
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
