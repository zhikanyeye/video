// 增强版视频播放器 - 支持B站、YouTube等在线视频平台
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
        this.enableProgressInTitle = false;
        this.currentPlayerType = null; // 'artplayer' 或 'iframe'
        this.currentParsedVideo = null;
        
        this.init();
    }

    async init() {
        try {
            await this.loadPlaylist();
            this.bindEvents();
            this.initNetworkListener();
            await this.initPlayerWithRetry();
            this.updateUI();
            this.showLoadingMessage(false);
            this.applySettings(this.getSettings());
        } catch (error) {
            console.error('播放器初始化失败:', error);
            this.showErrorMessage('播放器初始化失败: ' + error.message);
        }
    }

    // 加载播放列表
    async loadPlaylist() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const gistParam = urlParams.get('gist');
            
            if (gistParam) {
                await this.loadFromGist(gistParam);
                return;
            }

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
            console.error('加载播放列表失败:', error);
            this.playlist = [{
                title: '测试视频 - Big Buck Bunny',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                type: 'mp4'
            }];
            this.currentIndex = 0;
            this.showToast('加载播放列表失败，使用测试视频', 'error');
        }
    }

    // 从Gist加载播放列表
    async loadFromGist(gistId) {
        try {
            if (typeof gitHubManager === 'undefined') {
                throw new Error('GitHub管理器未初始化');
            }

            this.showToast('正在从GitHub加载播放列表...', 'info');
            
            const result = await gitHubManager.importFromGist(gistId);
            
            if (result.success && result.videos && result.videos.length > 0) {
                this.playlist = result.videos;
                this.currentIndex = 0;
                this.showToast('成功加载 ' + result.videos.length + ' 个视频', 'success');
            } else {
                throw new Error(result.error || '加载失败');
            }
        } catch (error) {
            console.error('从Gist加载失败:', error);
            this.showToast('加载失败: ' + error.message, 'error');
            
            const playlistData = localStorage.getItem('currentPlaylist');
            if (playlistData) {
                this.playlist = JSON.parse(playlistData);
                this.currentIndex = 0;
            } else {
                this.playlist = [{
                    title: '测试视频 - Big Buck Bunny',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    type: 'mp4'
                }];
                this.currentIndex = 0;
            }
        }
    }

    // 绑定事件监听器
    bindEvents() {
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }

        const playlistBtn = document.getElementById('playlistBtn');
        if (playlistBtn) {
            playlistBtn.addEventListener('click', () => this.togglePlaylist());
        }

        const playerSettingsBtn = document.getElementById('playerSettingsBtn');
        if (playerSettingsBtn) {
            playerSettingsBtn.addEventListener('click', () => this.toggleSettings());
        }

        const closePlayerSettingsModal = document.getElementById('closePlayerSettingsModal');
        if (closePlayerSettingsModal) {
            closePlayerSettingsModal.addEventListener('click', () => this.toggleSettings());
        }

        const playerSettingsModal = document.getElementById('playerSettingsModal');
        if (playerSettingsModal) {
            playerSettingsModal.addEventListener('click', (e) => {
                if (e.target === playerSettingsModal) {
                    this.toggleSettings();
                }
            });
        }

        const closeSidebar = document.getElementById('closeSidebar');
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => this.togglePlaylist());
        }

        const retryBtn = document.getElementById('playerRetryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryPlay());
        }

        const backToListBtn = document.getElementById('backToListBtn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', () => this.goBack());
        }

        this.bindKeyboardEvents();
    }

    // 绑定键盘事件
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
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
                case 'ArrowUp':
                    e.preventDefault();
                    this.adjustVolume(0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.adjustVolume(-0.1);
                    break;
                case 'KeyF':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'KeyL':
                    e.preventDefault();
                    this.seekRelative(10);
                    break;
                case 'KeyJ':
                    e.preventDefault();
                    this.seekRelative(-10);
                    break;
                case 'Key0':
                case 'Key1':
                case 'Key2':
                case 'Key3':
                case 'Key4':
                case 'Key5':
                case 'Key6':
                case 'Key7':
                case 'Key8':
                case 'Key9':
                    e.preventDefault();
                    const percent = parseInt(e.code.replace('Key', '')) / 10;
                    this.seekToPercent(percent);
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
            }
        });
    }

    // 初始化播放器
    async initPlayer() {
        this.showLoadingMessage(true);
        
        try {
            if (typeof Artplayer === 'undefined') {
                throw new Error('ArtPlayer库未加载，请检查网络连接');
            }

            const currentVideo = this.playlist[this.currentIndex];
            if (!currentVideo) {
                throw new Error('当前视频不存在');
            }

            console.log('正在初始化播放器，当前视频:', currentVideo);

            // 解析视频URL
            const parsedVideo = await this.parseVideoUrl(currentVideo.url);
            console.log('视频解析结果:', parsedVideo);

            const container = document.querySelector('#videoPlayer');
            if (!container) {
                throw new Error('找不到视频播放器容器');
            }

            // 如果是iframe类型，使用iframe播放器
            if (parsedVideo.type === 'iframe') {
                this.initIframePlayer(parsedVideo);
                return;
            }

            // 否则使用ArtPlayer
            await this.initArtPlayer(parsedVideo, currentVideo);
            
        } catch (error) {
            console.error('初始化播放器失败:', error);
            this.showErrorMessage('播放器初始化失败: ' + error.message);
        }
    }

    // 初始化iframe播放器
    initIframePlayer(parsedVideo) {
        try {
            const artplayerContainer = document.querySelector('#videoPlayer');
            if (artplayerContainer) {
                artplayerContainer.style.display = 'none';
            }

            let iframeContainer = document.querySelector('#iframePlayer');
            if (!iframeContainer) {
                iframeContainer = document.createElement('div');
                iframeContainer.id = 'iframePlayer';
                iframeContainer.style.cssText = 'width: 100%; height: 100%; position: relative; background: #000;';
                
                const parent = artplayerContainer.parentNode;
                parent.appendChild(iframeContainer);
            }

            const iframe = document.createElement('iframe');
            iframe.src = parsedVideo.url;
            iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: #000;';
            iframe.allowFullscreen = true;
            iframe.allow = 'autoplay; fullscreen; picture-in-picture';
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-fullscreen');
            iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

            iframeContainer.innerHTML = '';
            iframeContainer.appendChild(iframe);
            iframeContainer.style.display = 'block';

            this.showLoadingMessage(false);
            this.updateVideoInfo();
            
            console.log(parsedVideo.platform + '视频播放器初始化成功');
            this.showToast(parsedVideo.platform + '视频加载成功');

            this.currentPlayerType = 'iframe';
            this.currentParsedVideo = parsedVideo;

        } catch (error) {
            console.error('iframe播放器初始化失败:', error);
            this.showErrorMessage('iframe播放器初始化失败: ' + error.message);
        }
    }

    // 初始化ArtPlayer
    async initArtPlayer(parsedVideo, videoInfo) {
        try {
            const artplayerContainer = document.querySelector('#videoPlayer');
            if (artplayerContainer) {
                artplayerContainer.style.display = 'block';
            }

            const iframeContainer = document.querySelector('#iframePlayer');
            if (iframeContainer) {
                iframeContainer.style.display = 'none';
            }

            this.player = new Artplayer({
                container: '#videoPlayer',
                url: parsedVideo.url,
                title: videoInfo.title,
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
                customType: this.getCustomType(videoInfo.type),
                controls: [
                    {
                        position: 'left',
                        html: '<i class="material-icons" style="font-size: 18px;">skip_previous</i>',
                        tooltip: '上一个',
                        click: () => this.playPrevious(),
                    },
                    {
                        position: 'left', 
                        html: '<i class="material-icons" style="font-size: 18px;">skip_next</i>',
                        tooltip: '下一个',
                        click: () => this.playNext(),
                    },
                    {
                        position: 'right',
                        html: '<i class="material-icons" style="font-size: 18px;">queue_music</i>',
                        tooltip: '播放列表',
                        click: () => this.togglePlaylist(),
                    },
                    {
                        position: 'right',
                        html: '<i class="material-icons" style="font-size: 18px;">smart_display</i>',
                        tooltip: parsedVideo.platform || '直接播放',
                        click: () => this.showVideoInfo(),
                    },
                ],
            });

            console.log('ArtPlayer实例创建成功:', this.player);

            this.bindPlayerEvents();
            
            this.currentPlayerType = 'artplayer';
            this.currentParsedVideo = parsedVideo;
            
            this.showToast((parsedVideo.platform || '直接') + '视频初始化成功');
            
        } catch (error) {
            console.error('ArtPlayer初始化失败:', error);
            this.showErrorMessage('ArtPlayer初始化失败: ' + error.message);
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
            case 'flv':
                return {
                    flv: function(video, url) {
                        if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
                            const flvPlayer = flvjs.createPlayer({
                                type: 'flv',
                                url: url,
                            });
                            flvPlayer.attachMediaElement(video);
                            flvPlayer.load();
                        }
                    }
                };
            default:
                return {};
        }
    }

    // 增强的视频URL解析功能
    async parseVideoUrl(url) {
        try {
            if (this.isDirectVideoUrl(url)) {
                return {
                    type: 'direct',
                    url: url,
                    platform: this.detectVideoPlatform(url)
                };
            }

            if (this.isBilibiliUrl(url)) {
                return await this.parseBilibiliUrl(url);
            }

            if (this.isYouTubeUrl(url)) {
                return await this.parseYouTubeUrl(url);
            }

            if (this.isOtherPlatformUrl(url)) {
                return await this.parseOtherPlatformUrl(url);
            }

            return {
                type: 'direct',
                url: url,
                platform: 'unknown'
            };

        } catch (error) {
            console.error('视频URL解析失败:', error);
            throw new Error('视频解析失败: ' + error.message);
        }
    }

    // 检测是否为直接视频链接
    isDirectVideoUrl(url) {
        const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|m3u8|mpd)(\?.*)?$/i;
        return videoExtensions.test(url);
    }

    // 检测视频平台
    detectVideoPlatform(url) {
        if (url.includes('bilibili.com') || url.includes('b23.tv')) return 'bilibili';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('vimeo.com')) return 'vimeo';
        if (url.includes('dailymotion.com')) return 'dailymotion';
        if (url.includes('twitch.tv')) return 'twitch';
        return 'direct';
    }

    // B站URL检测
    isBilibiliUrl(url) {
        return url.includes('bilibili.com') || url.includes('b23.tv');
    }

    // YouTube URL检测
    isYouTubeUrl(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }

    // 其他平台URL检测
    isOtherPlatformUrl(url) {
        const platforms = ['vimeo.com', 'dailymotion.com', 'twitch.tv', 'facebook.com/watch'];
        return platforms.some(platform => url.includes(platform));
    }

    // B站视频解析
    async parseBilibiliUrl(url) {
        try {
            let videoId = null;
            let idType = null;

            if (url.includes('b23.tv')) {
                try {
                    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
                    url = response.url;
                } catch (error) {
                    console.warn('短链接解析失败，尝试直接处理');
                }
            }

            const bvMatch = url.match(/BV([A-Za-z0-9]+)/);
            if (bvMatch) {
                videoId = 'BV' + bvMatch[1];
                idType = 'bvid';
            } else {
                const avMatch = url.match(/av(\d+)/);
                if (avMatch) {
                    videoId = avMatch[1];
                    idType = 'aid';
                }
            }

            if (!videoId) {
                throw new Error('无法提取B站视频ID');
            }

            const embedUrl = 'https://player.bilibili.com/player.html?' + idType + '=' + videoId + '&autoplay=1&high_quality=1&danmaku=0';

            return {
                type: 'iframe',
                url: embedUrl,
                platform: 'bilibili',
                originalUrl: url,
                videoId: videoId
            };

        } catch (error) {
            console.error('B站视频解析失败:', error);
            throw new Error('B站视频解析失败: ' + error.message);
        }
    }

    // YouTube视频解析
    async parseYouTubeUrl(url) {
        try {
            let videoId = null;

            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
                /youtube\.com\/v\/([^&\n?#]+)/,
                /youtube\.com\/.*[?&]v=([^&\n?#]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    videoId = match[1];
                    break;
                }
            }

            if (!videoId) {
                throw new Error('无法提取YouTube视频ID');
            }

            const embedUrl = 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1&controls=1&rel=0&modestbranding=1';

            return {
                type: 'iframe',
                url: embedUrl,
                platform: 'youtube',
                originalUrl: url,
                videoId: videoId
            };

        } catch (error) {
            console.error('YouTube视频解析失败:', error);
            throw new Error('YouTube视频解析失败: ' + error.message);
        }
    }

    // 其他平台视频解析
    async parseOtherPlatformUrl(url) {
        try {
            if (url.includes('vimeo.com')) {
                const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                if (vimeoMatch) {
                    const videoId = vimeoMatch[1];
                    return {
                        type: 'iframe',
                        url: 'https://player.vimeo.com/video/' + videoId + '?autoplay=1',
                        platform: 'vimeo',
                        originalUrl: url,
                        videoId: videoId
                    };
                }
            }

            if (url.includes('dailymotion.com')) {
                const dmMatch = url.match(/dailymotion\.com\/video\/([^_]+)/);
                if (dmMatch) {
                    const videoId = dmMatch[1];
                    return {
                        type: 'iframe',
                        url: 'https://www.dailymotion.com/embed/video/' + videoId + '?autoplay=1',
                        platform: 'dailymotion',
                        originalUrl: url,
                        videoId: videoId
                    };
                }
            }

            if (url.includes('twitch.tv')) {
                const twitchMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
                if (twitchMatch) {
                    const videoId = twitchMatch[1];
                    return {
                        type: 'iframe',
                        url: 'https://player.twitch.tv/?video=' + videoId + '&parent=' + window.location.hostname + '&autoplay=true',
                        platform: 'twitch',
                        originalUrl: url,
                        videoId: videoId
                    };
                }
            }

            return {
                type: 'direct',
                url: url,
                platform: 'unknown'
            };

        } catch (error) {
            console.error('其他平台视频解析失败:', error);
            throw new Error('视频解析失败: ' + error.message);
        }
    }

    // 绑定播放器事件
    bindPlayerEvents() {
        if (!this.player) return;

        this.player.on('ready', () => {
            console.log('播放器准备就绪');
            this.showLoadingMessage(false);
            this.updateVideoInfo();
            this.restorePlaybackRate();
        });

        this.player.on('video:loadstart', () => {
            this.showLoadingMessage(true);
        });

        this.player.on('video:canplay', () => {
            this.showLoadingMessage(false);
            this.restoreProgress();
        });

        // 创建防抖的保存进度函数（每5秒保存一次）
        if (!this.debouncedSaveProgress) {
            this.debouncedSaveProgress = this.debounce(() => this.saveProgress(), 5000);
        }

        this.player.on('video:timeupdate', () => {
            this.currentTime = this.player.currentTime;
            this.duration = this.player.duration;
            this.updateProgress();
            this.debouncedSaveProgress();
        });

        this.player.on('video:ended', () => {
            this.clearProgress();
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
        });

        this.player.on('video:volumechange', () => {
            this.volume = this.player.volume;
            this.isMuted = this.player.muted;
            this.updateVolumeUI();
            
            const settings = this.getSettings();
            if (settings.rememberVolume) {
                localStorage.setItem('playerVolume', this.volume.toString());
                localStorage.setItem('playerMuted', this.isMuted.toString());
            }
        });

        // 监听播放速度变化
        this.player.on('video:ratechange', () => {
            if (this.player) {
                this.savePlaybackRate(this.player.playbackRate);
            }
        });
    }

    // 播放/暂停切换
    togglePlayPause() {
        if (this.currentPlayerType === 'artplayer' && this.player) {
            if (this.isPlaying) {
                this.player.pause();
            } else {
                this.player.play();
            }
        } else if (this.currentPlayerType === 'iframe') {
            this.showToast('请使用视频内置控件进行播放控制', 'info');
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
        try {
            this.showLoadingMessage(true);
            const currentVideo = this.playlist[this.currentIndex];
            
            if (!currentVideo) {
                throw new Error('视频不存在');
            }

            const parsedVideo = await this.parseVideoUrl(currentVideo.url);
            console.log('切换到视频:', parsedVideo);

            this.cleanupCurrentPlayer();

            if (parsedVideo.type === 'iframe') {
                this.initIframePlayer(parsedVideo);
            } else {
                await this.initArtPlayer(parsedVideo, currentVideo);
            }
            
            this.updateVideoInfo();
            
            localStorage.setItem('currentIndex', this.currentIndex.toString());
            
        } catch (error) {
            console.error('切换视频失败:', error);
            this.showErrorMessage('切换视频失败: ' + error.message);
        }
    }

    // 清理当前播放器
    cleanupCurrentPlayer() {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }

        const iframeContainer = document.querySelector('#iframePlayer');
        if (iframeContainer) {
            iframeContainer.style.display = 'none';
            iframeContainer.innerHTML = '';
        }

        this.currentPlayerType = null;
        this.currentParsedVideo = null;
    }

    // 显示视频信息
    showVideoInfo() {
        if (this.currentParsedVideo) {
            const info = '平台: ' + this.currentParsedVideo.platform + '\n类型: ' + this.currentParsedVideo.type + '\n视频ID: ' + (this.currentParsedVideo.videoId || 'N/A');
            this.showToast(info, 'info');
        }
    }

    // 相对跳转（仅对直接视频有效）
    seekRelative(seconds) {
        if (this.currentPlayerType !== 'artplayer' || !this.player) return;

        const newTime = Math.max(0, Math.min(this.duration, this.currentTime + seconds));
        this.player.currentTime = newTime;
    }

    // 切换静音（仅对直接视频有效）
    toggleMute() {
        if (this.currentPlayerType !== 'artplayer' || !this.player) return;

        this.player.muted = !this.player.muted;
    }

    // 切换全屏
    toggleFullscreen() {
        if (this.currentPlayerType === 'artplayer' && this.player) {
            this.player.fullscreen = !this.player.fullscreen;
        } else if (this.currentPlayerType === 'iframe') {
            const iframeContainer = document.querySelector('#iframePlayer');
            if (iframeContainer) {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    iframeContainer.requestFullscreen().catch(err => {
                        console.warn('全屏请求失败:', err);
                        this.showToast('全屏功能可能不支持iframe视频', 'warning');
                    });
                }
            }
        }
    }

    // 切换播放列表显示
    togglePlaylist() {
        const sidebar = document.getElementById('playlistSidebar');
        if (sidebar) {
            sidebar.classList.toggle('show');
        }
    }

    // 更新UI
    updateUI() {
        this.updateVideoInfo();
        this.renderPlaylist();
        if (this.currentPlayerType === 'artplayer') {
            this.updateProgress();
            this.updateVolumeUI();
            this.updatePlayButton();
        }
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
            const platform = this.currentParsedVideo ? this.currentParsedVideo.platform : currentVideo.type;
            videoType.textContent = platform.toUpperCase();
        }
    }

    // 渲染播放列表
    renderPlaylist() {
        const playlistContent = document.getElementById('playlistContent');
        const playlistStats = document.getElementById('playlistStats');
        
        if (!playlistContent) return;
        
        if (this.playlist.length === 0) {
            playlistContent.innerHTML = 
                '<div class="playlist-empty">' +
                    '<i class="material-icons">queue_music</i>' +
                    '<p>播放列表为空</p>' +
                    '<button onclick="window.close()" class="btn btn-secondary">返回首页</button>' +
                '</div>';
            return;
        }
        
        playlistContent.innerHTML = this.playlist.map((video, index) => 
            '<div class="playlist-item ' + (index === this.currentIndex ? 'active' : '') + '"' +
                 ' data-index="' + index + '"' + 
                 ' data-title="' + video.title + '">' +
                '<div class="item-info">' +
                    '<div class="item-title">' + this.escapeHtml(video.title) + '</div>' +
                    '<div class="item-type">' + this.detectVideoPlatform(video.url).toUpperCase() + '</div>' +
                '</div>' +
                '<div class="item-actions">' +
                    '<button class="item-btn" onclick="videoPlayer.playVideo(' + index + ')" title="播放">' +
                        '<i class="material-icons">play_arrow</i>' +
                    '</button>' +
                    '<button class="item-btn" onclick="videoPlayer.removeFromPlaylist(' + index + ')" title="移除">' +
                        '<i class="material-icons">close</i>' +
                    '</button>' +
                '</div>' +
            '</div>'
        ).join('');
        
        if (playlistStats) {
            playlistStats.textContent = (this.currentIndex + 1) + '/' + this.playlist.length;
        }
    }

    // 播放指定视频
    playVideo(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentIndex = index;
            this.switchVideo();
        }
    }

    // 从播放列表中移除视频
    removeFromPlaylist(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.playlist.splice(index, 1);
            
            if (index < this.currentIndex) {
                this.currentIndex--;
            } else if (index === this.currentIndex) {
                if (this.currentIndex >= this.playlist.length) {
                    this.currentIndex = 0;
                }
                this.switchVideo();
            }
            
            this.renderPlaylist();
            this.updateVideoInfo();
        }
    }

    // 更新进度条（仅对直接视频有效）
    updateProgress() {
        if (this.currentPlayerType !== 'artplayer') return;

        const progress = document.getElementById('progress');
        const currentTimeEl = document.getElementById('currentTime');
        const durationEl = document.getElementById('duration');

        if (progress && this.duration > 0) {
            const percentage = (this.currentTime / this.duration) * 100;
            progress.style.width = percentage + '%';
        }

        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.currentTime);
        }

        if (durationEl) {
            durationEl.textContent = this.formatTime(this.duration);
        }

        if (this.enableProgressInTitle) {
            document.title = this.formatTime(this.currentTime) + ' - ' + (this.playlist[this.currentIndex] ? this.playlist[this.currentIndex].title : '') + ' - 青云播';
        }
    }

    // 更新音量UI（仅对直接视频有效）
    updateVolumeUI() {
        if (this.currentPlayerType !== 'artplayer') return;

        const volumeBtn = document.getElementById('volumeBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        
        if (volumeBtn) {
            const icon = volumeBtn.querySelector('i');
            if (icon) {
                if (this.isMuted || this.volume === 0) {
                    icon.textContent = 'volume_off';
                } else if (this.volume < 0.5) {
                    icon.textContent = 'volume_down';
                } else {
                    icon.textContent = 'volume_up';
                }
            }
        }
        
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
        }
    }

    // 更新播放按钮（仅对直接视频有效）
    updatePlayButton() {
        if (this.currentPlayerType !== 'artplayer') return;

        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            if (icon) {
                icon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
            }
        }
    }

    // 显示/隐藏加载信息
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
        const errorMessage = errorOverlay ? errorOverlay.querySelector('.error-message') : null;
        
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
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);

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

    // 切换设置面板显示/隐藏
    toggleSettings() {
        const modal = document.getElementById('playerSettingsModal');
        if (modal) {
            const isVisible = modal.style.display === 'block';
            modal.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                this.loadSettings();
            }
        }
    }

    // 加载设置
    loadSettings() {
        const settings = this.getSettings();
        
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
        
        this.bindSettingsEvents();
    }

    // 绑定设置项事件
    bindSettingsEvents() {
        const settingInputs = document.querySelectorAll('#playerSettingsModal input, #playerSettingsModal select');
        settingInputs.forEach(input => {
            input.addEventListener('change', () => this.saveSettings());
        });
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
            return saved ? Object.assign(defaultSettings, JSON.parse(saved)) : defaultSettings;
        } catch (error) {
            console.error('获取设置失败:', error);
            return defaultSettings;
        }
    }

    // 保存设置
    saveSettings() {
        try {
            const settings = {
                autoplayNext: document.getElementById('autoplayNext') ? document.getElementById('autoplayNext').checked : false,
                rememberVolume: document.getElementById('rememberVolume') ? document.getElementById('rememberVolume').checked : false,
                showNotifications: document.getElementById('showNotifications') ? document.getElementById('showNotifications').checked : false,
                showProgressOnTitle: document.getElementById('showProgressOnTitle') ? document.getElementById('showProgressOnTitle').checked : false,
                defaultQuality: document.getElementById('defaultQuality') ? document.getElementById('defaultQuality').value : 'auto'
            };
            
            localStorage.setItem('playerSettings', JSON.stringify(settings));
            this.showToast('设置已保存');
            
            this.applySettings(settings);
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showToast('保存设置失败', 'error');
        }
    }

    // 应用设置
    applySettings(settings) {
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
        
        if (settings.showProgressOnTitle) {
            this.enableProgressInTitle = true;
        } else {
            this.enableProgressInTitle = false;
            document.title = '青云播 - 视频播放器';
        }
        
        this.currentSettings = settings;
    }

    // ==================== 播放进度记忆功能 ====================
    
    /**
     * 生成视频唯一标识
     * @param {Object} video - 视频对象
     * @returns {string} 视频唯一ID
     */
    getVideoId(video) {
        return `progress_${btoa(video.url).substring(0, 32)}`;
    }

    /**
     * 保存播放进度
     * 只在进度超过 5 秒且未播放完成时保存
     */
    saveProgress() {
        if (this.currentPlayerType !== 'artplayer' || !this.player) return;
        
        const currentVideo = this.playlist[this.currentIndex];
        if (!currentVideo) return;
        
        const videoId = this.getVideoId(currentVideo);
        const progress = {
            time: this.player.currentTime,
            duration: this.player.duration,
            savedAt: Date.now()
        };
        
        // 只在进度超过 5 秒且未播放完成时保存
        if (progress.time > 5 && progress.time < progress.duration - 5) {
            localStorage.setItem(videoId, JSON.stringify(progress));
        }
    }

    /**
     * 恢复播放进度
     * 检查是否为 24 小时内的进度
     */
    restoreProgress() {
        if (this.currentPlayerType !== 'artplayer' || !this.player) return;
        
        const currentVideo = this.playlist[this.currentIndex];
        if (!currentVideo) return;
        
        const videoId = this.getVideoId(currentVideo);
        const savedProgress = localStorage.getItem(videoId);
        
        if (savedProgress) {
            try {
                const progress = JSON.parse(savedProgress);
                // 检查是否为 24 小时内的进度
                if (Date.now() - progress.savedAt < 24 * 60 * 60 * 1000) {
                    this.player.currentTime = progress.time;
                    this.showToast(`已恢复到 ${this.formatTime(progress.time)}`, 'info');
                }
            } catch (e) {
                console.warn('恢复进度失败:', e);
            }
        }
    }

    /**
     * 清除播放进度
     */
    clearProgress() {
        const currentVideo = this.playlist[this.currentIndex];
        if (!currentVideo) return;
        
        const videoId = this.getVideoId(currentVideo);
        localStorage.removeItem(videoId);
    }

    // ==================== 错误处理增强 ====================
    
    /**
     * 带重试机制的播放器初始化
     * @param {number} maxRetries - 最大重试次数
     */
    async initPlayerWithRetry(maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                await this.initPlayer();
                return; // 成功则退出
            } catch (error) {
                console.warn(`播放器初始化失败，第 ${i + 1} 次重试...`, error);
                
                if (i === maxRetries - 1) {
                    this.handleFatalError(error);
                    throw error;
                }
                
                // 指数退避等待
                await this.delay(1000 * Math.pow(2, i));
            }
        }
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 处理严重错误
     * @param {Error} error - 错误对象
     */
    handleFatalError(error) {
        let message = '播放器初始化失败';
        
        if (!navigator.onLine) {
            message = '网络已断开，请检查网络连接后重试';
        } else if (error.message.includes('CORS')) {
            message = '视频源不支持跨域访问，请更换视频链接';
        } else if (error.message.includes('404')) {
            message = '视频不存在，请检查链接是否正确';
        } else if (error.message.includes('403')) {
            message = '视频访问被拒绝，可能需要登录或权限';
        }
        
        this.showErrorMessage(message);
    }

    /**
     * 初始化网络状态监听
     */
    initNetworkListener() {
        window.addEventListener('online', () => {
            this.showToast('网络已恢复', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.showToast('网络已断开', 'warning');
            if (this.player) {
                this.player.pause();
            }
        });
    }

    // ==================== 性能优化 ====================
    
    /**
     * 动态加载 HLS.js
     * @returns {Promise} HLS类
     */
    async loadHlsJs() {
        if (window.Hls) return window.Hls;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
            script.onload = () => resolve(window.Hls);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 动态加载 FLV.js
     * @returns {Promise} flvjs对象
     */
    async loadFlvJs() {
        if (window.flvjs) return window.flvjs;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/flv.js@1/dist/flv.min.js';
            script.onload = () => resolve(window.flvjs);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 预加载下一个视频的元数据
     */
    preloadNextVideo() {
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        
        if (nextVideo && this.isDirectVideoUrl(nextVideo.url)) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'video';
            link.href = nextVideo.url;
            document.head.appendChild(link);
        }
    }

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间
     * @returns {Function}
     */
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * 节流函数
     * @param {Function} func - 要节流的函数
     * @param {number} limit - 时间限制
     * @returns {Function}
     */
    throttle(func, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==================== 用户体验优化 ====================
    
    /**
     * 调整音量
     * @param {number} delta - 音量变化量 (-1 到 1)
     */
    adjustVolume(delta) {
        if (this.currentPlayerType !== 'artplayer' || !this.player) return;
        
        const newVolume = Math.max(0, Math.min(1, this.player.volume + delta));
        this.player.volume = newVolume;
        this.showToast(`音量: ${Math.round(newVolume * 100)}%`, 'info');
    }

    /**
     * 跳转到百分比位置
     * @param {number} percent - 百分比 (0-1)
     */
    seekToPercent(percent) {
        if (this.currentPlayerType !== 'artplayer' || !this.player) return;
        
        const targetTime = this.player.duration * percent;
        this.player.currentTime = targetTime;
    }

    /**
     * 保存播放速度偏好
     * @param {number} rate - 播放速度
     */
    savePlaybackRate(rate) {
        localStorage.setItem('preferredPlaybackRate', rate.toString());
    }

    /**
     * 恢复播放速度偏好
     */
    restorePlaybackRate() {
        const savedRate = localStorage.getItem('preferredPlaybackRate');
        if (savedRate && this.player) {
            this.player.playbackRate = parseFloat(savedRate);
        }
    }

    /**
     * 验证视频URL安全性
     * @param {string} url - 视频URL
     * @returns {Object} 验证结果
     */
    isValidVideoUrl(url) {
        try {
            const parsed = new URL(url);
            
            // 只允许 http/https/rtmp 协议
            const allowedProtocols = ['http:', 'https:', 'rtmp:'];
            if (!allowedProtocols.includes(parsed.protocol)) {
                return { valid: false, reason: '不支持的协议' };
            }
            
            // 检查是否为 javascript: 协议（XSS 防护）
            if (url.toLowerCase().includes('javascript:')) {
                return { valid: false, reason: '不安全的链接' };
            }
            
            return { valid: true };
        } catch {
            return { valid: false, reason: '无效的链接格式' };
        }
    }

    // 销毁播放器
    destroy() {
        this.cleanupCurrentPlayer();
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
