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
            
            // 确保容器存在
            if (!this.container) {
                throw new Error('容器元素不存在');
            }
            
            // 创建视频播放器容器
            const playerContainer = document.createElement('div');
            playerContainer.className = 'artplayer-container';
            playerContainer.style.width = '100%';
            playerContainer.style.height = '100%';
            
            // 清空容器并添加播放器容器
            this.container.innerHTML = '';
            this.container.appendChild(playerContainer);
            
            // 设置全局跨域配置
            const enhancedOptions = {
                ...this.options,
                container: playerContainer,
                crossOrigin: 'anonymous',
                customType: {
                    ...this.options.customType,
                    mp4: (video, url) => {
                        video.src = url;
                        video.crossOrigin = 'anonymous';
                    }
                }
            };
            
            // 初始化播放器
            this.player = new Artplayer(enhancedOptions);
            
            // 绑定事件
            this.bindEvents();
            
            // 启用调试模式，帮助诊断问题
            this.player.debug = true;
            
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
    async loadVideo(video) {
        if (!this.player) {
            console.error('播放器未初始化');
            return;
        }
        
        try {
            // 保存当前视频信息
            this.currentVideo = video;
            
            // 显示加载状态
            this.showLoadingState('正在加载视频...');
            
            // 设置标题
            if (video.title) {
                this.player.title = video.title;
            }
            
            // 设置字幕
            if (video.subtitle) {
                this.player.subtitle.url = video.subtitle;
            }
            
            // 导入视频代理模块（如果需要）
            let videoProxy;
            try {
                videoProxy = await import('./videoDetector.js').then(module => module.videoProxy);
            } catch (e) {
                console.warn('无法导入视频代理模块:', e);
                videoProxy = null;
            }
            
            // 检查是否需要为视频URL使用代理
            let finalUrl = video.url;
            if (videoProxy && videoProxy.needsProxy(video.url)) {
                try {
                    console.log('检测到可能的跨域问题，尝试使用代理...');
                    // 先不使用代理尝试
                    this.showWarning('正在尝试直接加载视频...');
                } catch (proxyError) {
                    console.error('代理加载失败:', proxyError);
                    // 代理失败，回退到原始URL
                    finalUrl = video.url;
                }
            }
            
            // 更新视频对象
            const processedVideo = {
                ...video,
                url: finalUrl
            };
            
            // 设置视频源
            this.player.switchUrl(finalUrl);
            
            // 处理不同的视频类型
            await this.handleVideoType(processedVideo);
            
            // 播放器设置
            this.player.autoplay = this.options.autoplay;
            
            console.log('视频加载完成，准备播放:', processedVideo);
            
        } catch (error) {
            console.error('加载视频失败:', error);
            this.showError('视频加载失败');
            this.emit('error', {
                message: '加载视频资源失败',
                solution: '请检查视频链接是否有效，或者该服务器是否允许跨域访问',
                originalError: error
            });
        }
    }handleVideoType(video) {
        const type = video.type || this.detectVideoType(video.url);
        
        switch (type) {
            case 'hls':
            case 'm3u8':
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    this.player.hls = new Hls({
                        xhrSetup: (xhr) => {
                            xhr.withCredentials = false;  // 确保不发送凭据
                            // 添加额外请求头，某些服务器可能需要
                            xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
                        }
                    });
                    this.player.hls.loadSource(video.url);
                    this.player.hls.attachMedia(this.player.video);
                }
                break;
                
            case 'flv':
                if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
                    this.player.flv = flvjs.createPlayer({
                        type: 'flv',
                        url: video.url,
                        cors: true,  // 启用CORS
                        hasAudio: true,
                        hasVideo: true
                    });
                    this.player.flv.attachMediaElement(this.player.video);
                    this.player.flv.load();
                }
                break;
                
            case 'dash':
                if (typeof dashjs !== 'undefined') {
                    this.player.dash = dashjs.MediaPlayer().create();
                    this.player.dash.initialize(this.player.video, video.url, false);
                    this.player.dash.updateSettings({
                        streaming: {
                            buffer: {
                                stableBufferTime: 20,
                                bufferTimeAtTopQualityLongForm: 30
                            }
                        }
                    });
                }
                break;
                
            case 'mp4':
            default:
                // 增强MP4处理逻辑，特别针对外部链接
                try {
                    // 确保视频元素有正确的属性
                    this.player.video.crossOrigin = 'anonymous';
                    // 移除之前的事件监听器，避免重复
                    this.player.video.removeEventListener('error', this._handleVideoError);
                    // 添加错误处理
                    this._handleVideoError = (e) => this.handleVideoPlayError(e, video);
                    this.player.video.addEventListener('error', this._handleVideoError);
                    
                    // 使用blob URL可以绕过一些CORS限制
                    if (video.url.startsWith('http') && !video.url.includes(window.location.hostname)) {
                        console.log('尝试使用Fetch API加载视频:', video.url);
                        this.loadVideoWithFetch(video.url);
                    } else {
                        // 直接设置源
                        if (this.player.video.src !== video.url) {
                            this.player.video.src = video.url;
                        }
                    }
                } catch (error) {
                    console.error('设置视频源时出错:', error);
                    throw error;
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
    
    // 使用Fetch API加载视频，解决跨域问题
    async loadVideoWithFetch(url) {
        try {
            console.log('使用Fetch API加载视频:', url);
            
            // 显示加载状态
            this.showLoadingState('正在解析视频资源...');
            
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',  // 尝试CORS模式
                headers: {
                    'Range': 'bytes=0-',  // 请求视频的第一部分，用于快速获取头部
                    'Access-Control-Allow-Origin': '*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`网络响应错误: ${response.status} ${response.statusText}`);
            }
            
            // 获取视频数据
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            console.log('成功创建Blob URL:', blobUrl);
            
            // 设置视频源为Blob URL
            this.player.video.src = blobUrl;
            
            // 当视频播放结束时释放Blob URL资源
            this.player.video.addEventListener('ended', () => {
                URL.revokeObjectURL(blobUrl);
            }, { once: true });
            
        } catch (error) {
            console.error('使用Fetch加载视频失败:', error);
            
            // 回退到直接设置URL
            console.log('回退到直接设置视频URL');
            this.player.video.src = url;
            
            // 显示警告但不阻止继续尝试播放
            this.showWarning('视频加载方式已切换，如果仍无法播放，请检查视频链接或网络设置。');
        }
    }
    
    // 显示加载状态
    showLoadingState(message = '正在加载视频...') {
        // 如果播放器设置了loading属性，则使用它
        if (this.player && typeof this.player.loading === 'boolean') {
            this.player.loading = true;
        }
        
        // 也可以通过触发事件，让外部UI更新
        this.emit('loadstart', { message });
    }
    
    // 显示警告消息但不中断播放
    showWarning(message) {
        console.warn('播放器警告:', message);
        
        // 触发警告事件
        this.emit('warning', { message });
        
        // 在播放器上显示提示（如果支持）
        if (this.player && this.player.notice) {
            this.player.notice(message, 5000, 'warning');
        }
    }
    
    // 处理视频播放错误
    handleVideoPlayError(event, video) {
        const mediaError = event.target.error;
        let errorMessage = '未知错误';
        let solution = '请尝试刷新页面或使用不同的浏览器';
        let canRetry = true;
        
        console.error('视频播放错误:', mediaError);
        
        if (mediaError) {
            switch (mediaError.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMessage = '播放被中断';
                    solution = '请重新加载视频';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorMessage = '网络错误导致视频加载失败';
                    solution = '请检查您的网络连接并重试';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorMessage = '视频解码错误';
                    solution = '视频可能已损坏或格式不受支持';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = '视频格式或MIME类型不受支持';
                    solution = '请尝试使用不同的视频格式或启用跨域资源共享';
                    
                    // 尝试检测是否是CORS问题
                    if (video && video.url && video.url.startsWith('http') && !video.url.includes(window.location.hostname)) {
                        const urlObj = new URL(video.url);
                        errorMessage = '视频资源存在跨域访问限制';
                        solution = `请联系 ${urlObj.hostname} 的管理员，确认其允许跨域视频访问`;
                    }
                    break;
            }
        }
        
        // 触发错误事件并提供详细信息
        this.emit('error', {
            message: errorMessage,
            solution: solution,
            mediaError: mediaError,
            videoUrl: video ? video.url : 'unknown',
            canRetry: canRetry
        });
        
        // 显示错误
        this.showError(`${errorMessage}. ${solution}`);
    }
}

// 定义导出的错误类型，便于外部处理
export const VideoError = {
    NETWORK_ERROR: 'network_error',
    FORMAT_ERROR: 'format_error',
    CORS_ERROR: 'cors_error',
    DECODE_ERROR: 'decode_error',
    SOURCE_ERROR: 'source_error',
    UNKNOWN_ERROR: 'unknown_error'
};

// 导出播放器包装类
export default ArtPlayerWrapper;
