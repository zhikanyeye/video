class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.loadPlaylist();
    }

    addVideo(title, url) {
        this.playlist.push({ title, url });
        this.savePlaylist();
        this.renderPlaylist();
    }

    addBatchVideos(batchText) {
        const lines = batchText.split('\n');
        lines.forEach(line => {
            const [title, url] = line.split(',').map(item => item.trim());
            if (title && url) {
                this.addVideo(title, url);
            }
        });
    }

    savePlaylist() {
        localStorage.setItem('videoPlaylist', JSON.stringify(this.playlist));
    }

    loadPlaylist() {
        const saved = localStorage.getItem('videoPlaylist');
        this.playlist = saved ? JSON.parse(saved) : [];
        this.renderPlaylist();
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
        playlistElement.innerHTML = '';
        
        this.playlist.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.innerHTML = `${video.title}`;
            playlistElement.appendChild(item);
        });

        // 如果有视频，显示播放页面链接
        const playerPageLink = document.getElementById('playerPageLink');
        if (this.playlist.length > 0) {
            playerPageLink.style.display = 'inline-block';
        } else {
            playerPageLink.style.display = 'none';
        }
    }

    generatePlayerPage() {
        // 保存播放列表到localStorage后自动打开播放页面
        this.savePlaylist();
        window.open('player.html', '_blank');
    }
}

// 初始化播放列表管理器
const playlistManager = new PlaylistManager();

// 添加单个视频
function addVideo() {
    const titleInput = document.getElementById('videoTitle');
    const urlInput = document.getElementById('videoUrl');
    
    if (titleInput.value && urlInput.value) {
        playlistManager.addVideo(titleInput.value, urlInput.value);
        titleInput.value = '';
        urlInput.value = '';
    } else {
        alert('请输入视频标题和链接！');
    }
}

// 批量添加视频
function addBatchVideos() {
    const batchInput = document.getElementById('batchInput');
    if (batchInput.value) {
        playlistManager.addBatchVideos(batchInput.value);
        batchInput.value = '';
    } else {
        alert('请输入批量添加的视频数据！');
    }
}

// 生成播放页面
function generatePlayerPage() {
    playlistManager.generatePlayerPage();
}
