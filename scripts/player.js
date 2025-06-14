// 播放器页面JavaScript - 视频播放功能
class VideoPlayer {
    constructor() {
        this.playlist = [];
        this.currentIndex = 0;
        this.player = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.isMuted = false;
        this.shuffleMode = false;
        this.repeatMode = 0; // 0=不循环, 1=单曲循环, 2=列表循环
        this.enableProgressInTitle = false; // 是否在标题中显示进度
        this.gistManager = improvedGistManager; // 使用改进的Gist管理器
        
        this.init();
    }    async init() {
        try {
            await this.loadPlaylist();
            this.bindEvents();
            await this.initPlayer();
            this.updateUI();
            this.showLoadingMessage(false);
            // 应用保存的设置
            this.applySettings(this.getSettings());
        } catch (error) {
            console.error('播放器初始化失败:', error);
            this.showErrorMessage('播放器初始化失败: ' + error.message);
        }
    }    // 加载播放列表
    async loadPlaylist() {
        try {
            // 首先检查URL参数，优先处理分享链接
            const urlParams = new URLSearchParams(window.location.search);
            const gistId = urlParams.get('gist');
            const shareId = urlParams.get('share');
            
            if (gistId) {
                // 有Gist参数，直接从GitHub加载
                await this.loadFromGitHub(gistId);
                return;
            }
            
            if (shareId) {
                // 有分享参数，从自建后端加载
                await this.loadFromShare(shareId);
                return;
            }            
            // 没有URL参数，从本地存储加载
            this.loadFromLocalStorage();
            
        } catch (error) {
            console.error('加载播放列表失败:', error);
            this.loadFromLocalStorage(); // 降级到本地存储
        }
    }    // 从Gist或自建后端加载播放列表（智能判断）
    async loadFromShare(shareId) {
        try {
            this.showToast('正在从分享链接加载播放列表...', 'info');
              // 判断是Gist ID还是自建后端的share ID
            const isBackendId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(shareId); // UUID格式
            const isGistId = !isBackendId && shareId.length > 10; // Gist ID通常比较长，且不是UUID格式
            
            let shareData;
            
            if (isGistId) {
                // 使用GitHub Gist API
                shareData = await this.gistManager.loadPlaylist(shareId);
            } else if (isBackendId) {
                // 使用自建后端API
                shareData = await this.loadFromBackend(shareId);
            } else {
                // 尝试两种方式，优先GitHub Gist
                try {
                    shareData = await this.gistManager.loadPlaylist(shareId);
                } catch (gistError) {
                    console.warn('GitHub Gist加载失败，尝试自建后端:', gistError.message);
                    shareData = await this.loadFromBackend(shareId);
                }
            }
            
            if (shareData && shareData.videos && shareData.videos.length > 0) {
                this.playlist = shareData.videos;
                this.currentIndex = 0;
                
                // 更新页面标题
                if (shareData.title) {
                    document.title = `${shareData.title} - 青云播`;
                }
                
                this.showToast('播放列表加载成功', 'success');
            } else {
                throw new Error('分享链接中没有找到有效的播放列表数据');
            }
            
        } catch (error) {
            console.error('从分享链接加载失败:', error);
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

    // 从GitHub Gists加载播放列表  
    async loadFromGitHub(gistId) {
        try {
            this.showToast('正在从GitHub Gist加载播放列表...', 'info');
            
            const gistData = await improvedGistManager.loadPlaylist(gistId);
            
            if (gistData && gistData.videos && gistData.videos.length > 0) {
                this.playlist = gistData.videos;
                this.currentIndex = 0;
                
                // 更新页面标题
                if (gistData.title) {
                    document.title = `${gistData.title} - 青云播`;
                }
                
                this.showToast('播放列表加载成功', 'success');
            } else {
                throw new Error('GitHub Gist中没有找到有效的播放列表数据');
            }
            
        } catch (error) {
            console.error('从GitHub Gist加载失败:', error);
            throw error;
        }
    }

    // 从本地存储加载播放列表
    loadFromLocalStorage() {
        try {
            const playlistData = localStorage.getItem('currentPlaylist');
            const indexData = localStorage.getItem('currentIndex');
            
            if (playlistData) {
                this.playlist = JSON.parse(playlistData);
                this.currentIndex = indexData ? parseInt(indexData) : 0;
                
                if (this.playlist.length === 0) {
                    throw new Error('播放列表为空');
                }
                
                if (this.currentIndex >= this.playlist.length) {
                    this.currentIndex = 0;
                }
            } else {
                // 如果没有播放列表数据，使用测试数据
                console.warn('没有找到播放列表数据，使用测试视频');
                this.playlist = [{
                    title: '测试视频 - Big Buck Bunny',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    type: 'mp4'
                }];
                this.currentIndex = 0;
                this.showToast('使用测试视频，请从主页添加您的视频', 'warning');
            }
        } catch (error) {
            console.error('从本地存储加载播放列表失败:', error);
            // 使用测试数据作为后备
            this.playlist = [{
                title: '测试视频 - Big Buck Bunny',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                type: 'mp4'
            }];
            this.currentIndex = 0;
            this.showToast('加载播放列表失败，使用测试视频', 'error');
        }
    }

    // 绑定事件监听器
    bindEvents() {
        // 返回按钮
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }        // 播放列表按钮
        const playlistBtn = document.getElementById('playlistBtn');
        if (playlistBtn) {
            playlistBtn.addEventListener('click', () => this.togglePlaylist());
        }

        // 设置按钮
        const playerSettingsBtn = document.getElementById('playerSettingsBtn');
        if (playerSettingsBtn) {
            playerSettingsBtn.addEventListener('click', () => this.toggleSettings());
        }        // 设置模态框关闭按钮
        const closePlayerSettingsModal = document.getElementById('closePlayerSettingsModal');
        if (closePlayerSettingsModal) {
            closePlayerSettingsModal.addEventListener('click', () => this.toggleSettings());
        }

        // 点击模态框外部关闭
        const playerSettingsModal = document.getElementById('playerSettingsModal');
        if (playerSettingsModal) {
            playerSettingsModal.addEventListener('click', (e) => {
                if (e.target === playerSettingsModal) {
                    this.toggleSettings();
                }
            });
        }

        // 侧边栏关闭按钮
        const closeSidebar = document.getElementById('closeSidebar');
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => this.togglePlaylist());
        }        // 错误重试按钮
        const playerRetryBtn = document.getElementById('playerRetryBtn');
        if (playerRetryBtn) {
            playerRetryBtn.addEventListener('click', () => this.retryPlay());
        }

        const backToListBtn = document.getElementById('backToListBtn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', () => this.goBack());
        }

        // 侧边栏控制按钮
        const collapseSidebar = document.getElementById('collapseSidebar');
        if (collapseSidebar) {
            collapseSidebar.addEventListener('click', () => this.toggleSidebar());
        }

        const expandSidebar = document.getElementById('expandSidebar');
        if (expandSidebar) {
            expandSidebar.addEventListener('click', () => this.toggleSidebar());
        }

        const miniPlayerBtn = document.getElementById('miniPlayerBtn');
        if (miniPlayerBtn) {
            miniPlayerBtn.addEventListener('click', () => this.togglePictureInPicture());
        }

        const theaterModeBtn = document.getElementById('theaterModeBtn');
        if (theaterModeBtn) {
            theaterModeBtn.addEventListener('click', () => this.toggleTheaterMode());
        }

        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggleSettings());
        }

        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryPlay());
        }

        const skipBtn = document.getElementById('skipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.playNext());
        }

        const backToHomeBtn = document.getElementById('backToHomeBtn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => this.goBack());
        }

        // 播放列表搜索
        const playlistSearch = document.getElementById('playlistSearch');
        if (playlistSearch) {
            playlistSearch.addEventListener('input', (e) => this.searchPlaylist(e.target.value));
        }

        // 播放模式按钮
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }

        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => this.toggleRepeat());
        }

        // 键盘快捷键
        this.bindKeyboardEvents();
    }

    // 绑定键盘事件
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // 防止在输入框中触发
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (e.ctrlKey) {
                        this.playPrevious();
                    } else {
                        this.seekRelative(-10);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (e.ctrlKey) {
                        this.playNext();
                    } else {
                        this.seekRelative(10);
                    }
                    break;
                case 'KeyF':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
            }
        });
    }    // 初始化播放器
    async initPlayer() {
        this.showLoadingMessage(true);
        
        try {
            // 检查ArtPlayer是否可用
            if (typeof Artplayer === 'undefined') {
                throw new Error('ArtPlayer库未加载，请检查网络连接');
            }

            const currentVideo = this.playlist[this.currentIndex];
            if (!currentVideo) {
                throw new Error('当前视频不存在');
            }

            console.log('正在初始化播放器，当前视频:', currentVideo);

            // 检查容器是否存在
            const container = document.querySelector('#videoPlayer');
            if (!container) {
                throw new Error('找不到视频播放器容器');
            }

            // 创建ArtPlayer实例
            this.player = new Artplayer({
                container: '#videoPlayer',
                url: currentVideo.url,
                title: currentVideo.title,
                volume: this.volume,
                autoplay: true,
                muted: false,
                pip: true,
                setting: true,
                playbackRate: true,
                aspectRatio: true,
                fullscreen: true,
                fullscreenWeb: true,
                miniProgressBar: true,
                mutex: true,
                backdrop: true,
                playsInline: true,
                autoPlayback: true,
                airplay: true,
                theme: '#2196F3',
                lang: 'zh-cn',
                moreVideoAttr: {
                    crossOrigin: 'anonymous',
                },
                customType: this.getCustomType(currentVideo.type),
                controls: [
                    {
                        position: 'left',
                        html: '<i class="material-icons">skip_previous</i>',
                        tooltip: '上一个视频',
                        click: () => this.playPrevious(),
                    },
                    {
                        position: 'left',
                        html: '<i class="material-icons">skip_next</i>',
                        tooltip: '下一个视频',
                        click: () => this.playNext(),
                    },
                    {
                        position: 'right',
                        html: '<i class="material-icons">queue_music</i>',
                        tooltip: '播放列表',
                        click: () => this.togglePlaylist(),
                    },
                ],
            });

            console.log('ArtPlayer实例创建成功:', this.player);

            // 绑定播放器事件
            this.bindPlayerEvents();
            
            // 显示成功消息
            this.showToast('播放器初始化成功');
            
        } catch (error) {
            console.error('初始化播放器失败:', error);
            this.showErrorMessage('播放器初始化失败: ' + error.message);
        }
    }

    // 获取自定义类型配置
    getCustomType(type) {
        switch (type) {
            case 'm3u8':
                return {
                    m3u8: function(video, url) {
                        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                            const hls = new Hls();
                            hls.loadSource(url);
                            hls.attachMedia(video);
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                        }
                    }
                };
            default:
                return {};
        }
    }

    // 绑定播放器事件
    bindPlayerEvents() {
        if (!this.player) return;

        this.player.on('ready', () => {
            console.log('播放器准备就绪');
            this.showLoadingMessage(false);
            this.updateVideoInfo();
        });

        this.player.on('video:loadstart', () => {
            this.showLoadingMessage(true);
        });

        this.player.on('video:canplay', () => {
            this.showLoadingMessage(false);
        });

        this.player.on('video:timeupdate', () => {
            this.currentTime = this.player.currentTime;
            this.duration = this.player.duration;
            this.updateProgress();
        });        this.player.on('video:ended', () => {
            const settings = this.getSettings();
            if (settings.autoplayNext) {
                this.playNext();
            } else {
                this.showToast('视频播放完成');
            }
        });

        this.player.on('video:error', (error) => {
            console.error('播放错误:', error);
            this.showErrorMessage('视频播放出错，请检查链接是否有效');
        });

        this.player.on('play', () => {
            this.isPlaying = true;
            this.updatePlayButton();
        });

        this.player.on('pause', () => {
            this.isPlaying = false;
            this.updatePlayButton();
        });        this.player.on('video:volumechange', () => {
            this.volume = this.player.volume;
            this.isMuted = this.player.muted;
            this.updateVolumeUI();
            
            // 保存音量设置
            const settings = this.getSettings();
            if (settings.rememberVolume) {
                localStorage.setItem('playerVolume', this.volume.toString());
                localStorage.setItem('playerMuted', this.isMuted.toString());
            }
        });
    }

    // 播放/暂停切换
    togglePlayPause() {
        if (!this.player) return;

        if (this.isPlaying) {
            this.player.pause();
        } else {
            this.player.play();
        }
    }

    // 播放上一个视频
    playPrevious() {
        if (this.playlist.length <= 1) {
            this.showToast('已经是第一个视频了', 'warning');
            return;
        }

        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        this.switchVideo();
    }

    // 播放下一个视频
    playNext() {
        if (this.playlist.length <= 1) {
            this.showToast('已经是最后一个视频了', 'warning');
            return;
        }

        this.currentIndex = this.currentIndex < this.playlist.length - 1 ? this.currentIndex + 1 : 0;
        this.switchVideo();
    }

    // 切换视频
    async switchVideo() {
        if (!this.player) return;

        try {
            this.showLoadingMessage(true);
            const currentVideo = this.playlist[this.currentIndex];
            
            if (!currentVideo) {
                throw new Error('视频不存在');
            }

            // 切换视频源
            this.player.switchUrl(currentVideo.url);
            this.player.title = currentVideo.title;
            
            this.updateVideoInfo();
            this.updateSidebar();
            
            // 保存当前索引
            localStorage.setItem('currentIndex', this.currentIndex.toString());
            
        } catch (error) {
            console.error('切换视频失败:', error);
            this.showErrorMessage('切换视频失败: ' + error.message);
        }
    }

    // 跳转到指定时间
    seekTo(e) {
        if (!this.player || !this.duration) return;

        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = pos * this.duration;
        
        this.player.currentTime = time;
    }

    // 相对跳转
    seekRelative(seconds) {
        if (!this.player) return;

        const newTime = Math.max(0, Math.min(this.duration, this.currentTime + seconds));
        this.player.currentTime = newTime;
    }

    // 设置音量
    setVolume(volume) {
        if (!this.player) return;
        
        this.volume = Math.max(0, Math.min(1, volume));
        this.player.volume = this.volume;
        this.updateVolumeUI();
    }

    // 切换静音
    toggleMute() {
        if (!this.player) return;

        this.player.muted = !this.player.muted;
    }

    // 切换全屏
    toggleFullscreen() {
        if (!this.player) return;

        this.player.fullscreen = !this.player.fullscreen;
    }

    // 切换播放列表显示
    togglePlaylist() {
        const sidebar = document.getElementById('playlistSidebar');
        if (sidebar) {
            sidebar.classList.toggle('show');
        }
    }

    // 切换侧边栏显示/隐藏
    toggleSidebar() {
        const sidebar = document.getElementById('playlistSidebar');
        const expandBtn = document.getElementById('expandSidebar');
        const collapseBtn = document.getElementById('collapseSidebar');
        
        if (sidebar) {
            const isExpanded = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed');
            
            if (expandBtn) {
                expandBtn.classList.toggle('hidden', !isExpanded);
            }
            if (collapseBtn) {
                collapseBtn.classList.toggle('hidden', isExpanded);
            }
        }
    }

    // 切换画中画模式
    togglePictureInPicture() {
        if (!this.player) return;
        
        try {
            if (this.player.pip) {
                this.player.pip = false;
            } else {
                this.player.pip = true;
            }
        } catch (error) {
            console.error('画中画模式切换失败:', error);
            this.showToast('您的浏览器不支持画中画模式', 'warning');
        }
    }

    // 切换影院模式
    toggleTheaterMode() {
        const playerContainer = document.querySelector('.player-container');
        const sidebar = document.getElementById('playlistSidebar');
        
        if (playerContainer) {
            playerContainer.classList.toggle('theater-mode');
        }
        
        if (sidebar) {
            sidebar.classList.toggle('theater-mode');
        }
        
        const theaterBtn = document.getElementById('theaterModeBtn');
        if (theaterBtn) {
            const icon = theaterBtn.querySelector('i');
            if (icon) {
                const isTheaterMode = playerContainer?.classList.contains('theater-mode');
                icon.textContent = isTheaterMode ? 'crop_free' : 'crop_landscape';
            }
        }
    }

    // 搜索播放列表
    searchPlaylist(query) {
        const playlistContent = document.getElementById('playlistContent');
        if (!playlistContent) return;
        
        const items = playlistContent.querySelectorAll('.playlist-item');
        const searchQuery = query.toLowerCase().trim();
        
        items.forEach(item => {
            const title = item.getAttribute('data-title') || '';
            const isMatch = title.toLowerCase().includes(searchQuery);
            item.style.display = isMatch ? 'flex' : 'none';
        });
    }

    // 切换随机播放
    toggleShuffle() {
        this.shuffleMode = !this.shuffleMode;
        const shuffleBtn = document.getElementById('shuffleBtn');
        
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active', this.shuffleMode);
        }
        
        this.showToast(this.shuffleMode ? '已开启随机播放' : '已关闭随机播放');
    }

    // 切换循环播放
    toggleRepeat() {
        // 循环模式: 0=不循环, 1=单曲循环, 2=列表循环
        this.repeatMode = (this.repeatMode + 1) % 3;
        const repeatBtn = document.getElementById('repeatBtn');
        
        if (repeatBtn) {
            const icon = repeatBtn.querySelector('i');
            repeatBtn.classList.remove('active', 'single-repeat');
            
            switch (this.repeatMode) {
                case 0:
                    icon.textContent = 'repeat';
                    this.showToast('已关闭循环播放');
                    break;
                case 1:
                    icon.textContent = 'repeat_one';
                    repeatBtn.classList.add('active', 'single-repeat');
                    this.showToast('已开启单曲循环');
                    break;
                case 2:
                    icon.textContent = 'repeat';
                    repeatBtn.classList.add('active');
                    this.showToast('已开启列表循环');
                    break;
            }
        }
    }    // 更新UI
    updateUI() {
        this.updateVideoInfo();
        this.renderPlaylist();
        this.updateProgress();
        this.updateVolumeUI();
        this.updatePlayButton();
    }

    // 更新视频信息
    updateVideoInfo() {
        const currentVideo = this.playlist[this.currentIndex];
        if (!currentVideo) return;

        const videoTitle = document.getElementById('videoTitle');
        const videoIndex = document.getElementById('videoIndex');
        const videoType = document.getElementById('videoType');

        if (videoTitle) {
            videoTitle.textContent = currentVideo.title;
            document.title = currentVideo.title + ' - 青云播';
        }

        if (videoIndex) {
            videoIndex.textContent = (this.currentIndex + 1) + '/' + this.playlist.length;
        }

        if (videoType) {
            videoType.textContent = currentVideo.type.toUpperCase();
        }
    }

    // 更新侧边栏
    updateSidebar() {
        const sidebarVideoList = document.getElementById('sidebarVideoList');
        if (!sidebarVideoList) return;

        const self = this;
        sidebarVideoList.innerHTML = this.playlist.map((video, index) => {
            return '<div class="sidebar-video-item ' + (index === self.currentIndex ? 'active' : '') + '" onclick="videoPlayer.playVideoByIndex(' + index + ')">' +
                '<div class="sidebar-video-index">' + (index + 1) + '</div>' +
                '<div class="sidebar-video-info">' +
                    '<div class="sidebar-video-title">' + self.escapeHtml(video.title) + '</div>' +
                    '<div class="sidebar-video-meta">' + video.type.toUpperCase() + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // 渲染播放列表
    renderPlaylist() {
        const playlistContent = document.getElementById('playlistContent');
        const playlistStats = document.getElementById('playlistStats');
        
        if (!playlistContent) return;
        
        if (this.playlist.length === 0) {
            playlistContent.innerHTML = `
                <div class="playlist-empty">
                    <i class="material-icons">queue_music</i>
                    <p>播放列表为空</p>
                    <button onclick="window.close()" class="btn btn-secondary">返回首页</button>
                </div>
            `;
            return;
        }
        
        playlistContent.innerHTML = this.playlist.map((video, index) => `
            <div class="playlist-item ${index === this.currentIndex ? 'active' : ''}" 
                 data-index="${index}" 
                 data-title="${video.title}">
                <div class="item-info">
                    <div class="item-title">${this.escapeHtml(video.title)}</div>
                    <div class="item-type">${video.type.toUpperCase()}</div>
                </div>
                <div class="item-actions">
                    <button class="item-btn" onclick="player.playVideo(${index})" title="播放">
                        <i class="material-icons">play_arrow</i>
                    </button>
                    <button class="item-btn" onclick="player.removeFromPlaylist(${index})" title="移除">
                        <i class="material-icons">close</i>
                    </button>
                </div>
            </div>
        `).join('');
        
        if (playlistStats) {
            playlistStats.textContent = `${this.currentIndex + 1}/${this.playlist.length}`;
        }
    }    // 播放指定视频
    playVideo(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentIndex = index;
            this.loadCurrentVideo();
        }
    }

    // 加载当前视频
    loadCurrentVideo() {
        if (this.playlist.length === 0) {
            this.showErrorMessage('播放列表为空');
            return;
        }
        
        if (this.currentIndex >= this.playlist.length) {
            this.currentIndex = 0;
        }
        
        this.switchVideo();
    }

    // 从播放列表中移除视频
    removeFromPlaylist(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.playlist.splice(index, 1);
            
            // 调整当前播放索引
            if (index < this.currentIndex) {
                this.currentIndex--;
            } else if (index === this.currentIndex) {
                if (this.currentIndex >= this.playlist.length) {
                    this.currentIndex = 0;
                }
                this.loadCurrentVideo();
            }
            
            this.renderPlaylist();
            this.updateVideoInfo();
        }
    }

    // 根据索引播放视频
    playVideoByIndex(index) {
        if (index >= 0 && index < this.playlist.length && index !== this.currentIndex) {
            this.currentIndex = index;
            this.switchVideo();
        }
    }

    // 更新进度条（已移除自定义控件，使用ArtPlayer内置控件）
    updateProgress() {
        // 更新标题显示进度（如果启用）
        if (this.enableProgressInTitle) {
            document.title = `${this.formatTime(this.currentTime)} - ${this.playlist[this.currentIndex]?.title} - 青云播`;
        }
    }

    // 更新音量UI（已移除自定义控件，使用ArtPlayer内置控件）
    updateVolumeUI() {
        // ArtPlayer 会自动处理音量UI更新
    }

    // 更新播放按钮（已移除自定义控件，使用ArtPlayer内置控件）
    updatePlayButton() {
        // ArtPlayer 会自动处理播放按钮状态更新
    }    // 显示/隐藏加载信息
    showLoadingMessage(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const errorMessage = document.getElementById('errorMessage');
        
        if (loadingIndicator) {
            if (show) {
                loadingIndicator.style.display = 'block';
                if (errorMessage) errorMessage.style.display = 'none';
            } else {
                loadingIndicator.style.display = 'none';
            }
        }
    }

    // 显示错误信息
    showErrorMessage(message) {
        const errorOverlay = document.getElementById('errorOverlay');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const errorMessage = errorOverlay?.querySelector('.error-message');
        
        if (errorOverlay) {
            if (errorMessage) {
                errorMessage.textContent = message;
            }
            errorOverlay.classList.remove('hidden');
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
        
        this.showToast(message, 'error');
    }

    // 重试播放
    retryPlay() {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.classList.remove('show');
        }
        
        this.switchVideo();
    }

    // 返回列表页面
    goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    }

    // 显示提示消息
    showToast(message, type = 'info') {
        // 创建toast容器如果不存在
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // 添加到容器
        toastContainer.appendChild(toast);

        // 显示动画
        setTimeout(() => toast.classList.add('show'), 100);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 格式化时间
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hrs > 0) {
            return hrs.toString().padStart(2, '0') + ':' + 
                   mins.toString().padStart(2, '0') + ':' + 
                   secs.toString().padStart(2, '0');
        } else {
            return mins.toString().padStart(2, '0') + ':' + 
                   secs.toString().padStart(2, '0');
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 销毁播放器
    destroy() {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
    }

    // 切换设置面板显示/隐藏
    toggleSettings() {
        const modal = document.getElementById('playerSettingsModal');
        if (modal) {
            const isVisible = modal.classList.contains('show');
            
            if (isVisible) {
                modal.classList.remove('show');
            } else {
                modal.classList.add('show');
                // 加载当前设置
                this.loadSettings();
            }
        }
    }

    // 加载设置
    loadSettings() {
        const settings = this.getSettings();
        
        // 设置复选框状态
        const autoplayNext = document.getElementById('autoplayNext');
        if (autoplayNext) autoplayNext.checked = settings.autoplayNext;
        
        const rememberVolume = document.getElementById('rememberVolume');
        if (rememberVolume) rememberVolume.checked = settings.rememberVolume;
        
        const showNotifications = document.getElementById('showNotifications');
        if (showNotifications) showNotifications.checked = settings.showNotifications;
        
        const showProgressOnTitle = document.getElementById('showProgressOnTitle');
        if (showProgressOnTitle) showProgressOnTitle.checked = settings.showProgressOnTitle;
        
        const defaultQuality = document.getElementById('defaultQuality');
        if (defaultQuality) defaultQuality.value = settings.defaultQuality;
    }

    // 绑定设置项事件
    bindSettingsEvents() {
        // 自动播放下一个视频
        const autoplayNext = document.getElementById('autoplayNext');
        if (autoplayNext) {
            autoplayNext.addEventListener('change', () => this.saveSettings());
        }

        // 记住音量设置
        const rememberVolume = document.getElementById('rememberVolume');
        if (rememberVolume) {
            rememberVolume.addEventListener('change', () => this.saveSettings());
        }

        // 显示播放通知
        const showNotifications = document.getElementById('showNotifications');
        if (showNotifications) {
            showNotifications.addEventListener('change', () => this.saveSettings());
        }

        // 在标题中显示播放进度
        const showProgressOnTitle = document.getElementById('showProgressOnTitle');
        if (showProgressOnTitle) {
            showProgressOnTitle.addEventListener('change', () => {
                this.enableProgressInTitle = showProgressOnTitle.checked;
                this.saveSettings();
            });
        }

        // 默认画质
        const defaultQuality = document.getElementById('defaultQuality');
        if (defaultQuality) {
            defaultQuality.addEventListener('change', () => this.saveSettings());
        }
    }

    // 获取设置
    getSettings() {
        const defaultSettings = {
            autoplayNext: true,
            rememberVolume: true,
            showNotifications: true,
            showProgressOnTitle: false,
            defaultQuality: 'auto'
        };
        
        try {
            const saved = localStorage.getItem('playerSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('获取设置失败:', error);
            return defaultSettings;
        }
    }

    // 保存设置
    saveSettings() {
        try {
            const settings = {
                autoplayNext: document.getElementById('autoplayNext')?.checked || false,
                rememberVolume: document.getElementById('rememberVolume')?.checked || false,
                showNotifications: document.getElementById('showNotifications')?.checked || false,
                showProgressOnTitle: document.getElementById('showProgressOnTitle')?.checked || false,
                defaultQuality: document.getElementById('defaultQuality')?.value || 'auto'
            };
            
            localStorage.setItem('playerSettings', JSON.stringify(settings));
            this.showToast('设置已保存');
            
            // 应用设置
            this.applySettings(settings);
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showToast('保存设置失败', 'error');
        }
    }    // 应用设置
    applySettings(settings) {
        // 应用记住音量设置
        if (settings.rememberVolume && this.player) {
            const savedVolume = localStorage.getItem('playerVolume');
            const savedMuted = localStorage.getItem('playerMuted');
            if (savedVolume) {
                this.player.volume = parseFloat(savedVolume);
            }
            if (savedMuted) {
                this.player.muted = savedMuted === 'true';
            }
        }
        
        // 应用标题进度显示
        if (settings.showProgressOnTitle) {
            this.enableProgressInTitle = true;
        } else {
            this.enableProgressInTitle = false;
            document.title = '青云播 - 视频播放器';
        }
        
        // 存储设置以供其他方法使用
        this.currentSettings = settings;
    }
}

// 页面加载完成后初始化
let videoPlayer;

document.addEventListener('DOMContentLoaded', function() {
    videoPlayer = new VideoPlayer();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
    if (videoPlayer) {
        videoPlayer.destroy();
    }
});
