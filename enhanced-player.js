class EnhancedVideoPlayer {
    constructor() {
        this.player = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.loadPlaylist().then(() => {
            this.setupVideoPlayer();
            this.setupEventListeners();
        }).catch(error => {
            console.error('初始化播放器失败:', error);
        });
    }

    async loadPlaylist() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist');

        if (!gistId) {
            alert('请提供播放列表的 Gist ID！');
            window.location.href = 'index.html';
            return;
        }

        try {
            // 从 Gist 加载播放列表
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            if (!response.ok) {
                throw new Error(`获取Gist失败: ${response.status}`);
            }
            
            const data = await response.json();
            if (!data.files['playlist.json']) {
                throw new Error('播放列表格式错误');
            }
            
            this.playlist = JSON.parse(data.files['playlist.json'].content);
            
            // 渲染播放列表
            this.renderPlaylist();
        } catch (error) {
            console.error('从Gist加载播放列表失败:', error);
            alert('播放列表加载失败，请检查 Gist ID 是否正确！');
            throw error;
        }
    }

    setupVideoPlayer() {
        if (this.playlist.length === 0) return;
        
        // 检测视频URL格式
        const detectVideoType = (url) => {
            if (!url) return '';
            const extension = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
            if (['m3u8'].includes(extension)) return 'm3u8';
            if (['mp4'].includes(extension)) return 'mp4';
            if (['webm'].includes(extension)) return 'webm';
            if (['flv'].includes(extension)) return 'flv';
            return '';
        };
        
        const firstVideoUrl = this.playlist[0].url;
        const videoType = detectVideoType(firstVideoUrl);
        console.log('检测到视频格式:', videoType || '未知格式');

        // 初始化 ArtPlayer
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
                                console.error('HLS 错误:', data);
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
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        // 原生支持 HLS 的浏览器（如 Safari）
                        video.src = url;
                    }
                },
                mp4: function (video, url) {
                    video.src = url;
                },
                webm: function (video, url) {
                    video.src = url;
                },
                flv: function (video, url) {
                    if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
                        const flvPlayer = flvjs.createPlayer({
                            type: 'flv',
                            url: url
                        });
                        flvPlayer.attachMediaElement(video);
                        flvPlayer.load();
                    } else {
                        console.error('当前浏览器不支持FLV格式');
                    }
                }
            }
        });

        this.currentIndex = 0;
        this.updateVideoTitle(this.playlist[0].title);
        this.updateNavigationButtons();
    }

    setupEventListeners() {
        if (!this.player) return;
        
        // 添加键盘控制
        document.addEventListener('keydown', (e) => {
            // 如果焦点在输入框中，不处理快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    this.playPrevious();
                    break;
                case 'ArrowRight':
                    this.playNext();
                    break;
                case 'f':
                case 'F':
                    if (this.player) {
                        this.player.fullscreen = !this.player.fullscreen;
                    }
                    break;
                case ' ':
                    if (this.player) {
                        this.player.playing ? this.player.pause() : this.player.play();
                        e.preventDefault(); // 防止页面滚动
                    }
                    break;
            }
        });

        // 视频结束时自动播放下一个
        this.player.on('ended', () => {
            this.playNext();
        });
        
        // 播放时隐藏侧边栏
        this.player.on('play', () => {
            // 隐藏侧边栏
            const sidebar = document.getElementById('playlistSidebar');
            if (sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
            }
        });
        
        // 添加自动全屏功能
        const autoFullscreenCheckbox = document.getElementById('autoFullscreen');
        if (autoFullscreenCheckbox) {
            autoFullscreenCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('autoFullscreen', e.target.checked);
            });
            
            // 加载保存的设置
            const savedAutoFullscreen = localStorage.getItem('autoFullscreen');
            autoFullscreenCheckbox.checked = savedAutoFullscreen === 'true';
            
            // 播放时自动全屏
            this.player.on('play', () => {
                if (autoFullscreenCheckbox.checked && !this.player.fullscreen) {
                    setTimeout(() => {
                        this.player.fullscreen = true;
                    }, 500);
                }
            });
        }
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length && this.player) {
            this.currentIndex = index;
            const video = this.playlist[index];
            
            // 添加错误处理和调试信息
            console.log('尝试播放视频:', video.title, video.url);
            
            try {
                this.player.switchUrl(video.url);
                this.updateVideoTitle(video.title);
                this.updateNavigationButtons();
                this.renderPlaylist();
                
                // 尝试自动播放
                setTimeout(() => {
                    this.player.play().catch(error => {
                        console.error('自动播放失败:', error);
                        alert('自动播放失败，请手动点击播放按钮。可能是浏览器阻止了自动播放。');
                    });
                }, 1000);
            } catch (error) {
                console.error('切换视频URL失败:', error);
                alert('播放视频失败，请检查视频链接是否有效。');
            }
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
        document.getElementById('videoTitle').textContent = title;
    }

    updateNavigationButtons() {
        document.getElementById('prevVideo').disabled = this.currentIndex <= 0;
        document.getElementById('nextVideo').disabled = this.currentIndex >= this.playlist.length - 1;
    }

    togglePlaylist() {
        const sidebar = document.getElementById('playlistSidebar');
        sidebar.classList.toggle('show');
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlistContent');
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
}

// 初始化视频播放器
const videoPlayer = new EnhancedVideoPlayer();
