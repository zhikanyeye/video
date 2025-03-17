class VideoPlayer {
    constructor() {
        this.player = document.getElementById('player');
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.loadPlaylistFromUrl();
        this.renderPlaylist();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 侧边栏切换
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
            const icon = document.querySelector('#toggleSidebar i');
            icon.textContent = icon.textContent === 'chevron_left' ? 'chevron_right' : 'chevron_left';
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
            if (!document.fullscreenElement) {
                document.querySelector('.video-container').requestFullscreen();
            } else {
                document.exitFullscreen();
            }
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
                    document.getElementById('toggleFullscreen').click();
                    break;
            }
        });
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
        } else {
            const saved = localStorage.getItem('videoPlaylist');
            this.playlist = saved ? JSON.parse(saved) : [];
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
            item.className = 'playlist-item';
            item.innerHTML = `
                <i class="material-icons">${this.currentVideoIndex === index ? 'play_arrow' : 'play_circle_outline'}</i>
                <span>${video.title}</span>
            `;
            item.onclick = () => this.play(index);
            playlistElement.appendChild(item);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const currentIndex = parseInt(urlParams.get('current')) || 0;
        
        if (this.playlist.length > 0) {
            this.play(currentIndex);
        }
    }

    updateActiveItem() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            if (index === this.currentVideoIndex) {
                item.classList.add('active');
                item.querySelector('.material-icons').textContent = 'play_arrow';
            } else {
                item.classList.remove('active');
                item.querySelector('.material-icons').textContent = 'play_circle_outline';
            }
        });
    }
}

// 初始化视频播放器
const videoPlayer = new VideoPlayer();
