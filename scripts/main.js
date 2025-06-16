// 主页面JavaScript - 视频管理和播放列表功能
class VideoManager {
    constructor() {
        this.videos = [];
        this.gistManager = improvedGistManager; // 使用改进的Gist管理器
        this.init();
    }    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.renderVideoList();
        this.updateUI();
        
        // 检查GitHub授权状态
        if (gitHubAuth && gitHubAuth.checkAuthStatus) {
            gitHubAuth.checkAuthStatus();
        }
        
        // 监听GitHub授权成功事件
        window.addEventListener('github-auth-success', () => {
            this.handleAuthSuccess();
        });
    }

    // 绑定事件监听器
    bindEvents() {
        // 添加视频表单
        const addForm = document.getElementById('addVideoForm');
        if (addForm) {
            addForm.addEventListener('submit', (e) => this.handleAddVideo(e));
        }

        // 清空列表按钮
        const clearBtn = document.getElementById('clearAllBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClearAll());
        }

        // 播放全部按钮
        const playAllBtn = document.getElementById('playAllBtn');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => this.handlePlayAll());
        }

        // 导出列表按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExport());
        }

        // 分享列表按钮
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.handleShare());
        }

        // 从Gist导入按钮
        const importFromGistBtn = document.getElementById('importFromGistBtn');
        if (importFromGistBtn) {
            importFromGistBtn.addEventListener('click', () => this.handleImportFromGist());
        }

        // 清空批量文本框按钮
        const clearBulkTextBtn = document.getElementById('clearBulkTextBtn');
        if (clearBulkTextBtn) {
            clearBulkTextBtn.addEventListener('click', () => this.clearBulkText());
        }

        // 添加批量添加按钮
        const bulkAddBtn = document.getElementById('bulkAddBtn');
        if (bulkAddBtn) {
            bulkAddBtn.addEventListener('click', () => this.handleBulkAdd());
        }

        // 模态框事件
        this.bindModalEvents();
    }

    // 绑定模态框事件
    bindModalEvents() {
        const modal = document.getElementById('modal');
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');

        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideModal());
        }

        if (modalCancel) {
            modalCancel.addEventListener('click', () => this.hideModal());
        }

        if (modalConfirm) {
            modalConfirm.addEventListener('click', () => {
                if (this.pendingAction) {
                    this.pendingAction();
                    this.pendingAction = null;
                }
                this.hideModal();
            });
        }

        // 点击背景关闭模态框
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }

        // 分享模态框事件
        this.bindShareModalEvents();
    }

    // 绑定分享模态框事件
    bindShareModalEvents() {
        const shareModal = document.getElementById('shareModal');
        const shareModalClose = document.getElementById('shareModalClose');

        if (shareModalClose) {
            shareModalClose.addEventListener('click', () => {
                if (shareModal) {
                    shareModal.classList.remove('show');
                }
            });
        }

        if (shareModal) {
            shareModal.addEventListener('click', (e) => {
                if (e.target === shareModal) {
                    shareModal.classList.remove('show');
                }
            });
        }
    }

    // 处理添加视频
    handleAddVideo(e) {
        e.preventDefault();
        
        const titleInput = document.getElementById('videoTitle');
        const urlInput = document.getElementById('videoUrl');
        const typeSelect = document.getElementById('videoType');

        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        const type = typeSelect.value;

        if (!title || !url) {
            this.showToast('请填写完整的视频信息', 'error');
            return;
        }

        // 检测视频类型
        const detectedType = type === 'auto' ? this.detectVideoType(url) : type;

        const video = {
            id: Date.now(),
            title,
            url,
            type: detectedType,
            addedAt: new Date().toISOString()
        };

        this.videos.push(video);
        this.saveToStorage();
        this.renderVideoList();
        this.updateUI();

        // 清空表单
        titleInput.value = '';
        urlInput.value = '';
        typeSelect.value = 'auto';

        this.showToast('视频添加成功', 'success');
    }

    // 检测视频类型
    detectVideoType(url) {
        url = url.toLowerCase();
        
        if (url.includes('.mp4') || url.includes('mp4')) {
            return 'mp4';
        } else if (url.includes('.m3u8') || url.includes('m3u8')) {
            return 'm3u8';
        } else if (url.includes('.flv') || url.includes('flv')) {
            return 'flv';
        } else if (url.includes('rtmp://')) {
            return 'rtmp';
        } else if (url.includes('bilibili.com') || url.includes('b23.tv')) {
            return 'bilibili';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        }
        
        return 'mp4'; // 默认类型
    }

    // 删除视频
    deleteVideo(id) {
        this.showModal(
            '确认删除',
            '确定要删除这个视频吗？此操作无法恢复。',
            () => {
                this.videos = this.videos.filter(video => video.id !== id);
                this.saveToStorage();
                this.renderVideoList();
                this.updateUI();
                this.showToast('视频删除成功', 'success');
            }
        );
    }    // 处理GitHub授权成功
    handleAuthSuccess() {
        // 隐藏授权相关的UI
        if (gitHubAuth && gitHubAuth.hideAuthUI) {
            gitHubAuth.hideAuthUI();
        }
        
        // 显示成功提示
        this.showToast('GitHub授权成功！现在可以分享播放列表了', 'success');
        
        // 如果有视频，提示可以分享
        if (this.videos.length > 0) {
            setTimeout(() => {
                this.showToast('点击"分享列表"按钮即可创建分享链接', 'info');
            }, 2000);
        }
    }

    // 播放单个视频
    playVideo(id) {
        const video = this.videos.find(v => v.id === id);
        if (video) {
            this.openPlayer([video], 0);
        }
    }

    // 打开播放器页面
    openPlayer(playlist, startIndex = 0) {
        try {
            // 保存播放列表到localStorage
            localStorage.setItem('currentPlaylist', JSON.stringify(playlist));
            localStorage.setItem('currentIndex', startIndex.toString());
            
            // 打开播放器页面
            window.open('player.html', '_blank');
        } catch (error) {
            console.error('打开播放器失败:', error);
            this.showToast('打开播放器失败，请重试', 'error');
        }
    }

    // 清空所有视频
    handleClearAll() {
        if (this.videos.length === 0) {
            this.showToast('播放列表已经是空的', 'warning');
            return;
        }

        this.showModal(
            '确认清空',
            `确定要清空所有 ${this.videos.length} 个视频吗？此操作无法恢复。`,
            () => {
                this.videos = [];
                this.saveToStorage();
                this.renderVideoList();
                this.updateUI();
                this.showToast('播放列表已清空', 'success');
            }
        );
    }

    // 播放全部视频
    handlePlayAll() {
        if (this.videos.length === 0) {
            this.showToast('播放列表为空，请先添加视频', 'warning');
            return;
        }

        this.openPlayer(this.videos, 0);
    }

    // 导出播放列表
    handleExport() {
        if (this.videos.length === 0) {
            this.showToast('播放列表为空，无法导出', 'warning');
            return;
        }

        const data = {
            name: '青云播播放列表',
            version: '1.0',
            exportTime: new Date().toISOString(),
            videos: this.videos
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `playlist-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('播放列表导出成功', 'success');
    }

    // 处理分享列表
    async handleShare() {
        if (this.videos.length === 0) {
            this.showToast('播放列表为空，无法分享', 'warning');
            return;
        }

        const shareMethod = localStorage.getItem('shareMethod');
        if (!shareMethod) {
            this.showToast('请先选择分享方式', 'warning');
            showMethodSelector();
            return;
        }

        try {
            this.showToast('正在创建分享链接...', 'info');
            
            let shareResult;
            
            if (shareMethod === 'github') {
                // 使用GitHub Gists
                if (!improvedGistManager.canShare()) {
                    gitHubAuth.showAuthGuide();
                    return;
                }
                
                shareResult = await improvedGistManager.sharePlaylist(
                    this.videos, 
                    `青云播放列表 - ${new Date().toLocaleString()}`,
                    `包含${this.videos.length}个视频的播放列表`
                );
                  } else if (shareMethod === 'selfhosted') {
                // 使用自建后端
                shareResult = await this.shareToBackend(
                    this.videos, 
                    `青云播放列表 - ${new Date().toLocaleString()}`,
                    `包含${this.videos.length}个视频的播放列表`
                );
            }

            if (shareResult) {
                this.showShareModal(shareResult);
            }
            
        } catch (error) {
            console.error('分享失败:', error);
            
            // 根据错误类型给出不同的提示
            let errorMessage = '分享失败: ' + error.message;
            
            if (shareMethod === 'selfhosted' && error.message.includes('fetch')) {
                errorMessage = '后端服务未启动，请先运行服务器或选择GitHub Gists方式';
            } else if (shareMethod === 'github' && error.message.includes('401')) {
                errorMessage = 'GitHub授权已过期，请重新授权';
            }
            
            this.showToast(errorMessage, 'error');
        }
    }

    // 显示分享模态框
    showShareModal(gistResult) {
        const modal = document.getElementById('shareModal');
        const shareUrl = document.getElementById('shareUrl');
        const shareQR = document.getElementById('shareQR');
        const copyUrlBtn = document.getElementById('copyUrlBtn');

        if (shareUrl) {
            shareUrl.value = gistResult.shareUrl;
        }

        if (shareQR) {
            shareQR.src = this.generateQRCode(gistResult.shareUrl);
        }

        if (copyUrlBtn) {
            copyUrlBtn.onclick = () => this.copyToClipboard(gistResult.shareUrl);
        }

        if (modal) {
            modal.classList.add('show');
        }
    }

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('链接已复制到剪贴板', 'success');
        } catch (error) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('链接已复制到剪贴板', 'success');
        }
    }

    // 生成二维码
    generateQRCode(url) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    }

    // 渲染视频列表
    renderVideoList() {
        const videoList = document.getElementById('videoList');
        const emptyState = document.getElementById('emptyState');

        if (!videoList || !emptyState) return;

        if (this.videos.length === 0) {
            emptyState.style.display = 'flex';
            videoList.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        videoList.style.display = 'block';

        videoList.innerHTML = this.videos.map((video, index) => `
            <div class="video-item">
                <div class="video-index">${index + 1}</div>
                <div class="video-info">
                    <div class="video-title">${this.escapeHtml(video.title)}</div>
                    <div class="video-meta">
                        <span class="video-url">${this.escapeHtml(video.url)}</span>
                        <span class="video-type">${video.type}</span>
                    </div>
                </div>
                <div class="video-actions">
                    <button class="action-btn play-btn" onclick="videoManager.playVideo(${video.id})" title="播放">
                        <i class="material-icons">play_arrow</i>
                    </button>
                    <button class="action-btn delete-btn" onclick="videoManager.deleteVideo(${video.id})" title="删除">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 更新UI状态
    updateUI() {
        const videoCount = document.getElementById('videoCount');
        if (videoCount) {
            videoCount.textContent = this.videos.length;
        }

        // 更新按钮状态
        const hasVideos = this.videos.length > 0;
        
        const playAllBtn = document.getElementById('playAllBtn');
        const exportBtn = document.getElementById('exportBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');

        if (playAllBtn) {
            playAllBtn.disabled = !hasVideos;
        }
        if (exportBtn) {
            exportBtn.disabled = !hasVideos;
        }
        if (clearAllBtn) {
            clearAllBtn.disabled = !hasVideos;
        }
    }

    // 显示模态框
    showModal(title, message, onConfirm) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');

        if (modal && modalTitle && modalMessage) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modal.classList.add('show');
            this.pendingAction = onConfirm;
        }
    }

    // 隐藏模态框
    hideModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.pendingAction = null;
    }

    // 显示提示消息
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 从localStorage加载数据
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('videoList');
            if (saved) {
                this.videos = JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载视频列表失败:', error);
            this.videos = [];
        }
    }

    // 保存到localStorage
    saveToStorage() {
        try {
            localStorage.setItem('videoList', JSON.stringify(this.videos));
        } catch (error) {
            console.error('保存视频列表失败:', error);
            this.showToast('保存失败，请检查存储空间', 'error');
        }
    }

    // 处理批量添加视频
    handleBulkAdd() {
        const bulkUrls = document.getElementById('bulkUrls');
        const typeSelect = document.getElementById('videoType');
        
        if (!bulkUrls) return;
        
        const urls = bulkUrls.value.trim().split('\n').filter(url => url.trim());
        
        if (urls.length === 0) {
            this.showToast('请输入至少一个视频链接', 'warning');
            return;
        }
        
        let addedCount = 0;
        const defaultType = typeSelect.value;
        
        urls.forEach(url => {
            url = url.trim();
            if (url) {
                // 从URL中提取文件名作为标题
                const title = this.extractTitleFromUrl(url);
                const detectedType = defaultType === 'auto' ? this.detectVideoType(url) : defaultType;
                
                const video = {
                    id: Date.now() + Math.random(),
                    title,
                    url,
                    type: detectedType,
                    addedAt: new Date().toISOString()
                };
                
                this.videos.push(video);
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            this.saveToStorage();
            this.renderVideoList();
            this.updateUI();
            
            // 清空批量输入框
            bulkUrls.value = '';
            
            this.showToast(`成功添加 ${addedCount} 个视频`, 'success');
        } else {
            this.showToast('没有有效的视频链接', 'error');
        }
    }

    // 从URL中提取标题
    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let filename = urlObj.pathname.split('/').pop();
            
            // 移除文件扩展名
            filename = filename.replace(/\.[^/.]+$/, '');
            
            // 如果文件名为空，使用域名
            if (!filename || filename.length === 0) {
                filename = urlObj.hostname;
            }
            
            // 解码URL编码的字符
            filename = decodeURIComponent(filename);
            
            // 替换特殊字符为空格
            filename = filename.replace(/[_-]/g, ' ');
            
            return filename || '未命名视频';
        } catch (error) {
            return '未命名视频';
        }
    }

    // 清空批量文本框
    clearBulkText() {
        const bulkUrls = document.getElementById('bulkUrls');
        if (bulkUrls) {
            bulkUrls.value = '';
            bulkUrls.focus();
        }
    }    // 从Gist导入视频
    async handleImportFromGist() {
        const gistUrlInput = document.getElementById('gistUrl');
        const input = gistUrlInput.value.trim();
        
        if (!input) {
            this.showToast('请输入分享链接或ID', 'warning');
            return;
        }

        const shareMethod = localStorage.getItem('shareMethod');
        if (!shareMethod) {
            this.showToast('请先选择分享方式', 'warning');
            showMethodSelector();
            return;
        }

        try {
            this.showToast('正在导入播放列表...', 'info');
            
            let gistData;
            
            if (shareMethod === 'github') {
                // 从GitHub Gists导入
                let gistId = this.extractGistId(input);
                if (!gistId) {
                    this.showToast('无效的GitHub Gist链接或ID', 'error');
                    return;
                }
                
                gistData = await improvedGistManager.loadPlaylist(gistId);
                
            } else if (shareMethod === 'selfhosted') {
                // 从自建后端导入
                let shareId = this.extractShareId(input);
                if (!shareId) {
                    this.showToast('无效的分享链接或ID', 'error');
                    return;
                }
                
                // 使用自建后端API加载
                gistData = await this.loadFromBackend(shareId);
            }
            
            if (gistData && gistData.videos && gistData.videos.length > 0) {
                // 询问用户是否要替换当前列表
                if (this.videos.length > 0) {
                    this.showConfirm(
                        '导入播放列表',
                        `即将导入 ${gistData.videos.length} 个视频，是否要替换当前播放列表？`,
                        () => this.importVideos(gistData.videos, true)
                    );
                } else {
                    this.importVideos(gistData.videos, false);
                }
                
                gistUrlInput.value = '';
            } else {
                this.showToast('分享链接中没有找到有效的视频数据', 'error');
            }
            
        } catch (error) {
            console.error('导入失败:', error);
            
            let errorMessage = '导入失败: ' + error.message;
            
            if (shareMethod === 'selfhosted' && error.message.includes('fetch')) {
                errorMessage = '后端服务未启动，请先运行服务器';
            } else if (shareMethod === 'github' && error.message.includes('Not Found')) {
                errorMessage = 'GitHub Gist不存在或已被删除';
            }
            
            this.showToast(errorMessage, 'error');
        }
    }

    // 提取Gist ID (GitHub方式)
    extractGistId(input) {
        // 如果是完整的URL
        if (input.includes('gist=')) {
            const match = input.match(/gist=([a-f0-9]+)/);
            return match ? match[1] : null;
        }
        
        // 如果是GitHub Gist URL
        if (input.includes('gist.github.com')) {
            const match = input.match(/gist\.github\.com\/[^\/]+\/([a-f0-9]+)/);
            return match ? match[1] : null;
        }
        
        // 如果直接是Gist ID
        if (/^[a-f0-9]{32}$/.test(input)) {
            return input;
        }
        
        return null;
    }
    
    // 提取分享ID (自建后端方式)
    extractShareId(input) {
        // 如果是完整的URL
        if (input.includes('share=')) {
            const match = input.match(/share=([a-f0-9-]+)/);
            return match ? match[1] : null;
        }
        
        // 如果直接是分享ID (UUID格式)
        if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input)) {
            return input;
        }
        
        // 如果直接是Gist ID
        if (/^[a-f0-9]{32}$/.test(input)) {
            return input;
        }
        
        return null;
    }
    
    // 提取分享ID (自建后端方式)
    extractShareId(input) {
        // 如果是完整的URL
        if (input.includes('share=')) {
            const match = input.match(/share=([a-f0-9-]+)/);
            return match ? match[1] : null;
        }
        
        // 如果直接是分享ID (UUID格式)
        if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input)) {
            return input;
        }
        
        return null;
    }

    // 导入视频
    importVideos(videos, replace = false) {
        if (replace) {
            this.videos = [];
        }
        
        videos.forEach(video => {
            this.videos.push({
                ...video,
                id: Date.now() + Math.random(), // 重新生成ID避免冲突
                addedAt: new Date().toISOString()
            });
        });
        
        this.saveToStorage();
        this.renderVideoList();
        this.updateUI();
        
        this.showToast(`成功导入 ${videos.length} 个视频`, 'success');
    }

    // 分享到自建后端
    async shareToBackend(videos, title, description = '') {
        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    videos: videos
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `分享失败: ${response.status}`);
            }

            const result = await response.json();
            return {
                id: result.shareId,
                shareUrl: result.shareUrl,
                title: result.title,
                videoCount: result.videoCount
            };
        } catch (error) {
            console.error('分享到自建后端失败:', error);
            throw error;
        }
    }

    // 从自建后端加载播放列表
    async loadFromBackend(shareId) {
        try {
            const response = await fetch(`/api/playlist/${shareId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('分享链接已过期或不存在');
                } else {
                    throw new Error(`加载失败: ${response.status}`);
                }
            }
            
            const data = await response.json();
            return {
                title: data.title,
                description: data.description,
                videos: JSON.parse(data.videos)
            };
        } catch (error) {
            console.error('从自建后端加载失败:', error);
            throw error;
        }
    }
}

// 页面加载完成后初始化
let videoManager;

document.addEventListener('DOMContentLoaded', () => {
    videoManager = new VideoManager();
});

// 防止页面意外关闭时数据丢失
window.addEventListener('beforeunload', () => {
    if (videoManager) {
        videoManager.saveToStorage();
    }
});
