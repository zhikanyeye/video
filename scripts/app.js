/**
 * 主应用程序逻辑
 * 处理首页的用户交互和功能
 */

import { 
    showToast, 
    debounce, 
    handleError, 
    downloadFile, 
    readFile, 
    copyToClipboard,
    modalManager,
    keyboardManager
} from './utils.js';
import { storage } from './storage.js';
import { playlistManager } from './playlistManager.js';
import { githubService } from './githubService.js';
import { videoDetector, VIDEO_TYPES } from './videoDetector.js';

class App {
    constructor() {
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.renderPlaylist();
        this.setupKeyboardShortcuts();
        
        // 检查URL参数（分享链接处理）
        this.handleUrlParams();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        // 表单元素
        this.addVideoForm = document.getElementById('addVideoForm');
        this.videoTitle = document.getElementById('videoTitle');
        this.videoUrl = document.getElementById('videoUrl');
        this.videoType = document.getElementById('videoType');

        // 批量导入元素
        this.batchTextarea = document.getElementById('batchTextarea');
        this.batchImportBtn = document.getElementById('batchImportBtn');
        this.fileInput = document.getElementById('fileInput');
        this.fileUploadArea = document.getElementById('fileUploadArea');

        // 播放列表控制
        this.searchInput = document.getElementById('searchInput');
        this.sortSelect = document.getElementById('sortSelect');
        this.playlistItems = document.getElementById('playlistItems');
        this.playlistCount = document.getElementById('playlistCount');
        this.emptyState = document.getElementById('emptyState');

        // 操作按钮
        this.playAllBtn = document.getElementById('playAllBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');

        // 设置相关
        this.settingsBtn = document.getElementById('settingsBtn');
        this.helpBtn = document.getElementById('helpBtn');
        this.githubToken = document.getElementById('githubToken');
        this.saveTokenBtn = document.getElementById('saveTokenBtn');
        this.toggleTokenVisibility = document.getElementById('toggleTokenVisibility');

        // 标签页
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 视频添加表单
        this.addVideoForm.addEventListener('submit', this.handleAddVideo.bind(this));

        // URL输入自动检测类型
        this.videoUrl.addEventListener('input', debounce(this.handleUrlChange.bind(this), 500));

        // 批量导入
        this.batchImportBtn.addEventListener('click', this.handleBatchImport.bind(this));

        // 文件上传
        this.fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        this.setupFileDropZone();

        // 搜索和排序
        this.searchInput.addEventListener('input', debounce(this.handleSearch.bind(this), 300));
        this.sortSelect.addEventListener('change', this.handleSort.bind(this));

        // 播放列表操作按钮
        this.playAllBtn.addEventListener('click', this.handlePlayAll.bind(this));
        this.shareBtn.addEventListener('click', this.handleShare.bind(this));
        this.exportBtn.addEventListener('click', this.handleExport.bind(this));
        this.clearAllBtn.addEventListener('click', this.handleClearAll.bind(this));

        // 设置和帮助
        this.settingsBtn.addEventListener('click', () => modalManager.open('settingsModal'));
        this.helpBtn.addEventListener('click', () => modalManager.open('helpModal'));

        // GitHub Token设置
        this.saveTokenBtn.addEventListener('click', this.handleSaveToken.bind(this));
        this.toggleTokenVisibility.addEventListener('click', this.toggleTokenVisibility_.bind(this));

        // 标签页切换
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', this.handleTabSwitch.bind(this));
        });

        // 播放列表变化监听
        playlistManager.addListener('update', this.renderPlaylist.bind(this));
        playlistManager.addListener('add', this.handleVideoAdded.bind(this));
        playlistManager.addListener('remove', this.handleVideoRemoved.bind(this));

        // 设置模态框关闭按钮
        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            modalManager.close('settingsModal');
        });
        document.getElementById('closeHelpModal').addEventListener('click', () => {
            modalManager.close('helpModal');
        });

        // 设置项变化监听
        this.bindSettingsEvents();
    }

    /**
     * 绑定设置项事件
     */
    bindSettingsEvents() {
        const autoplayEnabled = document.getElementById('autoplayEnabled');
        const loopPlaylist = document.getElementById('loopPlaylist');
        const defaultVolume = document.getElementById('defaultVolume');
        const volumeValue = document.getElementById('volumeValue');

        autoplayEnabled.addEventListener('change', (e) => {
            storage.setSetting('autoplay', e.target.checked);
        });

        loopPlaylist.addEventListener('change', (e) => {
            storage.setSetting('loop', e.target.checked);
        });

        defaultVolume.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            volumeValue.textContent = `${value}%`;
            storage.setSetting('volume', value / 100);
        });
    }

    /**
     * 设置文件拖拽区域
     */
    setupFileDropZone() {
        const dropZone = this.fileUploadArea;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', this.handleFileDrop.bind(this), false);
    }

    /**
     * 阻止默认事件
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 处理文件拖拽放置
     */
    handleFileDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * 处理URL变化
     */
    async handleUrlChange() {
        const url = this.videoUrl.value.trim();
        if (!url) return;

        try {
            // 检测视频类型
            const type = videoDetector.detectType(url);
            if (type !== VIDEO_TYPES.UNKNOWN) {
                this.videoType.value = type;
            }

            // 如果标题为空，尝试生成标题
            if (!this.videoTitle.value.trim()) {
                const info = await videoDetector.parseVideoInfo(url);
                if (info.title) {
                    this.videoTitle.value = info.title;
                }
            }
        } catch (error) {
            console.warn('URL解析失败:', error);
        }
    }

    /**
     * 处理添加视频
     */
    async handleAddVideo(e) {
        e.preventDefault();

        const title = this.videoTitle.value.trim();
        const url = this.videoUrl.value.trim();
        const type = this.videoType.value;

        if (!title || !url) {
            showToast('请填写完整的视频信息', 'error');
            return;
        }

        try {
            const video = await playlistManager.addVideo({
                title,
                url,
                type: type === 'auto' ? undefined : type
            });

            if (video) {
                // 清空表单
                this.addVideoForm.reset();
                this.videoType.value = 'auto';
            }
        } catch (error) {
            handleError(error, '添加视频');
        }
    }

    /**
     * 处理批量导入
     */
    async handleBatchImport() {
        const text = this.batchTextarea.value.trim();
        if (!text) {
            showToast('请输入要导入的视频列表', 'error');
            return;
        }

        try {
            const result = await playlistManager.importPlaylist(text, 'text', true);
            if (result) {
                this.batchTextarea.value = '';
            }
        } catch (error) {
            handleError(error, '批量导入');
        }
    }

    /**
     * 处理文件上传
     */
    handleFileUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    /**
     * 处理文件
     */
    async processFile(file) {
        if (!file.name.endsWith('.json')) {
            showToast('请选择JSON格式的播放列表文件', 'error');
            return;
        }

        try {
            const content = await readFile(file);
            const result = await playlistManager.importPlaylist(content, 'json', true);
            
            if (result) {
                showToast(`成功导入播放列表文件: ${file.name}`, 'success');
                // 清空文件输入
                this.fileInput.value = '';
            }
        } catch (error) {
            handleError(error, '导入文件');
        }
    }

    /**
     * 处理搜索
     */
    handleSearch(e) {
        const query = e.target.value;
        playlistManager.debouncedSearch(query);
    }

    /**
     * 处理排序
     */
    handleSort(e) {
        const sortBy = e.target.value;
        playlistManager.setSorting(sortBy);
    }

    /**
     * 处理标签页切换
     */
    handleTabSwitch(e) {
        const targetTab = e.target.dataset.tab;
        
        // 更新标签按钮状态
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === targetTab);
        });

        // 更新标签内容显示
        this.tabContents.forEach(content => {
            const isTarget = content.id === `${targetTab}Import`;
            content.classList.toggle('hidden', !isTarget);
        });
    }

    /**
     * 处理播放全部
     */
    handlePlayAll() {
        const playlist = playlistManager.getPlaylist();
        if (playlist.length === 0) {
            showToast('播放列表为空', 'warning');
            return;
        }

        // 跳转到播放器页面
        const playerUrl = './player.html';
        window.open(playerUrl, '_blank');
    }

    /**
     * 处理分享
     */
    async handleShare() {
        const playlist = playlistManager.getPlaylist(false); // 获取原始播放列表
        if (playlist.length === 0) {
            showToast('播放列表为空，无法分享', 'warning');
            return;
        }

        if (!githubService.getToken()) {
            showToast('请先在设置中配置GitHub Token', 'warning');
            modalManager.open('settingsModal');
            return;
        }

        try {
            showToast('正在生成分享链接...', 'info');
            
            const result = await githubService.sharePlaylist(playlist, {
                title: `播放列表 (${playlist.length}个视频)`,
                description: `分享于 ${new Date().toLocaleString()}`
            });

            if (result.success) {
                // 显示分享成功信息
                const message = `分享链接已生成并复制到剪贴板\n${result.shareUrl}`;
                showToast('分享成功！', 'success');
                
                // 可以在这里添加分享结果展示
                this.showShareResult(result);
            }
        } catch (error) {
            handleError(error, '分享播放列表');
        }
    }

    /**
     * 显示分享结果
     */
    showShareResult(result) {
        // 这里可以创建一个自定义模态框显示分享结果
        // 包括分享链接、二维码等
        const message = `分享成功！\n\n分享链接：${result.shareUrl}\n\nGist地址：${result.directUrl}`;
        alert(message);
    }

    /**
     * 处理导出
     */
    handleExport() {
        const playlist = playlistManager.getPlaylist(false);
        if (playlist.length === 0) {
            showToast('播放列表为空，无法导出', 'warning');
            return;
        }

        try {
            const data = playlistManager.export('json');
            const filename = `playlist_${new Date().toISOString().slice(0, 10)}.json`;
            downloadFile(data, filename, 'application/json');
            showToast('播放列表已导出', 'success');
        } catch (error) {
            handleError(error, '导出播放列表');
        }
    }

    /**
     * 处理清空列表
     */
    handleClearAll() {
        playlistManager.clear();
    }

    /**
     * 处理保存Token
     */
    async handleSaveToken() {
        const token = this.githubToken.value.trim();
        
        if (!token) {
            showToast('请输入GitHub Token', 'error');
            return;
        }

        try {
            githubService.setToken(token);
            
            // 测试连接
            const testResult = await githubService.testConnection();
            if (testResult.success) {
                showToast(testResult.message, 'success');
                modalManager.close('settingsModal');
            } else {
                showToast(`Token验证失败: ${testResult.error}`, 'error');
            }
        } catch (error) {
            handleError(error, '保存Token');
        }
    }

    /**
     * 切换Token可见性
     */
    toggleTokenVisibility_() {
        const input = this.githubToken;
        const icon = this.toggleTokenVisibility.querySelector('.material-icons');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            icon.textContent = 'visibility';
        }
    }

    /**
     * 处理视频添加后的回调
     */
    handleVideoAdded(video) {
        this.updateActionButtons();
    }

    /**
     * 处理视频删除后的回调
     */
    handleVideoRemoved(video) {
        this.updateActionButtons();
    }

    /**
     * 渲染播放列表
     */
    renderPlaylist() {
        const playlist = playlistManager.getPlaylist();
        const totalCount = playlistManager.getLength(false);
        
        // 更新计数
        this.playlistCount.textContent = `${playlist.length} 个视频`;
        if (playlist.length !== totalCount) {
            this.playlistCount.textContent += ` (共 ${totalCount} 个)`;
        }

        // 显示/隐藏空状态
        this.emptyState.style.display = totalCount === 0 ? 'flex' : 'none';
        this.playlistItems.style.display = totalCount === 0 ? 'none' : 'block';

        // 渲染播放列表项
        this.playlistItems.innerHTML = '';
        playlist.forEach((video, index) => {
            const item = this.createPlaylistItem(video, index);
            this.playlistItems.appendChild(item);
        });

        // 更新操作按钮状态
        this.updateActionButtons();
    }

    /**
     * 创建播放列表项
     */
    createPlaylistItem(video, index) {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.dataset.videoId = video.id;
        item.draggable = true;

        const typeLabels = {
            [VIDEO_TYPES.MP4]: 'MP4',
            [VIDEO_TYPES.M3U8]: 'HLS',
            [VIDEO_TYPES.FLV]: 'FLV',
            [VIDEO_TYPES.WEBM]: 'WebM',
            [VIDEO_TYPES.BILIBILI]: 'B站',
            [VIDEO_TYPES.YOUTUBE]: 'YouTube',
            [VIDEO_TYPES.UNKNOWN]: '未知'
        };

        item.innerHTML = `
            <div class="playlist-item-index">${index + 1}</div>
            <div class="playlist-item-content">
                <div class="playlist-item-title" title="${video.title}">${video.title}</div>
                <div class="playlist-item-meta">
                    <span class="video-type-badge">${typeLabels[video.type] || video.type}</span>
                    <span class="video-url" title="${video.url}">${this.truncateUrl(video.url)}</span>
                    ${video.duration ? `<span class="video-duration">${this.formatDuration(video.duration)}</span>` : ''}
                </div>
            </div>
            <div class="playlist-item-actions">
                <button class="item-action-btn" title="播放" data-action="play">
                    <i class="material-icons">play_arrow</i>
                </button>
                <button class="item-action-btn" title="编辑" data-action="edit">
                    <i class="material-icons">edit</i>
                </button>
                <button class="item-action-btn danger" title="删除" data-action="delete">
                    <i class="material-icons">delete</i>
                </button>
            </div>
        `;

        // 绑定事件
        this.bindPlaylistItemEvents(item, video);

        return item;
    }

    /**
     * 绑定播放列表项事件
     */
    bindPlaylistItemEvents(item, video) {
        // 点击播放
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.playlist-item-actions')) {
                this.playVideo(video);
            }
        });

        // 操作按钮
        item.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) {
                e.stopPropagation();
                this.handleItemAction(action, video);
            }
        });

        // 拖拽事件
        this.bindDragEvents(item);
    }

    /**
     * 绑定拖拽事件
     */
    bindDragEvents(item) {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.videoId);
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = item.dataset.videoId;
            
            if (draggedId !== targetId) {
                const draggedIndex = playlistManager.getVideoIndex(draggedId);
                const targetIndex = playlistManager.getVideoIndex(targetId);
                
                if (draggedIndex !== -1 && targetIndex !== -1) {
                    playlistManager.moveVideo(draggedIndex, targetIndex);
                }
            }
        });
    }

    /**
     * 处理播放列表项操作
     */
    handleItemAction(action, video) {
        switch (action) {
            case 'play':
                this.playVideo(video);
                break;
            case 'edit':
                this.editVideo(video);
                break;
            case 'delete':
                this.deleteVideo(video);
                break;
        }
    }

    /**
     * 播放视频
     */
    playVideo(video) {
        const playerUrl = `./player.html?video=${encodeURIComponent(video.id)}`;
        window.open(playerUrl, '_blank');
    }

    /**
     * 编辑视频
     */
    editVideo(video) {
        const newTitle = prompt('编辑视频标题:', video.title);
        if (newTitle && newTitle.trim() !== video.title) {
            playlistManager.updateVideo(video.id, { title: newTitle.trim() });
        }
    }

    /**
     * 删除视频
     */
    deleteVideo(video) {
        if (confirm(`确定要删除视频"${video.title}"吗？`)) {
            playlistManager.removeVideo(video.id);
        }
    }

    /**
     * 更新操作按钮状态
     */
    updateActionButtons() {
        const hasVideos = playlistManager.getLength(false) > 0;
        
        this.playAllBtn.disabled = !hasVideos;
        this.shareBtn.disabled = !hasVideos;
        this.exportBtn.disabled = !hasVideos;
        this.clearAllBtn.disabled = !hasVideos;
    }

    /**
     * 截断URL显示
     */
    truncateUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    /**
     * 格式化时长
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 加载设置
     */
    loadSettings() {
        const settings = storage.getSettings();
        
        // GitHub Token
        this.githubToken.value = githubService.getToken();
        
        // 播放器设置
        document.getElementById('autoplayEnabled').checked = settings.autoplay;
        document.getElementById('loopPlaylist').checked = settings.loop;
        document.getElementById('defaultVolume').value = Math.floor(settings.volume * 100);
        document.getElementById('volumeValue').textContent = `${Math.floor(settings.volume * 100)}%`;
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        keyboardManager.register('ctrl+n', () => {
            this.videoTitle.focus();
        });

        keyboardManager.register('ctrl+o', () => {
            this.fileInput.click();
        });

        keyboardManager.register('ctrl+s', () => {
            this.handleExport();
        });

        keyboardManager.register('escape', () => {
            modalManager.closeAll();
        });
    }

    /**
     * 处理URL参数
     */
    async handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const gistId = params.get('gist');
        
        if (gistId) {
            try {
                showToast('正在加载分享的播放列表...', 'info');
                const result = await githubService.loadPlaylist(gistId);
                
                if (result.success) {
                    await playlistManager.importPlaylist(result, 'json', false);
                    showToast(`成功加载分享的播放列表：${result.playlist.length} 个视频`, 'success');
                    
                    // 清除URL参数
                    window.history.replaceState({}, '', window.location.pathname);
                }
            } catch (error) {
                handleError(error, '加载分享播放列表');
            }
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
