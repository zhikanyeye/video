class EnhancedVideoPlayer {
    constructor() {
        try {
            this.player = null;
            this.playlist = [];
            this.currentVideoIndex = -1;
            this.isFullscreen = false;
            
            // 添加错误处理
            window.onerror = (message, source, lineno, colno, error) => {
                console.error('Player Error:', error);
                this.showError(`加载出错: ${message}`);
            };
            
            this.setupVideoPlayer();
            this.loadPlaylist();
            this.setupEventListeners();
            this.setupVideoSniffer();
        } catch (error) {
            console.error('Initialization Error:', error);
            this.showError('播放器初始化失败，请刷新页面重试');
        }
    }

    setupVideoPlayer() {
        // 初始化video.js播放器
        this.player = videojs('videoElement', {
            fluid: true,
            html5: {
                hls: {
                    enableLowInitialPlaylist: true,
                    smoothQualityChange: true,
                    overrideNative: true
                }
            }
        });

        // 添加播放器错误处理
        this.player.on('error', () => {
            const error = this.player.error();
            console.error('Video.js Error:', error);
            this.showError(`视频加载失败: ${error.message}`);
        });
    }

    async loadPlaylist() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist') || localStorage.getItem('playlistGistId');

        if (gistId) {
            try {
                await this.loadFromGist(gistId);
                if (this.playlist.length > 0) {
                    this.play(0);
                }
            } catch (error) {
                console.error('Failed to load playlist:', error);
                this.showError('加载播放列表失败，请检查链接是否正确！');
            }
        }
    }

    async loadFromGist(gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            if (!response.ok) throw new Error('Failed to fetch Gist');
            
            const data = await response.json();
            const content = data.files['playlist.json'].content;
            this.playlist = JSON.parse(content);
            localStorage.setItem('playlistGistId', gistId);
            this.renderPlaylist();
            return true;
        } catch (error) {
            console.error('Failed to load from Gist:', error);
            throw error;
        }
    }

    setupVideoSniffer() {
        // 注入视频资源检测脚本
        const script = document.createElement('script');
        script.textContent = `
            // 拦截XHR请求
            const originalXHR = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function() {
                if (this._url && this.detectVideoUrl(this._url)) {
                    window.dispatchEvent(new CustomEvent('videoResourceDetected', {
                        detail: { url: this._url }
                    }));
                }
                return originalXHR.apply(this, arguments);
            };

            // 拦截Fetch请求
            const originalFetch = window.fetch;
            window.fetch = async function(input, init) {
                const url = typeof input === 'string' ? input : input.url;
                if (url && detectVideoUrl(url)) {
                    window.dispatchEvent(new CustomEvent('videoResourceDetected', {
                        detail: { url: url }
                    }));
                }
                return originalFetch.apply(this, arguments);
            };

            // 检测视频URL
            function detectVideoUrl(url) {
                return url.match(/\\.(mp4|m3u8|flv|ts)($|\\?)/i) ||
                       url.includes('/video/') ||
                       url.includes('stream');
            }
        `;
        document.head.appendChild(script);

        // 监听检测到的视频资源
        window.addEventListener('videoResourceDetected', (e) => {
            this.handleDetectedVideo(e.detail.url);
        });
    }

    handleDetectedVideo(url) {
        const title = `检测到的视频 ${this.playlist.length + 1}`;
        this.showSnifferAlert(`检测到新视频资源: ${url}`);
        this.addVideo(title, url);
    }

    showSnifferAlert(message) {
        const alert = document.getElementById('snifferAlert');
        const messageEl = document.getElementById('snifferMessage');
        messageEl.textContent = message;
        alert.classList.add('show');
        setTimeout(() => alert.classList.remove('show'), 3000);
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            const video = this.playlist[index];
            this.currentVideoIndex = index;

            if (this.isExternalVideo(video.url)) {
                this.playExternalVideo(video);
            } else {
                this.playLocalVideo(video);
            }

            this.updateActiveItem();
            this.updateVideoTitle(video.title);
            this.updateNavigationButtons();
        }
    }

    playLocalVideo(video) {
        const url = video.url;
        
        if (url.endsWith('.m3u8')) {
            this.playHLSVideo(url);
        } else if (url.endsWith('.flv')) {
            this.playFLVVideo(url);
        } else if (url.endsWith('.ts')) {
            this.playTSVideo(url);
        } else {
            this.player.src({ type: 'video/mp4', src: url });
            this.player.play().catch(error => {
                console.error('Video playback failed:', error);
                this.showError('视频播放失败，请检查视频链接是否有效');
            });
        }
    }

    playHLSVideo(url) {
        if (Hls.isSupported()) {
            const hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true
            });
            hls.loadSource(url);
            hls.attachMedia(this.player.tech().el());
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.player.play().catch(error => {
                    console.error('HLS playback failed:', error);
                    this.showError('HLS视频加载失败，请检查网络连接');
                });
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    this.showError('HLS视频播放错误，尝试使用其他格式');
                }
            });
        } else if (this.player.canPlayType('application/vnd.apple.mpegurl')) {
            this.player.src({
                src: url,
                type: 'application/x-mpegURL'
            });
            this.player.play();
        } else {
            this.showError('当前浏览器不支持HLS视频播放');
        }
    }

    playFLVVideo(url) {
        if (flvjs.isSupported()) {
            const flvPlayer = flvjs.createPlayer({
                type: 'flv',
                url: url
            });
            flvPlayer.attachMediaElement(this.player.tech().el());
            flvPlayer.load();
            flvPlayer.play();

            flvPlayer.on(flvjs.Events.ERROR, (error) => {
                console.error('FLV playback failed:', error);
                this.showError('FLV视频播放失败，请检查视频格式');
            });
        } else {
            this.showError('当前浏览器不支持FLV视频播放');
        }
    }

    playTSVideo(url) {
        this.player.src({ type: 'video/mp2t', src: url });
        this.player.play().catch(error => {
            console.error('TS playback failed:', error);
            this.showError('TS视频播放失败，请检查视频链接是否有效');
        });
    }

    playExternalVideo(video) {
        const embedCode = this.createEmbedCode(video.url);
        if (embedCode) {
            document.getElementById('player').innerHTML = embedCode;
        } else {
            this.showError('不支持的视频链接格式');
        }
    }

    isExternalVideo(url) {
        return url.includes('youtube.com') || 
               url.includes('youtu.be') || 
               url.includes('bilibili.com');
    }

    createEmbedCode(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = this.getYouTubeVideoId(url);
            return videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>` : null;
        } else if (url.includes('bilibili.com')) {
            const bvid = this.getBilibiliVideoId(url);
            return bvid ? `<iframe src="//player.bilibili.com/player.html?bvid=${bvid}" frameborder="0" allowfullscreen></iframe>` : null;
        }
        return null;
    }

    getYouTubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    }

    getBilibiliVideoId(url) {
        const match = url.match(/BV\w+/);
        return match ? match[0] : null;
    }

    setupEventListeners() {
        // 侧边栏切换
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // 显示侧边栏
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
                case 'f':
                case 'F':
                    this.toggleFullscreen();
                    break;
                case ' ':
                    if (this.player) {
                        if (this.player.paused()) {
                            this.player.play();
                        } else {
                            this.player.pause();
                        }
                        e.preventDefault();
                    }
                    break;
            }
        });

        // 响应式侧边栏显示和隐藏
        document.getElementById('showSidebar').addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.add('show');
        });

        document.querySelector('.sidebar').addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.remove('show');
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

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
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

    addVideo(title, url) {
        this.playlist.push({ title, url });
        this.renderPlaylist();
        this.saveToGist().catch(error => {
            console.error('Failed to save to Gist:', error);
            this.showError('保存到播放列表失败');
        });
    }

    async saveToGist() {
        const token = localStorage.getItem('githubToken');
        if (!token) {
            throw new Error('GitHub Token not set');
        }

        const gistId = localStorage.getItem('playlistGistId');
        const gistData = {
            description: "Enhanced Video Playlist Data",
            public: true,
            files: {
                "playlist.json": {
                    content: JSON.stringify(this.playlist)
                }
            }
        };

        try {
            let response;
            if (gistId) {
                response = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
            } else {
                                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
                const data = await response.json();
                localStorage.setItem('playlistGistId', data.id);
            }

            if (!response.ok) {
                throw new Error('Failed to save to Gist');
            }
        } catch (error) {
            console.error('Failed to save playlist to Gist:', error);
            throw error;
        }
    }

    clearPlaylist() {
        if (confirm('确定要清空整个播放列表吗？此操作无法撤销。')) {
            this.playlist = [];
            this.currentVideoIndex = -1;
            this.renderPlaylist();
            this.updateVideoTitle('等待播放...');
            this.updateNavigationButtons();
            this.saveToGist().catch(error => {
                console.error('Failed to save to Gist:', error);
                this.showError('清空播放列表失败');
            });
        }
    }

    // 工具方法：检查URL是否可访问
    async checkUrlAvailability(url) {
        try {
            const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch (error) {
            return false;
        }
    }

    // 工具方法：格式化时间
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 工具方法：生成唯一ID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 析构函数：清理资源
    destroy() {
        if (this.player) {
            this.player.dispose();
        }
        // 移除所有事件监听器
        document.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('videoResourceDetected', this.handleDetectedVideo);
    }
}

// 确保在页面卸载时清理资源
window.addEventListener('unload', () => {
    if (window.videoPlayer) {
        window.videoPlayer.destroy();
    }
});
