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
    }    checkDependencies() {
        // 检查 ArtPlayer
        if (typeof Artplayer === 'undefined') {
            throw new Error('ArtPlayer 未加载');
        }
        
        // 检查必要的 DOM 元素
        const requiredElements = [
            '#videoPlayer',
            '#playlistSidebar'
        ];
        
        requiredElements.forEach(selector => {
            if (!document.querySelector(selector)) {
                throw new Error(`必要元素缺失: ${selector}`);
            }        });
    }
    
    bindEvents() {
        console.log('🔧 开始绑定事件...');
        
        // 侧边栏控制按钮
        const collapseSidebar = document.getElementById('collapseSidebar');
        if (collapseSidebar) {
            collapseSidebar.addEventListener('click', () => {
                console.log('点击了收起侧边栏按钮');
                this.toggleSidebar();
            });
        }
        
        const expandSidebar = document.getElementById('expandSidebar');
        if (expandSidebar) {
            expandSidebar.addEventListener('click', () => {
                console.log('点击了展开侧边栏按钮');
                this.toggleSidebar();
            });
        }
        
        // 播放列表控制按钮
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                console.log('点击了随机播放按钮');
                this.toggleShuffle();
            });
        }
        
        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => {
                console.log('点击了循环播放按钮');
                this.toggleRepeat();
            });
        }
        
        // 播放器控制按钮
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.playlistPlayer?.playPrevious();
            });
        }
        
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.playlistPlayer?.playNext();
            });
        }
        
        // 音量控制
        const volumeBtn = document.getElementById('volumeBtn');
        if (volumeBtn) {
            volumeBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }
        
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }
        
        // 播放速度按钮
        const speedBtn = document.getElementById('speedBtn');
        if (speedBtn) {
            speedBtn.addEventListener('click', () => {
                this.toggleSpeedMenu();
            });
        }
        
        // 画质按钮
        const qualityBtn = document.getElementById('qualityBtn');
        if (qualityBtn) {
            qualityBtn.addEventListener('click', () => {
                this.toggleQualityMenu();
            });
        }
        
        // 迷你播放器按钮
        const miniPlayerBtn = document.getElementById('miniPlayerBtn');
        if (miniPlayerBtn) {
            miniPlayerBtn.addEventListener('click', () => {
                this.toggleMiniMode();
            });
        }
        
        // 影院模式按钮
        const theaterModeBtn = document.getElementById('theaterModeBtn');
        if (theaterModeBtn) {
            theaterModeBtn.addEventListener('click', () => {
                this.toggleTheaterMode();
            });
        }
        
        // 全屏按钮
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }
        
        // 错误覆盖层的按钮
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.retryCurrentVideo();
            });
        }
        
        const skipBtn = document.getElementById('skipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.playlistPlayer?.playNext();
            });
        }
        
        // 返回主页按钮
        const backToHomeBtn = document.getElementById('backToHomeBtn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                this.goBack();
            });
        }
        
        // 播放速度选项
        this.bindSpeedMenuEvents();
        
        // 设置模态框
        this.bindSettingsModalEvents();
        
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
        if (this.playlistPlayer && this.playlistPlayer.player && this.playlistPlayer.player.player) {
            // 请求画中画模式
            try {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture();
                } else {
                    this.playlistPlayer.player.player.video.requestPictureInPicture();
                }
            } catch (error) {
                console.error('画中画模式切换失败:', error);
                showToast('您的浏览器不支持画中画模式', 'error');
            }
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
        // 返回到主页
        window.location.href = 'index.html';
    }
    
    retryCurrentVideo() {
        if (this.playlistPlayer && this.playlistPlayer.currentIndex >= 0) {
            this.playlistPlayer.playByIndex(this.playlistPlayer.currentIndex);
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
    
    toggleSidebar() {
        const sidebar = document.getElementById('playlistSidebar');
        const expandBtn = document.getElementById('expandSidebar');
        const collapseBtn = document.getElementById('collapseSidebar');
        
        if (sidebar) {
            const isHidden = sidebar.classList.contains('hidden');
            
            if (isHidden) {
                sidebar.classList.remove('hidden');
                if (expandBtn) expandBtn.classList.add('hidden');
                if (collapseBtn) collapseBtn.classList.remove('hidden');
            } else {
                sidebar.classList.add('hidden');
                if (expandBtn) expandBtn.classList.remove('hidden');
                if (collapseBtn) collapseBtn.classList.add('hidden');
            }
        }
    }

    // 播放控制方法
    togglePlayPause() {
        if (this.playlistPlayer && this.playlistPlayer.player) {
            this.playlistPlayer.player.toggle();
            this.updatePlayPauseButton();
        }
    }
    
    toggleMute() {
        if (this.playlistPlayer && this.playlistPlayer.player) {
            this.playlistPlayer.player.mute();
            this.updateVolumeButton();
        }
    }
    
    setVolume(volume) {
        if (this.playlistPlayer && this.playlistPlayer.player) {
            this.playlistPlayer.player.volume(volume);
            this.updateVolumeButton();
        }
    }
    
    toggleShuffle() {
        if (this.playlistPlayer) {
            this.playlistPlayer.toggleShuffle();
            this.updateShuffleButton();
        }
    }
    
    toggleRepeat() {
        if (this.playlistPlayer) {
            this.playlistPlayer.toggleRepeat();
            this.updateRepeatButton();
        }
    }
    
    toggleTheaterMode() {
        const playerMain = document.getElementById('playerMain');
        const sidebar = document.getElementById('playlistSidebar');
        
        if (playerMain && sidebar) {
            playerMain.classList.toggle('theater-mode');
            sidebar.classList.toggle('hidden');
            
            showToast(playerMain.classList.contains('theater-mode') ? '已开启影院模式' : '已关闭影院模式');
        }
    }
    
    toggleSpeedMenu() {
        const speedMenu = document.getElementById('speedMenu');
        if (speedMenu) {
            speedMenu.classList.toggle('hidden');
        }
    }
    
    toggleQualityMenu() {
        const qualityMenu = document.getElementById('qualityMenu');
        if (qualityMenu) {
            qualityMenu.classList.toggle('hidden');
        }
    }
    
    // UI 更新方法
    updatePlayPauseButton() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const icon = playPauseBtn?.querySelector('i');
        
        if (icon && this.playlistPlayer && this.playlistPlayer.player) {
            const isPlaying = !this.playlistPlayer.player.player?.paused;
            icon.textContent = isPlaying ? 'pause' : 'play_arrow';
            playPauseBtn.title = isPlaying ? '暂停' : '播放';
        }
    }
    
    updateVolumeButton() {
        const volumeBtn = document.getElementById('volumeBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const icon = volumeBtn?.querySelector('i');
        
        if (this.playlistPlayer && this.playlistPlayer.player && this.playlistPlayer.player.player) {
            const player = this.playlistPlayer.player.player;
            const volume = player.volume;
            const muted = player.muted;
            
            if (icon) {
                if (muted || volume === 0) {
                    icon.textContent = 'volume_off';
                } else if (volume < 0.5) {
                    icon.textContent = 'volume_down';
                } else {
                    icon.textContent = 'volume_up';
                }
            }
            
            if (volumeSlider) {
                volumeSlider.value = muted ? 0 : volume * 100;
            }
        }
    }
    
    updateShuffleButton() {
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn && this.playlistPlayer) {
            shuffleBtn.classList.toggle('active', this.playlistPlayer.isShuffleMode);
        }
    }
    
    updateRepeatButton() {
        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn && this.playlistPlayer) {
            repeatBtn.classList.toggle('active', this.playlistPlayer.isRepeatMode);
        }
    }
    
    // 事件绑定辅助方法
    bindSpeedMenuEvents() {
        const speedOptions = document.querySelectorAll('.speed-option');
        speedOptions.forEach(option => {
            option.addEventListener('click', () => {
                const speed = parseFloat(option.dataset.speed);
                this.setPlaybackRate(speed);
                
                // 更新UI
                speedOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // 更新速度按钮文本
                const speedBtn = document.getElementById('speedBtn');
                const speedText = speedBtn?.querySelector('.speed-text');
                if (speedText) {
                    speedText.textContent = `${speed}x`;
                }
                
                // 隐藏菜单
                this.toggleSpeedMenu();
            });
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            const speedMenu = document.getElementById('speedMenu');
            const speedBtn = document.getElementById('speedBtn');
            
            if (speedMenu && !speedMenu.contains(e.target) && !speedBtn?.contains(e.target)) {
                speedMenu.classList.add('hidden');
            }
        });
    }
    
    bindSettingsModalEvents() {
        const modal = document.getElementById('playerSettingsModal');
        const closeBtn = document.getElementById('closePlayerSettingsModal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }
        
        // 点击模态框外部关闭
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSettings();
                }
            });
        }
        
        // 绑定设置项
        const autoplayNext = document.getElementById('autoplayNext');
        if (autoplayNext) {
            autoplayNext.addEventListener('change', (e) => {
                if (this.playlistPlayer) {
                    this.playlistPlayer.isAutoplay = e.target.checked;
                }
            });
        }
        
        const rememberVolume = document.getElementById('rememberVolume');
        if (rememberVolume) {
            rememberVolume.addEventListener('change', (e) => {
                // 实现记住音量功能
                localStorage.setItem('rememberVolume', e.target.checked);
            });
        }
    }
    
    setPlaybackRate(rate) {
        if (this.playlistPlayer && this.playlistPlayer.player) {
            this.playlistPlayer.player.playbackRate(rate);
        }
    }
    
    openSettings() {
        const modal = document.getElementById('playerSettingsModal');
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    closeSettings() {
        const modal = document.getElementById('playerSettingsModal');
        if (modal) {
            modal.classList.remove('active');
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

// 调试工具 - 测试按钮绑定
window.testPlayerButtons = function() {
    console.log('=== 播放器按钮测试 ===');
    
    const buttons = [
        'collapseSidebar',
        'expandSidebar', 
        'shuffleBtn',
        'repeatBtn',
        'prevBtn',
        'playPauseBtn',
        'nextBtn',
        'volumeBtn',
        'speedBtn',
        'qualityBtn',
        'miniPlayerBtn',
        'theaterModeBtn',
        'fullscreenBtn',
        'settingsBtn',
        'retryBtn',
        'skipBtn',
        'backToHomeBtn'
    ];
    
    buttons.forEach(id => {
        const element = document.getElementById(id);
        console.log(`${id}: ${element ? '✓ 找到' : '✗ 未找到'}`);
        if (element) {
            console.log(`  - 事件监听器: ${element._listeners ? Object.keys(element._listeners).length : 0}`);
            console.log(`  - onclick: ${element.onclick ? '有' : '无'}`);
        }
    });
    
    console.log('=== PlayerController 状态 ===');
    console.log('playerController:', window.playerController);
    console.log('playlistPlayer:', window.playerController?.playlistPlayer);
    console.log('=== 测试完成 ===');
};

// 页面加载完成后自动运行测试
setTimeout(() => {
    if (window.testPlayerButtons) {
        window.testPlayerButtons();
    }
}, 2000);

// 导出（用于调试）
window.playerController = playerController;

// ES6 模块导出
export default PlayerController;
