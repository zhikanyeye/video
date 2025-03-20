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
        this.player = new DPlayer({
            container: document.getElementById('player'),
            autoplay: false,
            theme: '#2196F3',
            screenshot: true,
            hotkey: true,
            preload: 'auto',
            volume: 0.7,
            mutex: true,
            video: {
                quality: [],
                defaultQuality: 0,
                pic: '',
                thumbnails: ''
            },
            subtitle: {
                type: 'webvtt',
                fontSize: '20px',
                bottom: '10%',
                color: '#fff'
            },
            contextmenu: [
                {
                    text: '视频播放器 v1.0',
                    link: 'https://github.com/zhikanyeye/video'
                }
            ],
            highlight: true
        });

        this.player.on('error', () => {
            this.showError('视频加载失败，请检查视频链接是否有效');
        });

        this.player.on('ended', () => {
            if (this.currentVideoIndex < this.playlist.length - 1) {
                this.play(this.currentVideoIndex + 1);
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
        const script = document.createElement('script');
        script.textContent = `
            const originalXHR = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function() {
                if (this._url && this.detectVideoUrl(this._url)) {
                    window.dispatchEvent(new CustomEvent('videoResourceDetected', {
                        detail: { url: this._url }
                    }));
                }
                return originalXHR.apply(this, arguments);
            };

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

            function detectVideoUrl(url) {
                return url.match(/\\.(mp4|m3u8|flv|ts)($|\\?)/i) ||
                       url.includes('/video/') ||
                       url.includes('stream');
            }
        `;
        document.head.appendChild(script);

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
            this.playVideo(video);
            this.updateActiveItem();
            this.updateVideoTitle(video.title);
            this.updateNavigationButtons();
        }
    }

    playVideo(video) {
        const type = this.getVideoType(video.url);
        
        this.player.switchVideo(
            {
                url: video.url,
                type: type,
                pic: video.thumbnail || ''
            },
            {
                title: video.title
            }
        );

        this.player.play();
    }

    getVideoType(url) {
        if (url.includes('.m3u8')) {
            return 'hls';
        } else if (url.includes('.flv')) {
            return 'flv';
        } else if (url.includes('.ts')) {
            return 'auto';
        } else {
            return 'auto';
        }
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
            this.player.fullScreen.toggle();
        });

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

        // 如果是第一个视频，自动播放
        if (this.playlist.length === 1) {
            this.play(0);
        }
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
            this.player.pause();
            this.saveToGist().catch(error => {
                console.error('Failed to save to Gist:', error);
                this.showError('清空播放列表失败');
            });
        }
    }

    async checkUrlAvailability(url) {
        try {
            const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch (error) {
            return false;
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    destroy() {
        if (this.player) {
            this.player.destroy();
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
