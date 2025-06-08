/**
 * ArtPlayer 包装器 - 提供统一的视频播放器接口
 */

class ArtPlayerWrapper {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            container: container,
            url: '',
            type: 'mp4',
            title: '',
            volume: 0.7,
            muted: false,
            autoplay: false,
            loop: false,
            playbackRate: 1,
            aspectRatio: true,
            setting: true,
            hotkey: true,
            pip: true,
            screenshot: true,
            subtitle: {
                url: '',
                style: {
                    color: '#fff',
                    fontSize: '16px',
                },
            },
            controls: [
                {
                    position: 'right',
                    html: '<i class="material-icons">playlist_play</i>',
                    tooltip: '播放列表',
                    click: () => {
                        this.togglePlaylist();
                    },
                },
            ],
            ...options
        };
        
        this.player = null;
        this.currentVideo = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaylistVisible = true;
        
        this.eventHandlers = {
            play: [],
            pause: [],
            ended: [],
            error: [],
            timeupdate: [],
            loadstart: [],
            canplay: [],
            ready: []
        };
        
        this.init();
    }
    
    async init() {
        try {
            // 检查 ArtPlayer 是否可用
            if (typeof Artplayer === 'undefined') {
                throw new Error('ArtPlayer 未加载');
            }
            
            // 初始化播放器
            this.player = new Artplayer(this.options);
            
            // 绑定事件
            this.bindEvents();
            
            // 触发就绪事件
            this.emit('ready');
            
        } catch (error) {
            console.error('初始化播放器失败:', error);
            this.showError('播放器初始化失败');
            this.emit('error', error);
        }
    }
    
    bindEvents() {
        if (!this.player) return;
        
        // 播放事件
        this.player.on('play', () => {
            this.emit('play');
        });
        
        // 暂停事件
        this.player.on('pause', () => {
            this.emit('pause');
        });
        
        // 播放结束事件
        this.player.on('video:ended', () => {
            this.emit('ended');
        });
        
        // 错误事件
        this.player.on('error', (error) => {
            console.error('播放器错误:', error);
            this.emit('error', error);
        });
        
        // 时间更新事件
        this.player.on('video:timeupdate', () => {
            this.emit('timeupdate', {
                currentTime: this.player.currentTime,
                duration: this.player.duration
            });
        });
        
        // 加载开始事件
        this.player.on('video:loadstart', () => {
            this.emit('loadstart');
        });
        
        // 可以播放事件
        this.player.on('video:canplay', () => {
            this.emit('canplay');
        });
        
        // 键盘事件处理
        this.bindKeyboardEvents();
    }
    
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (!this.player || document.activeElement.tagName === 'INPUT') return;
            
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this.toggle();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seek(this.player.currentTime - 10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.seek(this.player.currentTime + 10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.volume(Math.min(1, this.player.volume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.volume(Math.max(0, this.player.volume - 0.1));
                    break;
                case 'f':
                case 'F':
                    this.fullscreen();
                    break;
                case 'm':
                case 'M':
                    this.mute();
                    break;
            }
        });
    }
    
    // 事件系统
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        }
    }
    
    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('事件处理器错误:', error);
                }
            });
        }
    }
    
    // 播放控制方法
    loadVideo(video) {
        if (!this.player) {
            console.error('播放器未初始化');
            return;
        }
        
        try {
            this.currentVideo = video;
            
            // 设置视频源
            this.player.switchUrl(video.url);
            
            // 设置标题
            if (video.title) {
                this.player.title = video.title;
            }
            
            // 设置字幕
            if (video.subtitle) {
                this.player.subtitle.url = video.subtitle;
            }
            
            // 处理不同的视频类型
            this.handleVideoType(video);
            
        } catch (error) {
            console.error('加载视频失败:', error);
            this.showError('视频加载失败');
            this.emit('error', error);
        }
    }
    
    handleVideoType(video) {
        const type = video.type || this.detectVideoType(video.url);
        
        switch (type) {
            case 'hls':
            case 'm3u8':
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    this.player.hls = new Hls();
                    this.player.hls.loadSource(video.url);
                    this.player.hls.attachMedia(this.player.video);
                }
                break;
                
            case 'flv':
                if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
                    this.player.flv = flvjs.createPlayer({
                        type: 'flv',
                        url: video.url,
                    });
                    this.player.flv.attachMediaElement(this.player.video);
                    this.player.flv.load();
                }
                break;
                
            case 'dash':
                if (typeof dashjs !== 'undefined') {
                    this.player.dash = dashjs.MediaPlayer().create();
                    this.player.dash.initialize(this.player.video, video.url, false);
                }
                break;
        }
    }
    
    detectVideoType(url) {
        if (url.includes('.m3u8') || url.includes('hls')) {
            return 'hls';
        } else if (url.includes('.flv')) {
            return 'flv';
        } else if (url.includes('.mpd')) {
            return 'dash';
        } else {
            return 'mp4';
        }
    }
    
    play() {
        if (this.player) {
            return this.player.play();
        }
    }
    
    pause() {
        if (this.player) {
            this.player.pause();
        }
    }
    
    toggle() {
        if (this.player) {
            this.player.toggle();
        }
    }
    
    seek(time) {
        if (this.player) {
            this.player.currentTime = time;
        }
    }
    
    volume(value) {
        if (this.player) {
            this.player.volume = value;
        }
    }
    
    mute() {
        if (this.player) {
            this.player.muted = !this.player.muted;
        }
    }
    
    fullscreen() {
        if (this.player) {
            this.player.fullscreen = !this.player.fullscreen;
        }
    }
    
    playbackRate(rate) {
        if (this.player) {
            this.player.playbackRate = rate;
        }
    }
    
    // 播放列表方法
    setPlaylist(playlist) {
        this.playlist = playlist || [];
        this.currentIndex = -1;
    }
    
    playByIndex(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentIndex = index;
            this.loadVideo(this.playlist[index]);
            this.play();
        }
    }
    
    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.playByIndex(this.currentIndex + 1);
        }
    }
    
    playPrevious() {
        if (this.currentIndex > 0) {
            this.playByIndex(this.currentIndex - 1);
        }
    }
    
    togglePlaylist() {
        this.isPlaylistVisible = !this.isPlaylistVisible;
        const sidebar = document.querySelector('.player-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('hidden', !this.isPlaylistVisible);
        }
    }
    
    // 错误处理
    showError(message) {
        const container = this.container;
        const errorElement = container.querySelector('.video-error') || 
            this.createErrorElement(message);
        
        errorElement.textContent = message;
        errorElement.style.display = 'flex';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    createErrorElement(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'video-error';
        errorElement.innerHTML = `
            <div class="error-content">
                <i class="material-icons">error_outline</i>
                <p>${message}</p>
                <button class="btn-retry" onclick="location.reload()">重试</button>
            </div>
        `;
        this.container.appendChild(errorElement);
        return errorElement;
    }
    
    // 清理资源
    destroy() {
        if (this.player) {
            // 清理插件
            if (this.player.hls) {
                this.player.hls.destroy();
            }
            if (this.player.flv) {
                this.player.flv.destroy();
            }
            if (this.player.dash) {
                this.player.dash.reset();
            }
            
            // 销毁播放器
            this.player.destroy();
            this.player = null;
        }
        
        // 清理事件处理器
        Object.keys(this.eventHandlers).forEach(event => {
            this.eventHandlers[event] = [];
        });
    }
    
    // 获取播放器状态
    getStatus() {
        if (!this.player) return null;
        
        return {
            playing: !this.player.paused,
            currentTime: this.player.currentTime,
            duration: this.player.duration,
            volume: this.player.volume,
            muted: this.player.muted,
            fullscreen: this.player.fullscreen,
            playbackRate: this.player.playbackRate,
            currentVideo: this.currentVideo,
            currentIndex: this.currentIndex,
            playlistLength: this.playlist.length
        };
    }
}

// 导出
export default ArtPlayerWrapper;
