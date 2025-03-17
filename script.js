class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.loadPlaylist();
        this.setupConfirmDialog();
    }

    setupConfirmDialog() {
        // 创建确认对话框
        const dialog = document.createElement('div');
        dialog.innerHTML = `
            <div class="dialog-overlay" id="dialogOverlay"></div>
            <div class="confirm-dialog" id="confirmDialog">
                <h3>确认删除</h3>
                <p>确定要删除这个视频吗？此操作无法撤销。</p>
                <div class="dialog-buttons">
                    <button onclick="playlistManager.cancelDelete()">取消</button>
                    <button class="danger-button" onclick="playlistManager.confirmDelete()">删除</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        this.confirmDialog = document.getElementById('confirmDialog');
        this.dialogOverlay = document.getElementById('dialogOverlay');
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

    removeVideo(index) {
        this.tempIndex = index;
        this.showConfirmDialog();
    }

    showConfirmDialog() {
        this.confirmDialog.classList.add('show');
        this.dialogOverlay.classList.add('show');
    }

    hideConfirmDialog() {
        this.confirmDialog.classList.remove('show');
        this.dialogOverlay.classList.remove('show');
    }

    cancelDelete() {
        this.hideConfirmDialog();
        this.tempIndex = null;
    }

    confirmDelete() {
        if (this.tempIndex !== null) {
            this.playlist.splice(this.tempIndex, 1);
            this.savePlaylist();
            this.renderPlaylist();
            this.hideConfirmDialog();
            this.tempIndex = null;
        }
    }

    clearPlaylist() {
        if (confirm('确定要清空整个播放列表吗？此操作无法撤销。')) {
            this.playlist = [];
            this.savePlaylist();
            this.renderPlaylist();
        }
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
        const clearButton = document.getElementById('clearPlaylistBtn');
        
        playlistElement.innerHTML = '';
        
        this.playlist.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.innerHTML = `
                <div class="playlist-item-content">
                    <i class="material-icons">play_circle_outline</i>
                    <span>${video.title}</span>
                </div>
                <button class="delete-button" onclick="event.stopPropagation(); playlistManager.removeVideo(${index})">
                    <i class="material-icons">delete</i>
                </button>
            `;
            playlistElement.appendChild(item);
        });

        // 更新清空列表按钮的显示状态
        clearButton.style.display = this.playlist.length > 0 ? 'flex' : 'none';

        // 更新播放页面链接的显示状态
        const playerPageLink = document.getElementById('playerPageLink');
        playerPageLink.style.display = this.playlist.length > 0 ? 'inline-block' : 'none';
    }

    generatePlayerPage() {
        const playlistData = encodeURIComponent(JSON.stringify(this.playlist));
        const playerUrl = `player.html?playlist=${playlistData}`;
        window.open(playerUrl, '_blank');
    }

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

// 清空播放列表
function clearPlaylist() {
    playlistManager.clearPlaylist();
}
