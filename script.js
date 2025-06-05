// 播放列表数据
let playlist = [];
let githubToken = localStorage.getItem('githubToken');

// 视频类型处理器
const videoProcessors = {
    bilibili: {
        pattern: /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/([A-Za-z0-9]+)/,
        process: (url, match) => {
            return `//player.bilibili.com/player.html?bvid=${match[1]}&page=1`;
        }
    },
    youtube: {
        pattern: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/,
        process: (url, match) => {
            return `//www.youtube.com/embed/${match[1]}`;
        }
    },
    direct: {
        pattern: /.*/,
        process: (url) => url
    }
};

// 添加单个视频
function addVideo() {
    const title = document.getElementById('videoTitle').value.trim();
    const url = document.getElementById('videoUrl').value.trim();
    const type = document.getElementById('videoType').value;

    if (!title || !url) {
        showAlert('请填写视频标题和链接！', 'error');
        return;
    }

    const processor = videoProcessors[type];
    const match = url.match(processor.pattern);
    
    if (!match && type !== 'direct') {
        showAlert('无效的视频链接格式！', 'error');
        return;
    }

    const processedUrl = processor.process(url, match);
    
    playlist.push({
        title,
        url: processedUrl,
        type,
        addedAt: new Date().toISOString()
    });

    updatePlaylistDisplay();
    clearInputs();
    saveToLocalStorage();
    showAlert('视频添加成功！');
}

// 批量添加视频
function addBatchVideos() {
    const input = document.getElementById('batchInput').value.trim();
    if (!input) {
        showAlert('请输入视频信息！', 'error');
        return;
    }

    const lines = input.split('\n');
    let addedCount = 0;

    lines.forEach(line => {
        const [title, url, type = 'direct'] = line.split(',').map(item => item.trim());
        if (title && url) {
            const processor = videoProcessors[type];
            if (processor) {
                const match = url.match(processor.pattern);
                if (match || type === 'direct') {
                    const processedUrl = processor.process(url, match);
                    playlist.push({
                        title,
                        url: processedUrl,
                        type,
                        addedAt: new Date().toISOString()
                    });
                    addedCount++;
                }
            }
        }
    });

    updatePlaylistDisplay();
    document.getElementById('batchInput').value = '';
    saveToLocalStorage();
    showAlert(`成功添加 ${addedCount} 个视频！`);
}

// 创建 Gist
async function createGist() {
    const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            description: 'Video Playlist',
            public: true,
            files: {
                'playlist.json': {
                    content: JSON.stringify(playlist, null, 2)
                }
            }
        })
    });

    if (!response.ok) {
        throw new Error('Failed to create gist');
    }

    return response.json();
}

// 生成播放页面
async function generatePlayerPage() {
    if (playlist.length === 0) {
        showAlert('播放列表为空！', 'error');
        return;
    }

    if (!githubToken) {
        showAlert('请先设置 GitHub Token！', 'error');
        return;
    }

    try {
        const gist = await createGist();
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        const playerUrl = `${baseUrl}player.html?gist=${gist.id}`;
        window.open(playerUrl, '_blank');
        showAlert('播放列表创建成功！');
    } catch (error) {
        showAlert('创建播放列表失败！请检查GitHub Token是否有效', 'error');
        console.error(error);
    }
}

// 复制分享链接
async function copyShareableLink() {
    if (playlist.length === 0) {
        showAlert('播放列表为空！', 'error');
        return;
    }

    if (!githubToken) {
        showAlert('请先设置 GitHub Token！', 'error');
        return;
    }

    try {
        const gist = await createGist();
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        const shareableLink = `${baseUrl}player.html?gist=${gist.id}`;
        
        await navigator.clipboard.writeText(shareableLink);
        showAlert('分享链接已复制到剪贴板！');
    } catch (error) {
        showAlert('生成分享链接失败！请检查GitHub Token是否有效', 'error');
        console.error(error);
    }
}

// 下载播放列表
function downloadPlaylist() {
    if (playlist.length === 0) {
        showAlert('播放列表为空！', 'error');
        return;
    }

    const dataStr = JSON.stringify(playlist, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlist-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 上传播放列表
function uploadPlaylist(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedPlaylist = JSON.parse(e.target.result);
                if (Array.isArray(importedPlaylist)) {
                    playlist = importedPlaylist;
                    updatePlaylistDisplay();
                    saveToLocalStorage();
                    showAlert('播放列表导入成功！');
                } else {
                    showAlert('无效的播放列表文件！', 'error');
                }
            } catch (error) {
                showAlert('播放列表文件解析失败！', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// 保存 GitHub Token
function saveGitHubToken() {
    const token = document.getElementById('githubToken').value.trim();
    if (token) {
        githubToken = token;
        localStorage.setItem('githubToken', token);
        document.getElementById('githubToken').value = '';
        showAlert('Token 保存成功！');
    } else {
        showAlert('请输入有效的 Token！', 'error');
    }
}

// 更新播放列表显示
function updatePlaylistDisplay() {
    const playlistElement = document.getElementById('playlist');
    const clearButton = document.getElementById('clearPlaylistBtn');

    if (playlist.length > 0) {
        clearButton.style.display = 'block';
        playlistElement.innerHTML = playlist.map((video, index) => `
            <div class="playlist-item">
                <div class="playlist-item-content">
                    <i class="material-icons">play_circle_outline</i>
                    <span>${video.title}</span>
                    <span class="video-type">${video.type}</span>
                </div>
                <div class="playlist-item-actions">
                    <button class="icon-button" onclick="moveVideo(${index}, -1)" ${index === 0 ? 'disabled' : ''}>
                        <i class="material-icons">arrow_upward</i>
                    </button>
                    <button class="icon-button" onclick="moveVideo(${index}, 1)" ${index === playlist.length - 1 ? 'disabled' : ''}>
                        <i class="material-icons">arrow_downward</i>
                    </button>
                    <button class="icon-button delete-button" onclick="removeVideo(${index})">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        clearButton.style.display = 'none';
        playlistElement.innerHTML = '<div class="empty-playlist">播放列表为空</div>';
    }
}

// 移动视频位置
function moveVideo(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < playlist.length) {
        const temp = playlist[index];
        playlist[index] = playlist[newIndex];
        playlist[newIndex] = temp;
        updatePlaylistDisplay();
        saveToLocalStorage();
    }
}

// 移除视频
function removeVideo(index) {
    playlist.splice(index, 1);
    updatePlaylistDisplay();
    saveToLocalStorage();
    showAlert('视频已移除！');
}

// 清空播放列表
function clearPlaylist() {
    if (confirm('确定要清空播放列表吗？')) {
        playlist = [];
        updatePlaylistDisplay();
        saveToLocalStorage();
        showAlert('播放列表已清空！');
    }
}

// 保存到本地存储
function saveToLocalStorage() {
    localStorage.setItem('playlist', JSON.stringify(playlist));
}

// 从本地存储加载
function loadFromLocalStorage() {
    const savedPlaylist = localStorage.getItem('playlist');
    if (savedPlaylist) {
        try {
            playlist = JSON.parse(savedPlaylist);
            updatePlaylistDisplay();
        } catch (error) {
            console.error('Failed to load playlist from localStorage:', error);
        }
    }
}

// 清空输入框
function clearInputs() {
    document.getElementById('videoTitle').value = '';
    document.getElementById('videoUrl').value = '';
    document.getElementById('videoType').value = 'direct';
}

// 显示提示信息
function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
});
