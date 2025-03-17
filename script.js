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
        // 将播放列表数据编码为URL安全的字符串
        const playlistData = encodeURIComponent(JSON.stringify(this.playlist));
        // 使用URL参数传递播放列表数据
        const playerUrl = `player.html?playlist=${playlistData}`;
        window.open(playerUrl, '_blank');
    }

    // 新增：导出播放列表链接
    getShareableLink() {
        const playlistData = encodeURIComponent(JSON.stringify(this.playlist));
        const currentUrl = window.location.href.split('?')[0];
        const playerUrl = currentUrl.replace('index.html', `player.html?playlist=${playlistData}`);
        return playerUrl;
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

// 复制分享链接
function copyShareableLink() {
    const link = playlistManager.getShareableLink();
    navigator.clipboard.writeText(link).then(() => {
        alert('播放列表链接已复制到剪贴板！');
    }).catch(() => {
        // 如果剪贴板API不可用，创建一个临时输入框
        const tempInput = document.createElement('input');
        tempInput.value = link;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        alert('播放列表链接已复制到剪贴板！');
    });
}
