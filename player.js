class VideoPlayer {
    constructor() {
        this.player = document.getElementById('player');
        this.playlist = [];
        this.currentVideoIndex = -1;
        this.loadPlaylist();
        this.renderPlaylist();
    }

    loadPlaylist() {
        const saved = localStorage.getItem('videoPlaylist');
        this.playlist = saved ? JSON.parse(saved) : [];
    }

    play(index) {
        if (index >= 0 && index < this.playlist.length) {
            const video = this.playlist[index];
            this.currentVideoIndex = index;
            let embedCode = this.createEmbedCode(video.url);
            this.player.innerHTML = embedCode;
            this.updateActiveItem();
        }
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
            item.innerHTML = `${video.title}`;
            item.onclick = () => this.play(index);
            playlistElement.appendChild(item);
        });

        // 如果有视频，自动播放第一个
        if (this.playlist.length > 0 && this.currentVideoIndex === -1) {
            this.play(0);
        }
    }

    updateActiveItem() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            if (index === this.currentVideoIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// 初始化视频播放器
const videoPlayer = new VideoPlayer();
