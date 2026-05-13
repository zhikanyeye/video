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
    try {
      await this.core.init(video, container, {
        onPlay: () => this._updateUI(),
        onPause: () => this._updateUI(),
        onTimeUpdate: (time, dur) => {
          this._updateTimeDisplay(time, dur);
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
    document.getElementById('backToListBtn')?.addEventListener('click', () => this._goBack());
    document.getElementById('autoplayNextSetting')?.addEventListener('change', (e) => this._updateSetting('autoplayNext', e.target.checked));
    document.getElementById('progressTitleSetting')?.addEventListener('change', (e) => this._updateSetting('showProgressOnTitle', e.target.checked));

    const settingsModal = document.getElementById('playerSettingsModal');
    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) this._toggleSettings();
    });

    this._renderSettings();
  }

  _goBack() {
    this.core.cleanup();
    window.close();
    // 如果 window.close() 不生效（非脚本打开的窗口），跳回主页
    setTimeout(() => (window.location.href = 'index.html'), 300);
  }

  async _retryPlay() {
    this.core.cleanup();
    await this._playCurrent();
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

  _updateTimeDisplay(time, duration) {
    const el = document.getElementById('timeDisplay');
    if (el) el.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
  }

  _updatePlaylistSidebar() {
    const el = document.getElementById('playlistItems');
    if (!el) return;
    el.innerHTML = this.playlist.list
      .map(
        (v, i) => `
      <div class="playlist-item ${i === this.playlist.index ? 'active' : ''}" data-index="${i}">
        <span class="playlist-item-index">${i + 1}</span>
        <span class="playlist-item-title">${escapeHtml(v.title)}</span>
      </div>`
      )
      .join('');

    if (this._playlistClickBound) return;
    this._playlistClickBound = true;
    el.addEventListener('click', (e) => {
      const item = e.target.closest('[data-index]');
      if (!item) return;
      this.playlist.jumpTo(parseInt(item.dataset.index));
      this._playCurrent();
      if (window.matchMedia('(max-width: 720px)').matches) this._togglePlaylist();
    });
  }

  _renderSettings() {
    const autoplay = document.getElementById('autoplayNextSetting');
    const progressTitle = document.getElementById('progressTitleSetting');
    if (autoplay) autoplay.checked = !!this.settings.autoplayNext;
    if (progressTitle) progressTitle.checked = !!this.settings.showProgressOnTitle;
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
