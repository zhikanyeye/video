class VideoPlayer {
    constructor(options = {}) {
        this.options = {
            container: '#player',
            autoFullscreen: true,
            ...options
        };

        this.playlist = [];
        this.currentVideoIndex = 0;
        this.volume = 0.7;
        this.muted = false;
        this.sniffer = new VideoSniffer();
        this.retryCount = 0;
        this.maxRetries = 3;

        this.init();
    }

    async init() {
        this.loadPlaylist();
        this.bindEvents();
        
        // 从URL参数获取播放索引
        const params = new URLSearchParams(window.location.search);
        const index = parseInt(params.get('index')) || 0;
        
        if (this.playlist.length > 0) {
            this.play(index);
        }
    }

    async initArtPlayer(url, title, type) {
        try {
            console.log(`开始初始化播放器: URL=${url}, 类型=${type}`);
            // 显示加载状态
            this.showLoading();
            
            // 首先尝试直接播放
            await this.tryPlayVideo(url, type);
            
            // 播放成功后隐藏加载状态
            this.hideLoading();
            
            // 更新页面标题
            document.title = `${title} - 增强版视频播放器`;
            // 更新当前视频标题
            document.getElementById('currentVideoTitle').textContent = title;
            
            // 重置重试计数
            this.retryCount = 0;
        } catch (error) {
            console.warn('直接播放失败，尝试嗅探视频:', error);
            
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                // 嗅探并尝试播放
                await this.sniffAndPlay(url, title);
            } else {
                this.showError('视频加载失败，请检查链接是否有效');
                this.retryCount = 0;
            }
        }
    }

    async tryPlayVideo(url, type) {
        const container = document.querySelector(this.options.container);
        
        // 清除现有播放器和错误信息
        if (this.artInstance) {
            this.artInstance.destroy();
        }
        this.hideError();

        console.log(`尝试播放视频: ${type} 类型，URL: ${url}`);

        // 基础配置
        const config = {
            container,
            url,
            theme: '#2196F3',
            volume: this.volume,
            muted: this.muted,
            autoplay: true,
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

        // 处理不同视频类型
        if (type === 'direct') {
            // 对于直链，尝试自动检测类型
            console.log('尝试自动检测视频类型');
            const extension = this.getExtensionFromUrl(url);
            if (extension) {
                console.log(`从URL检测到文件扩展名: ${extension}`);
                if (extension === 'm3u8') {
                    config.plugins.push(ArtplayerPluginHls());
                    console.log('添加HLS插件');
                } else if (extension === 'flv') {
                    config.plugins.push(ArtplayerPluginFlv());
                    console.log('添加FLV插件');
                }
            }
        }
        // 根据明确的视频类型添加对应插件
        else if (type === 'm3u8') {
            config.plugins.push(ArtplayerPluginHls());
            console.log('添加HLS插件');
        } else if (type === 'flv') {
            config.plugins.push(ArtplayerPluginFlv());
            console.log('添加FLV插件');
        } else if (type === 'iframe') {
            // iframe类型的视频使用iframe播放
            return this.playIframe(url);
        }
        
        // 创建Artplayer实例
        this.artInstance = new Artplayer(config);
        
        // 事件监听
        this.artInstance.on('error', () => {
            console.error('播放器报告错误');
            throw new Error('Video playback error');
        });
    }
    
    // 辅助方法：从URL中获取文件扩展名
    getExtensionFromUrl(url) {
        try {
            if (url.includes('.mp4')) return 'mp4';
            if (url.includes('.m3u8')) return 'm3u8';
            if (url.includes('.flv')) return 'flv';
            if (url.includes('.webm')) return 'webm';
            
            // 尝试解析URL并从路径中获取扩展名
            const parsedUrl = new URL(url);
            const match = parsedUrl.pathname.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            return match ? match[1].toLowerCase() : null;
        } catch (e) {
            console.warn('解析URL获取扩展名失败:', e);
            return null;
        }
    }
    
    /**
     * 快速检查是否为常见视频URL格式
     * 在嗅探器之前运行，确保最基本的视频链接能被识别
     */
    checkSimpleVideoUrl(url) {
        if (!url) return null;
        
        // 检查常见视频后缀
        const urlLower = url.toLowerCase();
        
        if (urlLower.includes('.mp4')) {
            return { url, type: 'mp4' };
        }
        if (urlLower.includes('.m3u8')) {
            return { url, type: 'm3u8' };
        }
        if (urlLower.includes('.flv')) {
            return { url, type: 'flv' };
        }
        if (urlLower.includes('.webm')) {
            return { url, type: 'webm' };
        }
        
        // B站和YouTube链接
        if (urlLower.includes('bilibili.com') || urlLower.includes('b23.tv')) {
            return { url, type: 'iframe' };
        }
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
            return { url, type: 'iframe' };
        }
        
        return null;
    }

    async sniffAndPlay(url, title) {
        try {
            this.showLoading('正在尝试读取视频源...');
            console.log(`嗅探视频URL: ${url}`);
            
            // 先尝试最简单直接的检测 - 防止其他复杂逻辑导致识别失败
            const simpleCheck = this.checkSimpleVideoUrl(url);
            if (simpleCheck) {
                console.log('通过简单检查识别到视频:', simpleCheck);
                await this.tryPlayVideo(simpleCheck.url, simpleCheck.type);
                
                // 成功播放后，隐藏加载状态并更新标题
                this.hideLoading();
                document.title = `${title} - 增强版视频播放器`;
                document.getElementById('currentVideoTitle').textContent = title;
                return;
            }
            
            // 如果简单检查失败，再使用嗅探器进行复杂检测
            console.log('简单检查失败，使用嗅探器检测');
            const result = await this.sniffer.sniffVideoUrl(url);
            if (result) {
                console.log('嗅探器检测结果:', result);
                await this.tryPlayVideo(result.url, result.type);
                
                // 成功播放后，隐藏加载状态并更新标题
                this.hideLoading();
                document.title = `${title} - 增强版视频播放器`;
                document.getElementById('currentVideoTitle').textContent = title;
            } else {
                throw new Error('No video found');
            }
        } catch (error) {
            console.error('嗅探失败:', error);
            this.showError('无法找到可播放的视频源');
            throw error;
        }
    }

    showLoading(message = '正在加载视频...') {
        const container = document.querySelector(this.options.container);
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <p class="loading-message">${message}</p>
        `;
        container.appendChild(loading);
    }

    hideLoading() {
        const loading = document.querySelector('.loading-overlay');
        if (loading) {
            loading.remove();
        }
    }

    showError(message) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'video-error';
        errorContainer.innerHTML = `
            <div class="error-message">
                <i class="material-icons">error_outline</i>
                <p>${message}</p>
                <button onclick="location.reload()">
                    <i class="material-icons">refresh</i>
                    重试
                </button>
            </div>
        `;

        const container = document.querySelector(this.options.container);
        container.innerHTML = '';
        container.appendChild(errorContainer);
    }
    
    hideError() {
        const errorElements = document.querySelectorAll('.video-error');
        errorElements.forEach(element => element.remove());
    }
    
    /**
     * 播放iframe类型的视频（B站、YouTube等）
     */
    playIframe(url) {
        console.log('使用iframe播放:', url);
        const container = document.querySelector(this.options.container);
        
        // 清空播放器容器
        container.innerHTML = '';
        
        // 创建iframe
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        
        // 添加到容器
        container.appendChild(iframe);
        
        // 隐藏加载状态
        this.hideLoading();
    }

    bindEvents() {
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch(e.key) {
                case 'ArrowLeft':
                    if (e.ctrlKey) this.prev();
                    else if (this.artInstance) this.seek(-10);
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey) this.next();
                    else if (this.artInstance) this.seek(10);
                    break;
                case ' ':
                    this.togglePlay(e);
                    break;
                case 'f':
                case 'F':
                    this.toggleFullscreen();
                    break;
                case 'm':
                case 'M':
                    this.toggleMute();
                    break;
                case 'ArrowUp':
                    this.adjustVolume(0.1);
                    break;
                case 'ArrowDown':
                    this.adjustVolume(-0.1);
                    break;
            }
        });

        // 侧边栏控制
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('showSidebar').addEventListener('click', () => this.showSidebar());
        
        // 视频控制
        document.getElementById('prevVideo').addEventListener('click', () => this.prev());
        document.getElementById('nextVideo').addEventListener('click', () => this.next());
        document.getElementById('toggleFullscreen').addEventListener('click', () => this.toggleFullscreen());

        // 移动设备处理
        if (this.isMobileDevice()) {
            document.addEventListener('touchend', (e) => {
                if (e.target.closest('.sidebar')) return;
                const sidebarElement = document.querySelector('.sidebar');
                if (sidebarElement && !sidebarElement.classList.contains('collapsed')) {
                    this.toggleSidebar();
                }
            });
        }
    }

    loadPlaylist() {
        const params = new URLSearchParams(window.location.search);
        const gistId = params.get('gist');
        
        if (gistId) {
            this.loadFromGist(gistId);
        } else {
            this.playlist = JSON.parse(localStorage.getItem('playlist') || '[]');
            this.renderPlaylist();
        }
    }

    async loadFromGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            const data = await response.json();
            
            const playlistFile = data.files['playlist.json'];
            if (playlistFile) {
                this.playlist = JSON.parse(playlistFile.content);
                this.renderPlaylist();
            }
        } catch (error) {
            console.error('Failed to load playlist from gist:', error);
            this.showError('无法加载播放列表');
        }
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
        if (this.artInstance) {
            this.artInstance.fullscreen = !this.artInstance.fullscreen;
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
}

// 初始化播放器
const videoPlayer = new VideoPlayer();
