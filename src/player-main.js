/**
 * 播放器页面 — 组合 core / playlist / keyboard 模块
 */
import * as store from './store/index.js';
import { formatTime, escapeHtml } from './utils/index.js';
import { PlayerCore } from './player/core.js';
import { PlaylistManager } from './player/playlist.js';
import { KeyboardHandler } from './player/keyboard.js';
import { GitHubManager } from './components/github-manager.js';
import { showToast } from './components/toast.js';

const github = new GitHubManager();

class VideoPlayer {
  constructor() {
    this.core = new PlayerCore();
    this.playlist = new PlaylistManager(() => this.onPlaylistChange());
    this.keyboard = new KeyboardHandler(this);
    this.settings = store.getPlayerSettings();
    this._playlistClickBound = false;
    this._init();
  }

  async _init() {
    try {
      await this._loadPlaylist();
      this._bindUIEvents();
      this._initNetworkListener();
      await this._playCurrent();
      this._updateUI();
    } catch (err) {
      console.error('播放器初始化失败:', err);
      this._showError('播放器初始化失败: ' + err.message);
    }
  }

  // ---- 播放列表加载 ----

  async _loadPlaylist() {
    const params = new URLSearchParams(window.location.search);
    const gistId = params.get('gist');

    if (gistId) {
      try {
        showToast('正在从GitHub加载播放列表...', 'info');
        const result = await github.importFromGist(gistId);
        if (result.success && result.videos?.length > 0) {
          this.playlist.load(result.videos, 0);
          showToast(`成功加载 ${result.videos.length} 个视频`, 'success');
          return;
        }
      } catch (e) {
        showToast('GitHub加载失败: ' + e.message, 'error');
      }
    }

    const pl = store.getCurrentPlaylist();
    const idx = store.getCurrentIndex();
    if (pl.length > 0) {
      this.playlist.load(pl, idx);
    } else {
      this.playlist.load([
        { title: '测试视频 - Flower', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: 'mp4' },
      ], 0);
      showToast('使用测试视频，请从主页添加您的视频', 'warning');
    }
  }

  // ---- 播放控制 ----

  async _playCurrent() {
    const video = this.playlist.current;
    if (!video) return this._showError('没有可播放的视频');

    const container = document.querySelector('#videoPlayer');
    if (!container) return;

    this._hideError();
    this._showLoading(true);
    this._updateResolution({ type: 'loading' });
    this._historyRecorded = false; // 重置历史记录标记
    try {
      await this.core.init(video, container, {
        onPlay: () => {
          this._updateUI();
          // 首次播放时记录到历史
          if (!this._historyRecorded) {
            store.addToHistory(video);
            this._historyRecorded = true;
          }
        },
        onPause: () => this._updateUI(),
        onVideoMeta: (meta) => this._updateResolution(meta),
        onPlaybackWarning: (message) => this._showPlaybackNotice(message),
        onTimeUpdate: (time, dur) => {
          if (this.settings.showProgressOnTitle) {
            document.title = `${formatTime(time)} / ${formatTime(dur)} - ${video.title}`;
          }
        },
        onEnded: () => this._onVideoEnded(),
        onError: (err) => this._showError(err.message),
      });
      this._showLoading(false);
      this._updateVideoInfo();
    } catch (err) {
      this._showError('播放失败: ' + err.message);
    }
  }

  async _onVideoEnded() {
    if (!this.settings.autoplayNext) {
      showToast('当前视频已播放完成', 'info');
      return;
    }
    const next = this.playlist.next();
    if (next) {
      await this._playCurrent();
    } else {
      showToast('播放列表已播完', 'info');
    }
  }

  async playNext() {
    if (this.playlist.next()) await this._playCurrent();
  }

  async playPrevious() {
    if (this.playlist.previous()) await this._playCurrent();
  }

  // ---- UI 事件 ----

  _bindUIEvents() {
    document.getElementById('backBtn')?.addEventListener('click', () => this._goBack());
    document.getElementById('playlistBtn')?.addEventListener('click', () => this._togglePlaylist());
    document.getElementById('playerSettingsBtn')?.addEventListener('click', () => this._toggleSettings());
    document.getElementById('closePlayerSettingsModal')?.addEventListener('click', () => this._toggleSettings());
    document.getElementById('closeSidebar')?.addEventListener('click', () => this._togglePlaylist());
    document.getElementById('playerRetryBtn')?.addEventListener('click', () => this._retryPlay());
    document.getElementById('openSourceBtn')?.addEventListener('click', () => this._openCurrentSource());
    document.getElementById('backToListBtn')?.addEventListener('click', () => this._goBack());
    document.getElementById('autoplayNextSetting')?.addEventListener('change', (e) => this._updateSetting('autoplayNext', e.target.checked));
    document.getElementById('progressTitleSetting')?.addEventListener('change', (e) => this._updateSetting('showProgressOnTitle', e.target.checked));
    document.getElementById('hlsProxySetting')?.addEventListener('change', (e) => {
      this._updateSetting('useHlsProxy', e.target.checked);
      const parsed = this.core.parsedVideo;
      if (parsed && parsed.type === 'm3u8') {
        showToast('已切换 HLS 代理设置，重新加载当前视频...', 'info');
        this._retryPlay();
      }
    });

    const settingsModal = document.getElementById('playerSettingsModal');
    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) this._toggleSettings();
    });

    this._renderSettings();
  }

  _goBack() {
    this.core.cleanup();
    if (window.opener) {
      window.close();
    } else {
      window.location.href = 'index.html';
    }
  }

  async _retryPlay() {
    this.core.cleanup();
    await this._playCurrent();
  }

  _openCurrentSource() {
    const url = this.core.parsedVideo?.url || this.playlist.current?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  _togglePlaylist() {
    document.getElementById('playlistSidebar')?.classList.toggle('show');
  }

  _toggleSettings() {
    document.getElementById('playerSettingsModal')?.classList.toggle('show');
  }

  // ---- UI 更新 ----

  _updateUI() {
    this._updateVideoInfo();
    this._updatePlaylistSidebar();
  }

  _updateVideoInfo() {
    const video = this.playlist.current;
    if (!video) return;
    const titleEl = document.getElementById('currentVideoTitle');
    const metaEl = document.getElementById('currentVideoMeta');
    const counterEl = document.getElementById('playlistCounter');
    if (titleEl) titleEl.textContent = video.title;
    if (metaEl) metaEl.textContent = `${video.type?.toUpperCase() || 'VIDEO'}`;
    if (counterEl) counterEl.textContent = `${this.playlist.index + 1} / ${this.playlist.length}`;
  }

  _updateResolution(meta) {
    const el = document.getElementById('videoResolution');
    if (!el) return;
    if (meta?.width > 0 && meta?.height > 0) {
      el.textContent = `${meta.width} x ${meta.height}`;
    } else {
      el.textContent = meta?.type === 'iframe' ? '分辨率未知' : '分辨率检测中';
    }
  }

  _updatePlaylistSidebar() {
    const el = document.getElementById('playlistItems');
    if (!el) return;

    // 首次渲染或列表内容变化时全量重建
    if (el.children.length !== this.playlist.length) {
      el.innerHTML = this.playlist.list
        .map(
          (v, i) => `
        <div class="playlist-item${i === this.playlist.index ? ' active' : ''}" data-index="${i}">
          <span class="playlist-item-index">${i + 1}</span>
          <span class="playlist-item-title">${escapeHtml(v.title)}</span>
        </div>`
        )
        .join('');

      if (!this._playlistClickBound) {
        this._playlistClickBound = true;
        el.addEventListener('click', (e) => {
          const item = e.target.closest('[data-index]');
          if (!item) return;
          this.playlist.jumpTo(parseInt(item.dataset.index));
          this._playCurrent();
          if (window.matchMedia('(max-width: 720px)').matches) this._togglePlaylist();
        });
      }
    } else {
      // 只更新 active 类，保留滚动位置
      const prev = el.querySelector('.playlist-item.active');
      if (prev) prev.classList.remove('active');
      const next = el.querySelector(`[data-index="${this.playlist.index}"]`);
      if (next) next.classList.add('active');
    }

    // 确保当前项可见
    const active = el.querySelector('.playlist-item.active');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  _renderSettings() {
    const autoplay = document.getElementById('autoplayNextSetting');
    const progressTitle = document.getElementById('progressTitleSetting');
    const hlsProxy = document.getElementById('hlsProxySetting');
    if (autoplay) autoplay.checked = !!this.settings.autoplayNext;
    if (progressTitle) progressTitle.checked = !!this.settings.showProgressOnTitle;
    if (hlsProxy) hlsProxy.checked = !!this.settings.useHlsProxy;
  }

  _updateSetting(key, value) {
    this.settings = { ...this.settings, [key]: value };
    store.savePlayerSettings(this.settings);
  }

  onPlaylistChange() {
    this._updatePlaylistSidebar();
    this._updateVideoInfo();
  }

  _showLoading(show) {
    const el = document.getElementById('playerLoading');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  _showError(message) {
    this._showLoading(false);
    const el = document.getElementById('playerError');
    const msg = document.getElementById('playerErrorMessage');
    if (el && msg) {
      msg.textContent = message;
      el.style.display = 'flex';
    }
  }

  _hideError() {
    const el = document.getElementById('playerError');
    if (el) el.style.display = 'none';
  }

  _showPlaybackNotice(message) {
    if (!message) return;
    console.warn('播放兼容性提示:', message);
    const normalized = message.toLowerCase();
    if (normalized.includes('没有解码出视频画面') || normalized.includes('编码不受浏览器支持')) {
      this._showError(`${message} 这个文件下载后本地播放器能播放，通常是因为本地播放器支持 HEVC/H.265 等编码，而当前浏览器不支持。`);
      return;
    }
    showToast(message, 'warning', 6000);
  }

  showToast(message, type = 'info') {
    showToast(message, type);
  }

  _initNetworkListener() {
    window.addEventListener('online', () => showToast('网络已恢复', 'success'));
    window.addEventListener('offline', () => {
      showToast('网络已断开', 'warning');
      this.core.pause();
    });
  }

  destroy() {
    this.keyboard.destroy();
    this.core.cleanup();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.videoPlayer = new VideoPlayer();
});
window.addEventListener('beforeunload', () => window.videoPlayer?.destroy());
