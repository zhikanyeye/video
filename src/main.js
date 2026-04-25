/**
 * 主页面 — 视频管理和播放列表
 */
import * as store from './store/index.js';
import { escapeHtml, isValidVideoUrl, detectVideoType } from './utils/index.js';
import { showToast } from './components/toast.js';
import { showModal, hideModal, initModalListeners } from './components/modal.js';
import { GitHubManager } from './components/github-manager.js';

const github = new GitHubManager();

class VideoManager {
  constructor() {
    this.videos = store.getVideoList();
    this.bindEvents();
    this.renderVideoList();
    this.updateUI();
    this.initGitHubUI();
  }

  // ---- 事件绑定 ----

  bindEvents() {
    initModalListeners();

    document.getElementById('addVideoForm')?.addEventListener('submit', (e) => this.handleAddVideo(e));
    document.getElementById('clearAllBtn')?.addEventListener('click', () => this.handleClearAll());
    document.getElementById('playAllBtn')?.addEventListener('click', () => this.handlePlayAll());
    document.getElementById('exportBtn')?.addEventListener('click', () => this.handleExport());
    document.getElementById('shareBtn')?.addEventListener('click', () => this.handleShare());
    document.getElementById('importBtn')?.addEventListener('click', () => this.showImportModal());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('clearBulkTextBtn')?.addEventListener('click', () => this.clearBulkText());
    document.getElementById('bulkAddBtn')?.addEventListener('click', () => this.handleBulkAdd());

    // 导入模态框
    document.getElementById('importModalClose')?.addEventListener('click', () => this.hideImportModal());
    document.getElementById('importCancel')?.addEventListener('click', () => this.hideImportModal());
    document.getElementById('importConfirm')?.addEventListener('click', () => this.handleImport());
    document.getElementById('importModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'importModal') this.hideImportModal();
    });
  }

  // ---- 视频操作 ----

  handleAddVideo(e) {
    e.preventDefault();
    const titleEl = document.getElementById('videoTitle');
    const urlEl = document.getElementById('videoUrl');
    const typeEl = document.getElementById('videoType');

    const title = titleEl.value.trim();
    const url = urlEl.value.trim();
    if (!title || !url) return showToast('请填写完整的视频信息', 'error');

    const validation = isValidVideoUrl(url);
    if (!validation.valid) return showToast(`链接验证失败: ${validation.reason}`, 'error');

    const type = typeEl.value === 'auto' ? detectVideoType(url) : typeEl.value;
    this.videos.push({ id: Date.now(), title, url, type, addedAt: new Date().toISOString() });
    this._save();
    titleEl.value = '';
    urlEl.value = '';
    typeEl.value = 'auto';
    showToast('视频添加成功', 'success');
    this.autoSyncToGitHub();
  }

  deleteVideo(id) {
    showModal('确认删除', '确定要删除这个视频吗？此操作无法恢复。', () => {
      this.videos = this.videos.filter((v) => v.id !== id);
      this._save();
      showToast('视频删除成功', 'success');
      this.autoSyncToGitHub();
    });
  }

  playVideo(id) {
    const video = this.videos.find((v) => v.id === id);
    if (video) this.openPlayer([video], 0);
  }

  handleClearAll() {
    if (this.videos.length === 0) return showToast('播放列表已经是空的', 'warning');
    showModal('确认清空', `确定要清空所有 ${this.videos.length} 个视频吗？`, () => {
      this.videos = [];
      this._save();
      showToast('播放列表已清空', 'success');
      this.autoSyncToGitHub();
    });
  }

  handlePlayAll() {
    if (this.videos.length === 0) return showToast('播放列表为空，请先添加视频', 'warning');
    this.openPlayer(this.videos, 0);
  }

  handleExport() {
    if (this.videos.length === 0) return showToast('播放列表为空，无法导出', 'warning');
    const data = { name: '青云播播放列表', version: '2.0', exportTime: new Date().toISOString(), videos: this.videos };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `playlist-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('播放列表导出成功', 'success');
  }

  handleBulkAdd() {
    const textEl = document.getElementById('bulkText');
    const lines = textEl.value.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return showToast('请输入视频链接', 'warning');

    let added = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const url = parts[0];
      const title = parts.slice(1).join(' ') || `视频 ${this.videos.length + 1}`;
      const validation = isValidVideoUrl(url);
      if (validation.valid) {
        this.videos.push({ id: Date.now() + added, title, url, type: detectVideoType(url), addedAt: new Date().toISOString() });
        added++;
      }
    }
    this._save();
    textEl.value = '';
    showToast(`成功添加 ${added} 个视频`, 'success');
  }

  clearBulkText() {
    const el = document.getElementById('bulkText');
    if (el) el.value = '';
  }

  openPlayer(playlist, startIndex = 0) {
    store.setCurrentPlaylist(playlist);
    store.setCurrentIndex(startIndex);
    window.open('player.html', '_blank');
  }

  // ---- GitHub ----

  async autoSyncToGitHub() {
    if (!github.isAuthenticated()) return;
    try {
      const gistId = store.getPlaylistGistId();
      if (gistId) {
        await github.updateGist(gistId, { title: '青云播播放列表', description: '', videos: this.videos });
      } else {
        const result = await github.sharePlaylist(this.videos);
        if (result) store.setPlaylistGistId(result.gist_id);
      }
    } catch (e) {
      console.warn('GitHub同步失败:', e);
    }
  }

  async handleShare() {
    if (!github.isAuthenticated()) {
      github.showAuthGuide();
      return;
    }
    await this.autoSyncToGitHub();
    const gistId = store.getPlaylistGistId();
    if (!gistId) return showToast('同步失败，无法生成分享链接', 'error');
    const shareUrl = github.getPlayerUrl(gistId);
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(`分享链接已复制到剪贴板！\n${shareUrl}`, 'success');
    } catch {
      showToast(`分享链接: ${shareUrl}`, 'success');
    }
  }

  showImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.style.display = 'block';
    const input = document.getElementById('gistUrl');
    if (input) { input.value = ''; input.focus(); }
  }

  hideImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.style.display = 'none';
  }

  async handleImport() {
    const input = document.getElementById('gistUrl');
    const url = input?.value.trim();
    if (!url) return showToast('请输入Gist URL或ID', 'warning');

    this.hideImportModal();
    showToast('正在从GitHub导入...', 'info');

    try {
      const result = await github.importFromGist(url);
      if (result.success && result.videos) {
        if (this.videos.length > 0) {
          const replace = confirm('是否替换当前播放列表？点击"确定"替换，点击"取消"追加。');
          this.videos = replace ? result.videos : [...this.videos, ...result.videos];
        } else {
          this.videos = result.videos;
        }
        this._save();
        showToast(`成功导入 ${result.videos.length} 个视频`, 'success');
      }
    } catch (e) {
      showToast(`导入失败: ${e.message}`, 'error');
    }
  }

  handleLogout() {
    github.logout();
    this.initGitHubUI();
    showToast('已退出GitHub登录', 'info');
  }

  initGitHubUI() {
    const userInfo = document.getElementById('githubUserInfo');
    const username = document.getElementById('githubUsername');
    if (!userInfo || !username) return;

    if (github.isAuthenticated()) {
      const user = github.getUser();
      username.textContent = `👋 ${user?.name || user?.login || ''}`;
      userInfo.classList.remove('hidden');
      userInfo.style.display = 'flex';
      userInfo.style.cursor = 'default';
      userInfo.onclick = null;
    } else {
      username.textContent = '🔐 点击授权';
      userInfo.classList.remove('hidden');
      userInfo.style.display = 'flex';
      userInfo.style.cursor = 'pointer';
      userInfo.onclick = () => github.showAuthGuide();
      document.getElementById('logoutBtn')?.style && (document.getElementById('logoutBtn').style.display = 'none');
    }
  }

  // ---- 渲染 ----

  renderVideoList() {
    const list = document.getElementById('videoList');
    const empty = document.getElementById('emptyState');
    if (!list || !empty) return;

    if (this.videos.length === 0) {
      empty.style.display = 'flex';
      list.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    list.style.display = 'block';
    list.innerHTML = this.videos
      .map(
        (v, i) => `
      <div class="video-item">
        <div class="video-index">${i + 1}</div>
        <div class="video-info">
          <div class="video-title">${escapeHtml(v.title)}</div>
          <div class="video-meta">
            <span class="video-url">${escapeHtml(v.url)}</span>
            <span class="video-type">${v.type}</span>
          </div>
        </div>
        <div class="video-actions">
          <button class="action-btn play-btn" data-action="play" data-id="${v.id}" title="播放">
            <i class="material-icons">play_arrow</i>
          </button>
          <button class="action-btn delete-btn" data-action="delete" data-id="${v.id}" title="删除">
            <i class="material-icons">delete</i>
          </button>
        </div>
      </div>`
      )
      .join('');

    // 事件委托
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'play') this.playVideo(id);
      if (btn.dataset.action === 'delete') this.deleteVideo(id);
    });
  }

  updateUI() {
    const count = document.getElementById('videoCount');
    if (count) count.textContent = this.videos.length;
    const has = this.videos.length > 0;
    document.getElementById('playAllBtn')?.toggleAttribute('disabled', !has);
    document.getElementById('exportBtn')?.toggleAttribute('disabled', !has);
    document.getElementById('clearAllBtn')?.toggleAttribute('disabled', !has);
  }

  _save() {
    store.saveVideoList(this.videos);
    this.renderVideoList();
    this.updateUI();
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  window.videoManager = new VideoManager();
});
window.addEventListener('beforeunload', () => window.videoManager?._save());
