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
    }
    
    async initPlayer() {
        const container = document.getElementById('video-container');
        if (!container) {
            throw new Error('视频容器不存在');
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
        const playlistContainer = document.querySelector('.playlist-container');
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
        
        if (this.currentIndex !== -1 && this.playlist[this.currentIndex]) {
            const video = this.playlist[this.currentIndex];
            showToast(`播放失败: ${video.title}`, 'error');
            
            // 尝试播放下一个视频
            if (this.playlist.length > 1) {
                setTimeout(() => {
                    this.playNext();
                }, 2000);
            }
        }
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
    
    showLoadingState() {
        const container = document.getElementById('video-container');
        if (container) {
            container.classList.add('loading');
        }
    }
    
    // 历史记录管理
    addToHistory(index) {
        if (index === -1) return;
        
        // 移除重复项
        this.playHistory = this.playHistory.filter(i => i !== index);
        
        // 添加到历史记录
        this.playHistory.push(index);
        
        // 限制历史记录大小
        if (this.playHistory.length > this.maxHistorySize) {
            this.playHistory.shift();
        }
    }
    
    // 数据持久化
    async loadPlaylist() {
        try {
            const data = await storage.get('currentPlaylist');
            if (data && data.playlist) {
                this.playlist = data.playlist;
                this.currentIndex = data.currentIndex || -1;
                this.player?.setPlaylist(this.playlist);
            }
        } catch (error) {
            console.error('加载播放列表失败:', error);
        }
    }
    
    savePlaylist() {
        try {
            storage.set('currentPlaylist', {
                playlist: this.playlist,
                currentIndex: this.currentIndex,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('保存播放列表失败:', error);
        }
    }
    
    saveCurrentPosition() {
        try {
            storage.set('playerState', {
                currentIndex: this.currentIndex,
                playMode: this.playMode,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('保存播放状态失败:', error);
        }
    }
    
    loadSettings() {
        try {
            const settings = storage.get('playerSettings') || {};
            this.playMode = settings.playMode || 'list';
            this.isAutoplay = settings.autoplay !== false;
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }
    
    saveSettings() {
        try {
            storage.set('playerSettings', {
                playMode: this.playMode,
                autoplay: this.isAutoplay,
                volume: this.getVolume(),
                playbackRate: this.getPlaybackRate()
            });
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }
    
    getVolume() {
        return this.player?.getStatus()?.volume || 0.7;
    }
    
    getPlaybackRate() {
        return this.player?.getStatus()?.playbackRate || 1;
    }
    
    // 清理资源
    destroy() {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        
        this.playlist = [];
        this.currentIndex = -1;
        this.playHistory = [];
    }
}

// 导出
export default PlaylistPlayer;
