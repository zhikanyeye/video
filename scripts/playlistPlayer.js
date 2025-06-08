/**
 * 播放列表播放器 - 处理播放列表的播放逻辑
 */

import ArtPlayerWrapper from './artPlayerWrapper.js';
import { storage } from './storage.js';
import { showToast, formatDuration } from './utils.js';

class PlaylistPlayer {
    constructor() {
        this.player = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.playMode = 'list'; // list, loop, random, single
        this.isAutoplay = true;
        this.playHistory = [];
        this.maxHistorySize = 100;
        
        this.init();
    }
    
    async init() {
        try {
            // 加载设置
            this.loadSettings();
            
            // 初始化播放器
            await this.initPlayer();
            
            // 绑定事件
            this.bindEvents();
            
            // 加载播放列表
            await this.loadPlaylist();
            
            // 更新UI
            this.updateUI();
            
            console.log('播放列表播放器初始化完成');
            
        } catch (error) {
            console.error('播放列表播放器初始化失败:', error);
            showToast('播放器初始化失败', 'error');
        }
    }    async initPlayer() {
        const container = document.getElementById('videoPlayer');
        if (!container) {
            throw new Error('视频播放器容器不存在');
        }
        
        this.player = new ArtPlayerWrapper(container, {
            volume: this.getVolume(),
            playbackRate: this.getPlaybackRate(),
            autoplay: this.isAutoplay
        });
        
        // 等待播放器就绪
        return new Promise((resolve) => {
            this.player.on('ready', () => {
                resolve();
            });
        });
    }
    
    bindEvents() {
        if (!this.player) return;
        
        // 播放结束事件
        this.player.on('ended', () => {
            this.handleVideoEnded();
        });
        
        // 播放事件
        this.player.on('play', () => {
            this.updatePlayingStatus(true);
            this.addToHistory(this.currentIndex);
        });
        
        // 暂停事件
        this.player.on('pause', () => {
            this.updatePlayingStatus(false);
        });
        
        // 时间更新事件
        this.player.on('timeupdate', (data) => {
            this.updateProgress(data);
        });
        
        // 错误事件
        this.player.on('error', (error) => {
            this.handlePlayError(error);
        });
        
        // 绑定播放列表UI事件
        this.bindPlaylistEvents();
        
        // 绑定播放控制事件
        this.bindControlEvents();
    }
      bindPlaylistEvents() {
        const playlistContainer = document.getElementById('playlistContent');
        if (!playlistContainer) return;
        
        // 播放列表项点击事件
        playlistContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.playlist-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.playByIndex(index);
            }
        });
        
        // 删除按钮事件
        playlistContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove')) {
                e.stopPropagation();
                const item = e.target.closest('.playlist-item');
                const index = parseInt(item.dataset.index);
                this.removeFromPlaylist(index);
            }
        });
    }
    
    bindControlEvents() {
        // 播放模式切换
        const playModeBtn = document.getElementById('play-mode-btn');
        if (playModeBtn) {
            playModeBtn.addEventListener('click', () => {
                this.togglePlayMode();
            });
        }
        
        // 上一首/下一首
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.playPrevious();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.playNext();
            });
        }
        
        // 播放列表控制
        const shuffleBtn = document.getElementById('shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                this.shufflePlaylist();
            });
        }
        
        const clearBtn = document.getElementById('clear-playlist-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearPlaylist();
            });
        }
    }
    
    // 播放控制方法
    async playByIndex(index) {
        if (index < 0 || index >= this.playlist.length) {
            console.error('播放索引超出范围:', index);
            return;
        }
        
        try {
            this.currentIndex = index;
            const video = this.playlist[index];
            
            // 显示加载状态
            this.showLoadingState();
            
            // 加载视频
            await this.player.loadVideo(video);
            
            // 更新UI
            this.updateCurrentItem();
            this.updatePlayerInfo(video);
            
            // 开始播放
            if (this.isAutoplay) {
                await this.player.play();
            }
            
            // 保存当前播放位置
            this.saveCurrentPosition();
            
            showToast(`正在播放: ${video.title}`);
            
        } catch (error) {
            console.error('播放视频失败:', error);
            this.handlePlayError(error);
        }
    }
    
    playNext() {
        const nextIndex = this.getNextIndex();
        if (nextIndex !== -1) {
            this.playByIndex(nextIndex);
        } else {
            showToast('已到达播放列表末尾');
        }
    }
    
    playPrevious() {
        const prevIndex = this.getPreviousIndex();
        if (prevIndex !== -1) {
            this.playByIndex(prevIndex);
        } else {
            showToast('已到达播放列表开头');
        }
    }
    
    getNextIndex() {
        switch (this.playMode) {
            case 'list':
                return this.currentIndex < this.playlist.length - 1 
                    ? this.currentIndex + 1 : -1;
                    
            case 'loop':
                return this.currentIndex < this.playlist.length - 1 
                    ? this.currentIndex + 1 : 0;
                    
            case 'single':
                return this.currentIndex;
                
            case 'random':
                if (this.playlist.length <= 1) return this.currentIndex;
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * this.playlist.length);
                } while (randomIndex === this.currentIndex);
                return randomIndex;
                
            default:
                return -1;
        }
    }
    
    getPreviousIndex() {
        switch (this.playMode) {
            case 'list':
                return this.currentIndex > 0 ? this.currentIndex - 1 : -1;
                
            case 'loop':
                return this.currentIndex > 0 
                    ? this.currentIndex - 1 : this.playlist.length - 1;
                    
            case 'single':
                return this.currentIndex;
                
            case 'random':
                // 从历史记录中获取上一个
                if (this.playHistory.length > 1) {
                    return this.playHistory[this.playHistory.length - 2];
                }
                return this.currentIndex > 0 ? this.currentIndex - 1 : -1;
                
            default:
                return -1;
        }
    }
    
    // 播放列表管理
    setPlaylist(playlist) {
        this.playlist = playlist || [];
        this.currentIndex = -1;
        this.player?.setPlaylist(this.playlist);
        this.updatePlaylistUI();
        this.savePlaylist();
    }
    
    addToPlaylist(video) {
        this.playlist.push(video);
        this.player?.setPlaylist(this.playlist);
        this.updatePlaylistUI();
        this.savePlaylist();
        showToast(`已添加: ${video.title}`);
    }
    
    removeFromPlaylist(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        const video = this.playlist[index];
        this.playlist.splice(index, 1);
        
        // 调整当前播放索引
        if (index < this.currentIndex) {
            this.currentIndex--;
        } else if (index === this.currentIndex) {
            // 如果删除的是当前播放的视频
            if (this.playlist.length === 0) {
                this.currentIndex = -1;
                this.player?.loadVideo(null);
            } else {
                // 播放下一个视频，或者如果是最后一个则播放上一个
                const nextIndex = Math.min(this.currentIndex, this.playlist.length - 1);
                this.playByIndex(nextIndex);
            }
        }
        
        this.player?.setPlaylist(this.playlist);
        this.updatePlaylistUI();
        this.savePlaylist();
        showToast(`已删除: ${video.title}`);
    }
    
    clearPlaylist() {
        if (this.playlist.length === 0) return;
        
        if (confirm('确定要清空播放列表吗？')) {
            this.playlist = [];
            this.currentIndex = -1;
            this.player?.setPlaylist([]);
            this.player?.loadVideo(null);
            this.updatePlaylistUI();
            this.savePlaylist();
            showToast('播放列表已清空');
        }
    }
    
    shufflePlaylist() {
        if (this.playlist.length <= 1) return;
        
        const currentVideo = this.playlist[this.currentIndex];
        
        // Fisher-Yates 洗牌算法
        for (let i = this.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
        }
        
        // 找到当前播放视频的新位置
        if (currentVideo) {
            this.currentIndex = this.playlist.findIndex(v => v.id === currentVideo.id);
        }
        
        this.player?.setPlaylist(this.playlist);
        this.updatePlaylistUI();
        this.savePlaylist();
        showToast('播放列表已随机打乱');
    }
    
    // 播放模式管理
    togglePlayMode() {
        const modes = ['list', 'loop', 'single', 'random'];
        const currentIndex = modes.indexOf(this.playMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.playMode = modes[nextIndex];
        
        this.updatePlayModeUI();
        this.saveSettings();
        
        const modeNames = {
            list: '列表播放',
            loop: '循环播放',
            single: '单曲循环',
            random: '随机播放'
        };
        
        showToast(`播放模式: ${modeNames[this.playMode]}`);
    }
    
    // 事件处理
    handleVideoEnded() {
        if (this.playMode === 'single') {
            // 单曲循环，重新播放当前视频
            this.player.seek(0);
            this.player.play();
        } else {
            // 播放下一首
            const nextIndex = this.getNextIndex();
            if (nextIndex !== -1) {
                setTimeout(() => {
                    this.playByIndex(nextIndex);
                }, 1000);
            } else {
                showToast('播放列表已结束');
            }
        }
    }
      handlePlayError(error) {
        console.error('播放错误:', error);
        
        // 获取当前视频信息
        const currentVideo = this.currentIndex !== -1 ? this.playlist[this.currentIndex] : null;
        
        // 显示错误UI
        this.showErrorUI(error, currentVideo);
        
        // 如果是简单错误对象，显示基本错误提示
        if (!error.message && !error.solution) {
            showToast(`播放失败: ${currentVideo ? currentVideo.title : '未知视频'}`, 'error');
        } else {
            // 如果是详细错误对象，显示更详细的信息
            showToast(`${error.message || '视频播放失败'}`, 'error', 5000);
        }
        
        // 记录错误数据用于调试
        this.logErrorData(error, currentVideo);
        
        // 仅当自动播放模式下且有多个视频时，才自动跳转到下一个
        if (this.isAutoplay && this.playlist.length > 1) {
            const skipBtn = document.getElementById('skipBtn');
            if (skipBtn) {
                skipBtn.textContent = '跳至下一个视频 (3秒后自动)';
                skipBtn.disabled = true;
            }
            
            setTimeout(() => {
                if (skipBtn) {
                    skipBtn.textContent = '跳至下一个视频';
                    skipBtn.disabled = false;
                }
                this.playNext();
            }, 3000);
        }
    }
    
    // 显示错误界面
    showErrorUI(error, video) {
        const errorOverlay = document.getElementById('errorOverlay');
        const errorMessage = document.getElementById('errorMessage');
        const retryBtn = document.getElementById('retryBtn');
        const skipBtn = document.getElementById('skipBtn');
        
        if (!errorOverlay || !errorMessage) return;
        
        // 构建错误消息
        let message = '';
        
        if (error.message) {
            message = `${error.message}`;
            if (error.solution) message += `<br><br>${error.solution}`;
        } else if (error.code) {
            message = `错误代码: ${error.code}`;
        } else {
            message = '播放视频时出现问题，请检查视频链接是否有效，或尝试使用不同的浏览器。';
        }
        
        // 添加视频信息
        if (video) {
            message += `<br><br><strong>视频信息:</strong><br>`;
            message += `标题: ${video.title || '未知'}<br>`;
            message += `类型: ${video.type || this.detectVideoType(video.url) || '未知'}<br>`;
            
            // 安全展示URL (可能很长)
            const urlDisplay = video.url?.length > 60 
                ? video.url.substring(0, 30) + '...' + video.url.substring(video.url.length - 30) 
                : video.url;
                
            message += `URL: <span class="truncated-url" title="${video.url}">${urlDisplay || '未设置'}</span>`;
        }
        
        // 更新错误消息
        errorMessage.innerHTML = message;
        
        // 显示错误界面
        errorOverlay.classList.remove('hidden');
        
        // 绑定重试按钮事件
        if (retryBtn) {
            retryBtn.onclick = () => {
                errorOverlay.classList.add('hidden');
                if (this.currentIndex !== -1) {
                    this.playByIndex(this.currentIndex);
                }
            };
        }
        
        // 绑定跳过按钮事件
        if (skipBtn) {
            skipBtn.onclick = () => {
                errorOverlay.classList.add('hidden');
                this.playNext();
            };
            
            // 只有当有下一个视频时才启用跳过按钮
            skipBtn.disabled = this.getNextIndex() === -1;
        }
    }
    
    // 记录错误数据，便于调试
    logErrorData(error, video) {
        // 构建详细的调试信息
        const debugInfo = {
            timestamp: new Date().toISOString(),
            error: error,
            video: {
                title: video?.title,
                url: video?.url,
                type: video?.type || (video?.url ? this.detectVideoType(video.url) : 'unknown')
            },
            browser: {
                userAgent: navigator.userAgent,
                vendor: navigator.vendor,
                platform: navigator.platform
            },
            player: {
                currentTime: this.player?.getStatus()?.currentTime,
                duration: this.player?.getStatus()?.duration,
                playMode: this.playMode,
                isAutoplay: this.isAutoplay
            }
        };
        
        console.group('视频播放错误详细信息');
        console.error('错误详情:', debugInfo);
        console.groupEnd();
        
        // 可以在这里添加发送错误报告到服务器的逻辑，如果需要的话
    }
    
    // UI 更新方法
    updateUI() {
        this.updatePlaylistUI();
        this.updatePlayModeUI();
        this.updateCurrentItem();
    }
    
    updatePlaylistUI() {
        const container = document.querySelector('.playlist-container');
        if (!container) return;
        
        if (this.playlist.length === 0) {
            container.innerHTML = `
                <div class="playlist-empty">
                    <i class="material-icons">queue_music</i>
                    <p>播放列表为空</p>
                    <p>从主页添加视频到播放列表</p>
                </div>
            `;
            return;
        }
        
        const html = this.playlist.map((video, index) => `
            <div class="playlist-item ${index === this.currentIndex ? 'playing' : ''}" 
                 data-index="${index}">
                <div class="item-thumbnail">
                    ${video.thumbnail ? 
                        `<img src="${video.thumbnail}" alt="${video.title}" loading="lazy">` :
                        '<div class="thumbnail-placeholder"><i class="material-icons">video_library</i></div>'
                    }
                    ${index === this.currentIndex ? 
                        '<div class="playing-indicator"><i class="material-icons">play_arrow</i></div>' : 
                        ''
                    }
                </div>
                <div class="item-info">
                    <h4 class="item-title">${video.title}</h4>
                    <p class="item-meta">
                        ${video.duration ? formatDuration(video.duration) : ''}
                        ${video.type ? `• ${video.type.toUpperCase()}` : ''}
                    </p>
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-remove" title="删除">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        
        // 更新播放列表统计
        this.updatePlaylistStats();
    }
    
    updatePlaylistStats() {
        const countElement = document.querySelector('.playlist-count');
        if (countElement) {
            countElement.textContent = `${this.playlist.length} 个视频`;
        }
        
        const durationElement = document.querySelector('.playlist-duration');
        if (durationElement) {
            const totalDuration = this.playlist.reduce((sum, video) => {
                return sum + (video.duration || 0);
            }, 0);
            durationElement.textContent = formatDuration(totalDuration);
        }
    }
    
    updateCurrentItem() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('playing', index === this.currentIndex);
        });
        
        // 滚动到当前播放项
        if (this.currentIndex !== -1) {
            const currentItem = document.querySelector(`.playlist-item[data-index="${this.currentIndex}"]`);
            if (currentItem) {
                currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    updatePlayModeUI() {
        const button = document.getElementById('play-mode-btn');
        if (!button) return;
        
        const icons = {
            list: 'playlist_play',
            loop: 'repeat',
            single: 'repeat_one',
            random: 'shuffle'
        };
        
        const tooltips = {
            list: '列表播放',
            loop: '循环播放',
            single: '单曲循环',
            random: '随机播放'
        };
        
        const icon = button.querySelector('i');
        if (icon) {
            icon.textContent = icons[this.playMode];
        }
        
        button.title = tooltips[this.playMode];
        button.classList.toggle('active', this.playMode !== 'list');
    }
    
    updatePlayingStatus(isPlaying) {
        const playButton = document.querySelector('.play-button');
        if (playButton) {
            const icon = playButton.querySelector('i');
            if (icon) {
                icon.textContent = isPlaying ? 'pause' : 'play_arrow';
            }
        }
        
        // 更新页面标题
        if (this.currentIndex !== -1 && this.playlist[this.currentIndex]) {
            const video = this.playlist[this.currentIndex];
            document.title = isPlaying ?                `正在播放: ${video.title} - 青云播` : 
                `${video.title} - 青云播`;
        }
    }
    
    updatePlayerInfo(video) {
        const titleElement = document.querySelector('.video-title');
        const metaElement = document.querySelector('.video-meta');
        
        if (titleElement) {
            titleElement.textContent = video.title;
        }
        
        if (metaElement) {
            metaElement.innerHTML = `
                <span>${video.type ? video.type.toUpperCase() : 'VIDEO'}</span>
                ${video.duration ? `<span>${formatDuration(video.duration)}</span>` : ''}
                ${video.url ? `<a href="${video.url}" target="_blank" title="在新窗口打开"><i class="material-icons">open_in_new</i></a>` : ''}
            `;
        }
    }
    
    updateProgress(data) {
        // 这里可以添加进度更新逻辑
        // 比如更新播放历史、保存播放位置等
    }
    
    showLoadingState(message = '正在加载视频...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorOverlay = document.getElementById('errorOverlay');
        const emptyOverlay = document.getElementById('emptyOverlay');
        
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
            const loadingText = loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
        
        if (errorOverlay) errorOverlay.classList.add('hidden');
        if (emptyOverlay) emptyOverlay.classList.add('hidden');
    }
    
    // 设置相关方法
    getVolume() {
        return parseFloat(localStorage.getItem('playerVolume') || '0.7');
    }
    
    setStoredVolume(volume) {
        localStorage.setItem('playerVolume', volume.toString());
    }
    
    getPlaybackRate() {
        return parseFloat(localStorage.getItem('playerPlaybackRate') || '1');
    }
    
    setStoredPlaybackRate(rate) {
        localStorage.setItem('playerPlaybackRate', rate.toString());
    }
    
    saveSettings() {
        const settings = {
            playMode: this.playMode,
            isAutoplay: this.isAutoplay,
            volume: this.getVolume(),
            playbackRate: this.getPlaybackRate()
        };
        localStorage.setItem('playerSettings', JSON.stringify(settings));
    }
    
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('playerSettings') || '{}');
            this.playMode = settings.playMode || 'list';
            this.isAutoplay = settings.isAutoplay !== false;
        } catch (error) {
            console.warn('加载设置失败:', error);
        }
    }

    // 播放列表管理方法
    removeFromPlaylist(index) {
        if (index >= 0 && index < this.playlist.length) {
            const removed = this.playlist.splice(index, 1)[0];
            
            // 如果删除的是当前播放的视频
            if (index === this.currentIndex) {
                if (this.playlist.length > 0) {
                    // 播放下一个，如果没有下一个则播放上一个
                    const nextIndex = index < this.playlist.length ? index : index - 1;
                    this.playByIndex(nextIndex);
                } else {
                    // 播放列表为空
                    this.currentIndex = -1;
                    this.player?.destroy();
                }
            } else if (index < this.currentIndex) {
                // 删除的是当前播放视频之前的，需要调整索引
                this.currentIndex--;
            }
            
            this.updateUI();
            showToast(`已从播放列表移除: ${removed.title}`);
        }
    }
    
    clearPlaylist() {
        this.playlist = [];
        this.currentIndex = -1;
        this.player?.destroy();
        this.updateUI();
        showToast('播放列表已清空');
    }
    
    shufflePlaylist() {
        if (this.playlist.length <= 1) return;
        
        // 保存当前播放的视频
        const currentVideo = this.currentIndex >= 0 ? this.playlist[this.currentIndex] : null;
        
        // Fisher-Yates 洗牌算法
        for (let i = this.playlist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
        }
        
        // 重新找到当前播放视频的位置
        if (currentVideo) {
            this.currentIndex = this.playlist.findIndex(video => video.url === currentVideo.url);
        }
        
        this.updateUI();
        showToast('播放列表已打乱');
    }

    // UI更新方法
    updateUI() {
        this.updatePlaylistDisplay();
        this.updatePlayerInfo();
        this.updatePlaylistStats();
    }
    
    updatePlaylistDisplay() {
        const container = document.getElementById('playlistContent');
        if (!container) return;
        
        if (this.playlist.length === 0) {
            container.innerHTML = `
                <div class="empty-playlist">
                    <i class="material-icons">queue_music</i>
                    <p>播放列表为空</p>
                    <small>从主页添加视频到播放列表</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.playlist.map((video, index) => `
            <div class="playlist-item ${index === this.currentIndex ? 'active' : ''}" data-index="${index}">
                <div class="item-info">
                    <div class="item-title">${video.title || '未知标题'}</div>
                    <div class="item-meta">
                        <span class="item-type">${video.type || 'mp4'}</span>
                        ${video.duration ? `<span class="item-duration">${formatDuration(video.duration)}</span>` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    ${index === this.currentIndex ? '<i class="material-icons playing-icon">volume_up</i>' : ''}
                    <button class="btn-remove" title="从播放列表移除">
                        <i class="material-icons">close</i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    updatePlayerInfo(video = null) {
        const currentVideo = video || (this.currentIndex >= 0 ? this.playlist[this.currentIndex] : null);
        
        const titleElement = document.getElementById('videoTitle');
        const typeElement = document.getElementById('videoType');
        const progressElement = document.getElementById('videoProgress');
        
        if (titleElement) {
            titleElement.textContent = currentVideo ? currentVideo.title || '未知标题' : '没有正在播放的视频';
        }
        
        if (typeElement) {
            typeElement.textContent = currentVideo ? (currentVideo.type || 'mp4').toUpperCase() : 'UNKNOWN';
        }
        
        if (progressElement) {
            progressElement.textContent = `${this.currentIndex + 1}/${this.playlist.length}`;
        }
    }
    
    updatePlaylistStats() {
        const statsElement = document.getElementById('playlistStats');
        const durationElement = document.getElementById('playlistDuration');
        
        if (statsElement) {
            statsElement.textContent = `${this.currentIndex + 1}/${this.playlist.length}`;
        }
        
        if (durationElement) {
            const totalDuration = this.playlist.reduce((total, video) => {
                return total + (video.duration || 0);
            }, 0);
            durationElement.textContent = formatDuration(totalDuration);
        }
    }
    
    updateCurrentItem() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
            
            const playingIcon = item.querySelector('.playing-icon');
            if (index === this.currentIndex && !playingIcon) {
                const actionsDiv = item.querySelector('.item-actions');
                if (actionsDiv) {
                    actionsDiv.insertAdjacentHTML('afterbegin', '<i class="material-icons playing-icon">volume_up</i>');
                }
            } else if (index !== this.currentIndex && playingIcon) {
                playingIcon.remove();
            }
        });
    }

    // 播放状态管理
    updatePlayingStatus(isPlaying) {
        // 更新播放按钮状态
        if (window.playerController) {
            window.playerController.updatePlayPauseButton();
        }
        
        // 更新标题栏显示
        if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
            const video = this.playlist[this.currentIndex];
            document.title = isPlaying ? `🎵 ${video.title} - 青云播` : `⏸️ ${video.title} - 青云播`;
        }
    }
    
    updateProgress(data) {
        const currentTimeElement = document.getElementById('currentTime');
        const totalTimeElement = document.getElementById('totalTime');
        
        if (currentTimeElement) {
            currentTimeElement.textContent = formatDuration(data.currentTime);
        }
        
        if (totalTimeElement) {
            totalTimeElement.textContent = formatDuration(data.duration);
        }
    }

    // 错误处理方法
    handlePlayError(error) {
        console.error('播放错误:', error);
        
        let errorMessage = '播放失败';
        let solution = '请重试或跳过此视频';
        
        if (error && typeof error === 'object') {
            errorMessage = error.message || errorMessage;
            solution = error.solution || solution;
        }
        
        // 显示错误覆盖层
        this.showErrorOverlay(errorMessage, solution);
        
        // 显示toast通知
        showToast(`${errorMessage}: ${solution}`, 'error');
        
        // 如果启用了自动播放下一个，延迟3秒后自动跳过
        if (this.isAutoplay && this.currentIndex < this.playlist.length - 1) {
            setTimeout(() => {
                this.playNext();
            }, 3000);
        }
    }
    
    showLoadingState(message = '正在加载视频...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorOverlay = document.getElementById('errorOverlay');
        const emptyOverlay = document.getElementById('emptyOverlay');
        
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
            const loadingText = loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
        
        if (errorOverlay) errorOverlay.classList.add('hidden');
        if (emptyOverlay) emptyOverlay.classList.add('hidden');
    }
    
    showErrorOverlay(message, solution) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorOverlay = document.getElementById('errorOverlay');
        const emptyOverlay = document.getElementById('emptyOverlay');
        const errorMessage = document.getElementById('errorMessage');
        
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        if (emptyOverlay) emptyOverlay.classList.add('hidden');
        
        if (errorOverlay) {
            errorOverlay.classList.remove('hidden');
            if (errorMessage) {
                errorMessage.textContent = `${message} ${solution}`;
            }
        }
    }
    
    hideAllOverlays() {
        const overlays = ['loadingOverlay', 'errorOverlay', 'emptyOverlay'];
        overlays.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.add('hidden');
        });
    }

    // 历史记录管理
    addToHistory(index) {
        if (index >= 0 && index < this.playlist.length) {
            const video = this.playlist[index];
            const historyItem = {
                ...video,
                playedAt: new Date().toISOString(),
                index: index
            };
            
            // 移除重复项
            this.playHistory = this.playHistory.filter(item => item.url !== video.url);
            
            // 添加到历史记录开头
            this.playHistory.unshift(historyItem);
            
            // 限制历史记录长度
            if (this.playHistory.length > this.maxHistorySize) {
                this.playHistory = this.playHistory.slice(0, this.maxHistorySize);
            }
            
            // 保存到本地存储
            this.savePlayHistory();
        }
    }
    
    savePlayHistory() {
        try {
            localStorage.setItem('playHistory', JSON.stringify(this.playHistory));
        } catch (error) {
            console.warn('保存播放历史失败:', error);
        }
    }
    
    loadPlayHistory() {
        try {
            const history = localStorage.getItem('playHistory');
            if (history) {
                this.playHistory = JSON.parse(history);
            }
        } catch (error) {
            console.warn('加载播放历史失败:', error);
            this.playHistory = [];
        }
    }
    
    saveCurrentPosition() {
        if (this.currentIndex >= 0) {
            localStorage.setItem('currentVideoIndex', this.currentIndex.toString());
        }
    }

    // 播放模式切换
    togglePlayMode() {
        const modes = ['list', 'loop', 'random', 'single'];
        const currentIndex = modes.indexOf(this.playMode);
        this.playMode = modes[(currentIndex + 1) % modes.length];
        
        const modeNames = {
            'list': '列表播放',
            'loop': '循环播放',
            'random': '随机播放',
            'single': '单曲循环'
        };
        
        showToast(`播放模式: ${modeNames[this.playMode]}`);
        this.saveSettings();
    }

    // 视频播放结束处理
    handleVideoEnded() {
        switch (this.playMode) {
            case 'single':
                // 单曲循环：重新播放当前视频
                if (this.currentIndex >= 0) {
                    this.playByIndex(this.currentIndex);
                }
                break;
                
            case 'loop':
                // 列表循环：播放下一个，如果是最后一个则回到第一个
                if (this.currentIndex < this.playlist.length - 1) {
                    this.playNext();
                } else {
                    this.playByIndex(0);
                }
                break;
                
            case 'random':
                // 随机播放：随机选择一个视频
                if (this.playlist.length > 1) {
                    let randomIndex;
                    do {
                        randomIndex = Math.floor(Math.random() * this.playlist.length);
                    } while (randomIndex === this.currentIndex);
                    this.playByIndex(randomIndex);
                }
                break;
                
            case 'list':
            default:
                // 列表播放：播放下一个，如果是最后一个则停止
                if (this.currentIndex < this.playlist.length - 1) {
                    this.playNext();
                } else {
                    showToast('播放列表已播放完毕');
                }
                break;
        }
    }

    // 播放控制
    playNext() {
        switch (this.playMode) {
            case 'random':
                if (this.playlist.length > 1) {
                    let randomIndex;
                    do {
                        randomIndex = Math.floor(Math.random() * this.playlist.length);
                    } while (randomIndex === this.currentIndex);
                    this.playByIndex(randomIndex);
                }
                break;
                
            default:
                if (this.currentIndex < this.playlist.length - 1) {
                    this.playByIndex(this.currentIndex + 1);
                } else if (this.playMode === 'loop') {
                    this.playByIndex(0);
                }
                break;
        }
    }
    
    playPrevious() {
        switch (this.playMode) {
            case 'random':
                if (this.playlist.length > 1) {
                    let randomIndex;
                    do {
                        randomIndex = Math.floor(Math.random() * this.playlist.length);
                    } while (randomIndex === this.currentIndex);
                    this.playByIndex(randomIndex);
                }
                break;
                
            default:
                if (this.currentIndex > 0) {
                    this.playByIndex(this.currentIndex - 1);
                } else if (this.playMode === 'loop') {
                    this.playByIndex(this.playlist.length - 1);
                }
                break;
        }
    }

    // 播放列表加载
    async loadPlaylist() {
        try {
            // 尝试从URL参数加载播放列表
            const urlParams = new URLSearchParams(window.location.search);
            const playlistData = urlParams.get('playlist');
            
            if (playlistData) {
                try {
                    const playlist = JSON.parse(decodeURIComponent(playlistData));
                    this.setPlaylist(playlist);
                } catch (error) {
                    console.error('解析播放列表参数失败:', error);
                }
            }
            
            // 如果没有播放列表，显示空状态
            if (this.playlist.length === 0) {
                this.showEmptyState();
            } else {
                this.hideAllOverlays();
                this.updateUI();
            }
            
        } catch (error) {
            console.error('加载播放列表失败:', error);
            this.showEmptyState();
        }
    }
    
    setPlaylist(playlist) {
        this.playlist = Array.isArray(playlist) ? playlist : [];
        this.currentIndex = -1;
        this.updateUI();
    }
    
    showEmptyState() {
        const emptyOverlay = document.getElementById('emptyOverlay');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorOverlay = document.getElementById('errorOverlay');
        
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        if (errorOverlay) errorOverlay.classList.add('hidden');
        if (emptyOverlay) emptyOverlay.classList.remove('hidden');
    }
}

// 导出
export default PlaylistPlayer;
