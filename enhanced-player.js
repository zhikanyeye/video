class EnhancedVideoPlayer {
    constructor() {
        this.player = null;
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.isFullscreen = false;
        this.setupVideoPlayer();
        this.loadPlaylist();
        this.setupEventListeners();
        this.setupVideoSniffer();
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
            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                if (this.detectVideoUrl(url)) {
                    this.dispatchVideoDetected(url);
                }
                return originalXHROpen.apply(this, arguments);
            };

            // 拦截Fetch请求
            const originalFetch = window.fetch;
            window.fetch = async function(input, init) {
                const url = typeof input === 'string' ? input : input.url;
                if (this.detectVideoUrl(url)) {
                    this.dispatchVideoDetected(url);
                }
                return originalFetch.apply(this, arguments);
            };

            // 检测视频URL
            function detectVideoUrl(url) {
                return url.match(/\\.(mp4|m3u8|flv)($|\\?)/i) ||
                       url.includes('/video/') ||
                       url.includes('stream');
            }

            // 发送检测事件
            function dispatchVideoDetected(url) {
                window.dispatchEvent(new CustomEvent('videoResourceDetected', {
                    detail: { url: url }
                }));
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
        
        // 根据URL类型选择适当的播放方式
        if (url.endsWith('.m3u8')) {
            this.playHLSVideo(url);
        } else if (url.endsWith('.flv')) {
            this.playFLVVideo(url);
        } else {
            // 普通视频直接使用video.js播放
            this.player.src({ type: 'video/mp4', src: url });
        }
        
        this.player.play();
    }

    playHLSVideo(url) {
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(this.player.tech().el());
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.player.play();
            });
        } else if (this.player.canPlayType('application/vnd.apple.mpegurl')) {
            this.player.src({ type: 'application/x-mpegURL', src: url });
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
        }
    }

    playExternalVideo(video) {
        const embedCode = this.createEmbedCode(video.url);
        document.getElementById('player').innerHTML = embedCode;
    }

    isExternalVideo(url) {
        return url.includes('youtube.com') || 
               url.includes('youtu.be') || 
               url.includes('bilibili.com');
    }

    createEmbedCode(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = this.getYouTubeVideoId(url);
            return `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
        } else if (url.includes('bilibili.com')) {
            const bvid = this.getBilibiliVideoId(url);
            return `<iframe src="//player.bilibili.com/player.html?bvid=${bvid}" allowfullscreen></iframe>`;
        }
        return '';
    }

    getYouTubeVideoId(url) {
        const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandalsResorts#\w\/\w\/.*\/))([^\/&]{10,12})/);
        return match ? match[1] : '';
    }

    getBilibiliVideoId(url) {
        const match = url.match(/BV\w+/);
        return match ? match[0] : '';
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
                    this.toggleFullscreen();
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

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    showError(message) {
        const playerElement = document.getElementById('player');
        playerElement.innerHTML = `
            <div class="error-message">
                <i class="material-icons">error_outline</i>
                <p>${message}</p>
            </div>
        `;
    }

    addVideo(title, url) {
        this.playlist.push({ title, url });
        this.renderPlaylist();
        this.saveToGist().catch(error => {
            console.error('Failed to save to Gist:', error);
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
                // 更新现有的 Gist
                response = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(gistData)
                });
            } else {
                // 创建新的 Gist
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
            });
        }
    }
}

// 初始化播放器
const videoPlayer = new EnhancedVideoPlayer();
