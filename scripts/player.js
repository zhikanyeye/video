/**
 * 播放器页面控制器 - 初始化和管理播放器页面
 */

import PlaylistPlayer from './playlistPlayer.js';
import { storage } from './storage.js';
import { showToast, debounce } from './utils.js';

class PlayerController {
    constructor() {
        this.playlistPlayer = null;
        this.searchQuery = '';
        this.isInitialized = false;
        
        this.init();
    }
    
    async init() {
        try {
            // 等待 DOM 加载完成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initialize());
            } else {
                await this.initialize();
            }
        } catch (error) {
            console.error('播放器页面初始化失败:', error);
            showToast('页面初始化失败', 'error');
        }
    }
    
    async initialize() {
        try {
            // 检查必要的依赖
            this.checkDependencies();
            
            // 初始化播放列表播放器
            this.playlistPlayer = new PlaylistPlayer();
            
            // 绑定UI事件
            this.bindEvents();
            
            // 处理URL参数
            this.handleUrlParams();
            
            // 初始化搜索功能
            this.initSearch();
            
            // 设置页面标题
            document.title = '青云播 - 视频播放器';
            
            this.isInitialized = true;
            console.log('播放器页面初始化完成');
            
        } catch (error) {
            console.error('播放器初始化失败:', error);
            this.showError('播放器初始化失败，请刷新页面重试');
        }
    }
    
    checkDependencies() {
        // 检查 ArtPlayer
        if (typeof Artplayer === 'undefined') {
            throw new Error('ArtPlayer 未加载');
        }
        
        // 检查必要的 DOM 元素
        const requiredElements = [
            '#video-container',
            '.playlist-container'
        ];
        
        requiredElements.forEach(selector => {
            if (!document.querySelector(selector)) {
                throw new Error(`必要元素缺失: ${selector}`);
            }
        });
    }
    
    bindEvents() {
        // 返回主页按钮
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.goBack();
            });
        }
        
        // 播放列表切换按钮
        const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        if (toggleSidebarBtn) {
            toggleSidebarBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
        
        // 全屏按钮
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 迷你模式按钮
        const miniModeBtn = document.getElementById('mini-mode-btn');
        if (miniModeBtn) {
            miniModeBtn.addEventListener('click', () => {
                this.toggleMiniMode();
            });
        }
        
        // 设置按钮
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }
        
        // 键盘快捷键
        this.bindKeyboardShortcuts();
        
        // 窗口事件
        this.bindWindowEvents();
    }
    
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 忽略输入框中的按键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.key) {
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
                    
                case 'n':
                case 'N':
                    e.preventDefault();
                    this.playlistPlayer?.playNext();
                    break;
                    
                case 'p':
                case 'P':
                    e.preventDefault();
                    this.playlistPlayer?.playPrevious();
                    break;
                    
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.playlistPlayer?.togglePlayMode();
                    break;
                    
                case 'l':
                case 'L':
                    e.preventDefault();
                    this.toggleSidebar();
                    break;
                    
                case '/':
                    e.preventDefault();
                    this.focusSearch();
                    break;
            }
        });
    }
    
    bindWindowEvents() {
        // 窗口大小变化
        window.addEventListener('resize', debounce(() => {
            this.handleResize();
        }, 250));
        
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // 页面卸载前清理
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // 处理浏览器前进后退
        window.addEventListener('popstate', (e) => {
            this.handlePopState(e);
        });
    }
    
    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // 获取播放列表ID（如果从主页跳转）
        const playlistId = urlParams.get('playlist');
        if (playlistId) {
            this.loadPlaylistFromId(playlistId);
        }
        
        // 获取要播放的视频索引
        const videoIndex = urlParams.get('index');
        if (videoIndex) {
            setTimeout(() => {
                this.playlistPlayer?.playByIndex(parseInt(videoIndex));
            }, 1000);
        }
        
        // 获取自动播放参数
        const autoplay = urlParams.get('autoplay');
        if (autoplay === 'false') {
            this.playlistPlayer.isAutoplay = false;
        }
    }
    
    async loadPlaylistFromId(playlistId) {
        try {
            // 这里可以根据播放列表ID加载对应的播放列表
            // 比如从localStorage或者服务器获取
            const savedPlaylists = storage.get('playlists') || {};
            const playlist = savedPlaylists[playlistId];
            
            if (playlist && playlist.videos) {
                this.playlistPlayer?.setPlaylist(playlist.videos);
                showToast(`已加载播放列表: ${playlist.name}`);
            }
        } catch (error) {
            console.error('加载播放列表失败:', error);
            showToast('加载播放列表失败', 'error');
        }
    }
    
    initSearch() {
        const searchInput = document.getElementById('playlist-search');
        if (!searchInput) return;
        
        // 防抖搜索
        const debouncedSearch = debounce((query) => {
            this.searchPlaylist(query);
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.searchQuery = query;
            debouncedSearch(query);
        });
        
        // 清空搜索按钮
        const clearSearchBtn = document.getElementById('clear-search-btn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                this.searchPlaylist('');
            });
        }
        
        // 回车键搜索
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchPlaylist(e.target.value.trim());
            }
        });
    }
    
    searchPlaylist(query) {
        const items = document.querySelectorAll('.playlist-item');
        const noResultsElement = document.querySelector('.search-no-results');
        
        if (!query) {
            // 显示所有项目
            items.forEach(item => {
                item.style.display = '';
            });
            if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        let visibleCount = 0;
        
        items.forEach(item => {
            const title = item.querySelector('.item-title')?.textContent?.toLowerCase() || '';
            const isMatch = title.includes(lowerQuery);
            
            item.style.display = isMatch ? '' : 'none';
            if (isMatch) visibleCount++;
        });
        
        // 显示/隐藏无结果提示
        if (visibleCount === 0) {
            if (!noResultsElement) {
                this.createNoResultsElement();
            } else {
                noResultsElement.style.display = 'block';
            }
        } else if (noResultsElement) {
            noResultsElement.style.display = 'none';
        }
        
        // 更新搜索结果统计
        this.updateSearchStats(visibleCount, items.length);
    }
    
    createNoResultsElement() {
        const container = document.querySelector('.playlist-container');
        if (!container) return;
        
        const element = document.createElement('div');
        element.className = 'search-no-results';
        element.innerHTML = `
            <div class="no-results-content">
                <i class="material-icons">search_off</i>
                <p>未找到匹配的视频</p>
                <p>尝试使用其他关键词搜索</p>
            </div>
        `;
        
        container.appendChild(element);
    }
    
    updateSearchStats(visibleCount, totalCount) {
        const statsElement = document.querySelector('.search-stats');
        if (statsElement) {
            if (this.searchQuery) {
                statsElement.textContent = `显示 ${visibleCount} / ${totalCount} 个视频`;
                statsElement.style.display = 'block';
            } else {
                statsElement.style.display = 'none';
            }
        }
    }
    
    focusSearch() {
        const searchInput = document.getElementById('playlist-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    
    // UI 控制方法
    toggleSidebar() {
        const sidebar = document.querySelector('.player-sidebar');
        const main = document.querySelector('.player-main');
        
        if (sidebar && main) {
            const isHidden = sidebar.classList.contains('hidden');
            
            sidebar.classList.toggle('hidden');
            main.classList.toggle('sidebar-hidden', !isHidden);
            
            // 保存状态
            storage.set('sidebarVisible', isHidden);
        }
    }
    
    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
    
    toggleMiniMode() {
        const player = document.querySelector('.player-container');
        if (player) {
            player.classList.toggle('mini-mode');
            
            if (player.classList.contains('mini-mode')) {
                showToast('已进入迷你模式');
                this.enableMiniMode();
            } else {
                showToast('已退出迷你模式');
                this.disableMiniMode();
            }
        }
    }
    
    enableMiniMode() {
        // 迷你模式逻辑
        document.body.classList.add('mini-mode');
        
        // 可以添加画中画功能
        if (this.playlistPlayer?.player?.video && 'pictureInPictureEnabled' in document) {
            this.playlistPlayer.player.video.requestPictureInPicture().catch(console.error);
        }
    }
    
    disableMiniMode() {
        document.body.classList.remove('mini-mode');
        
        // 退出画中画
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(console.error);
        }
    }
    
    openSettings() {
        // 这里可以打开设置面板
        // 或者跳转到设置页面
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.classList.add('active');
        } else {
            // 如果没有设置模态框，可以创建一个简单的设置界面
            this.createSettingsModal();
        }
    }
    
    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>播放器设置</h3>
                    <button class="btn-close" onclick="this.closest('.modal').classList.remove('active')">
                        <i class="material-icons">close</i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="autoplay-setting" checked>
                            自动播放下一个视频
                        </label>
                    </div>
                    <div class="setting-item">
                        <label>
                            <input type="checkbox" id="keyborad-shortcuts-setting" checked>
                            启用键盘快捷键
                        </label>
                    </div>
                    <div class="setting-item">
                        <label for="volume-setting">默认音量:</label>
                        <input type="range" id="volume-setting" min="0" max="1" step="0.1" value="0.7">
                        <span class="volume-value">70%</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal').classList.remove('active')">
                        确定
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.add('active');
        
        // 绑定设置事件
        this.bindSettingsEvents(modal);
    }
    
    bindSettingsEvents(modal) {
        const autoplayCheckbox = modal.querySelector('#autoplay-setting');
        const volumeSlider = modal.querySelector('#volume-setting');
        const volumeValue = modal.querySelector('.volume-value');
        
        if (autoplayCheckbox) {
            autoplayCheckbox.checked = this.playlistPlayer?.isAutoplay !== false;
            autoplayCheckbox.addEventListener('change', (e) => {
                if (this.playlistPlayer) {
                    this.playlistPlayer.isAutoplay = e.target.checked;
                    this.playlistPlayer.saveSettings();
                }
            });
        }
        
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                volumeValue.textContent = Math.round(value * 100) + '%';
                
                if (this.playlistPlayer?.player) {
                    this.playlistPlayer.player.volume(value);
                }
            });
        }
    }
    
    goBack() {
        // 返回主页
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'index.html';
        }
    }
    
    // 事件处理方法
    handleResize() {
        // 处理窗口大小变化
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('mobile', isMobile);
        
        // 在移动设备上自动隐藏侧边栏
        if (isMobile) {
            const sidebar = document.querySelector('.player-sidebar');
            if (sidebar && !sidebar.classList.contains('hidden')) {
                this.toggleSidebar();
            }
        }
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            // 页面隐藏时暂停视频（可选）
            // this.playlistPlayer?.player?.pause();
        } else {
            // 页面显示时的处理
        }
    }
    
    handlePopState(e) {
        // 处理浏览器前进后退
        if (e.state && e.state.videoIndex !== undefined) {
            this.playlistPlayer?.playByIndex(e.state.videoIndex);
        }
    }
    
    showError(message) {
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <i class="material-icons">error_outline</i>
                    <p>${message}</p>
                    <button class="btn" onclick="location.reload()">刷新页面</button>
                </div>
            `;
            errorContainer.style.display = 'flex';
        } else {
            showToast(message, 'error');
        }
    }
    
    cleanup() {
        // 清理资源
        if (this.playlistPlayer) {
            this.playlistPlayer.destroy();
        }
    }
}

// 创建全局实例
let playerController;

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        playerController = new PlayerController();
    });
} else {
    playerController = new PlayerController();
}

// 导出（用于调试）
window.playerController = playerController;
