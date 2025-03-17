class VideoPlayer {
    constructor() {
        this.player = document.getElementById('player');
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.tempIndex = null;
        this.isFullscreen = false;
        this.loadPlaylistFromUrl();
        this.renderPlaylist();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 侧边栏切换按钮
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // 显示侧边栏按钮
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
                    document.getElementById('prevVideo').click();
                    break;
                case 'ArrowRight':
                    document.getElementById('nextVideo').click();
                    break;
                case 'f':
                    this.toggleFullscreen();
                    break;
                case 'Escape':
                    if (this.isFullscreen) {
                        this.exitFullscreen();
                    }
                    break;
            }
        });

        // 监听全屏变化
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
        });
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const icon = document.querySelector('#toggleSidebar i');
        sidebar.classList.toggle('collapsed');
        icon.textContent = sidebar.classList.contains('collapsed') ? 'chevron_right' : 'chevron_left';

        // 当侧边栏隐藏时，延迟一点时间后自动全屏
        if (sidebar.classList.contains('collapsed') && !this.isFullscreen) {
            setTimeout(() => {
                this.enterFullscreen();
            }, 300);
        }
    }

    showSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const icon = document.querySelector('#toggleSidebar i');
        sidebar.classList.remove('collapsed');
        icon.textContent = 'chevron_left';

        // 如果当前是全屏状态，退出全屏
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();
        }
        this.isFullscreen = true;
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        this.isFullscreen = false;
    }

    loadPlaylistFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const playlistData = urlParams.get('playlist');
        
        if (playlistData) {
            try {
                this.playlist = JSON.parse(decodeURIComponent(playlistData));
            } catch (e) {
                console.error('Failed to load playlist from URL:', e);
                this.playlist = [];
            }
        }
        this.updateVideoCount();
    }

    updateVideoCount() {
        const countElement = document.querySelector('.video-count');
        if (countElement) {
            countElement.textContent = `${this.playlist.length} 个视频`;
        }
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            const video = this.playlist[index];
            this.currentVideoIndex = index;
            let embedCode = this.createEmbedCode(video.url);
            this.player.innerHTML = embedCode;
            this.updateActiveItem();
            this.updateVideoTitle(video.title);
            this.updateUrlWithCurrentState();
            this.updateNavigationButtons();
        }
    }

    removeVideo(index) {
        this.tempIndex = index;
        this.showConfirmDialog();
    }

    showConfirmDialog() {
        document.getElementById('dialogOverlay').classList.add('show');
        document.getElementById('confirmDialog').classList.add('show');
    }

    hideConfirmDialog() {
        document.getElementById('dialogOverlay').classList.remove('show');
        document.getElementById('confirmDialog').classList.remove('show');
    }

    cancelDelete() {
        this.hideConfirmDialog();
        this.tempIndex = null;
    }

    confirmDelete() {
        if (this.tempIndex !== null) {
            // 如果删除的是当前播放的视频，先切换到下一个视频
            if (this.tempIndex === this.currentVideoIndex) {
                if (this.tempIndex < this.playlist.length - 1) {
                    this.play(this.tempIndex + 1);
                } else if (this.playlist.length > 1) {
                    this.play(this.tempIndex - 1);
                } else {
                    this.player.innerHTML = `
                        <div class="no-video">
                            <i class="material-icons">play_circle_outline</i>
                            <p>请从播放列表选择视频进行播放</p>
                        </div>
                    `;
                    this.currentVideoIndex = -1;
                }
            }

            this.playlist.splice(this.tempIndex, 1);
            this.updateUrlWithCurrentState();
            this.renderPlaylist();
            this.hideConfirmDialog();
            this.tempIndex = null;
        }
    }

    clearPlaylist() {
        if (confirm('确定要清空整个播放列表吗？此操作无法撤销。')) {
            this.playlist = [];
            this.currentVideoIndex = -1;
            this.updateUrlWithCurrentState();
            this.renderPlaylist();
            this.player.innerHTML = `
                <div class="no-video">
                    <i class="material-icons">play_circle_outline</i>
                    <p>请从播放列表选择视频进行播放</p>
                </div>
            `;
        }
    }

    updateVideoTitle(title) {
        document.getElementById('currentVideoTitle').textContent = title;
    }

    updateNavigationButtons() {
        document.getElementById('prevVideo').disabled = this.currentVideoIndex <= 0;
        document.getElementById('nextVideo').disabled = this.currentVideoIndex >= this.playlist.length - 1;
    }

    updateUrlWithCurrentState() {
        const playlistData = encodeURIComponent(JSON.stringify(this.playlist));
        const newUrl = `${window.location.pathname}?playlist=${playlistData}&current=${this.currentVideoIndex}`;
        window.history.replaceState({}, '', newUrl);
    }

    createEmbedCode(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = this.getYouTubeVideoId(url);
            return `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
        } else if (url.includes('bilibili.com')) {
            let bvid = this.getBilibiliVideoId(url);
            return `<iframe src="//player.bilibili.com/player.html?bvid=${bvid}" allowfullscreen></iframe>`;
        } else {
            return `<video src="${url}" controls autoplay></video>`;
        }
    }

    getYouTubeVideoId(url) {
        let videoId = '';
        let match = url.match(/[?&]v=([^&]+)/);
        if (match) {
            videoId = match[1];
        } else {
            match = url.match(/youtu\.be\/([^?]+)/);
            if (match) {
                videoId = match[1];
            }
        }
        return videoId;
    }

    getBilibiliVideoId(url) {
        let match = url.match(/BV\w+/);
        return match ? match[0] : '';
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
                <button class="delete-button" onclick="event.stopPropagation(); videoPlayer.removeVideo(${index})">
                    <i class="material-icons">delete</i>
                </button>
            `;
            playlistElement.appendChild(item);
        });

        this.updateVideoCount();
        this.updateNavigationButtons();
    }
}

// 初始化视频播放器
const videoPlayer = new VideoPlayer();
