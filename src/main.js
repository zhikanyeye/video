/**
 * 主页面 — 视频管理和播放列表
 */
import * as store from './store/index.js';
import { escapeHtml, isValidVideoUrl, detectVideoType } from './utils/index.js';
import { showToast } from './components/toast.js';
import { showModal, initModalListeners } from './components/modal.js';
import { GitHubManager } from './components/github-manager.js';

const github = new GitHubManager();

class VideoManager {
  constructor() {
    this.videos = store.getVideoList();
    this._videoListBound = false;
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
    document.getElementById('probeCurrentBtn')?.addEventListener('click', () => this.handleProbeCurrent());

    // 导入模态框
    document.getElementById('importModalClose')?.addEventListener('click', () => this.hideImportModal());
    document.getElementById('importCancel')?.addEventListener('click', () => this.hideImportModal());
    document.getElementById('importConfirm')?.addEventListener('click', () => this.handleImport());
    document.getElementById('importModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'importModal') this.hideImportModal();
    });

    document.getElementById('shareModalClose')?.addEventListener('click', () => this.hideShareModal());
    document.getElementById('shareModalDone')?.addEventListener('click', () => this.hideShareModal());
    document.getElementById('copyShareUrlBtn')?.addEventListener('click', () => this.copyShareUrlFromModal());
    document.getElementById('shareUrlInput')?.addEventListener('focus', (e) => e.target.select());
    document.getElementById('shareModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'shareModal') this.hideShareModal();
    });
    document.getElementById('probeModalClose')?.addEventListener('click', () => this.hideProbeModal());
    document.getElementById('probeModalDone')?.addEventListener('click', () => this.hideProbeModal());
    document.getElementById('probeResult')?.addEventListener('click', (e) => {
      if (e.target.closest('#saveApiBaseBtn')) this.saveApiBaseFromProbeModal();
    });
    document.getElementById('probeModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'probeModal') this.hideProbeModal();
    });

    window.addEventListener('github-auth-success', () => {
      this.initGitHubUI();
      showToast('GitHub授权成功，可以使用免费Gist同步和分享', 'success');
      this.syncToGitHubSilently();
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
    this.syncToGitHubSilently();
  }

  deleteVideo(id) {
    showModal('确认删除', '确定要删除这个视频吗？此操作无法恢复。', () => {
      this.videos = this.videos.filter((v) => v.id !== id);
      this._save();
      showToast('视频删除成功', 'success');
      this.syncToGitHubSilently();
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
      this.syncToGitHubSilently();
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
    if (added > 0) this.syncToGitHubSilently();
  }

  clearBulkText() {
    const el = document.getElementById('bulkText');
    if (el) el.value = '';
  }

  async handleProbeCurrent() {
    const input = document.getElementById('videoUrl');
    const url = input?.value.trim();
    if (!url) return showToast('请先输入视频链接', 'warning');
    await this.probeVideoSource(url);
  }

  async probeVideoSource(url) {
    const validation = isValidVideoUrl(url);
    if (!validation.valid) return showToast(`链接验证失败: ${validation.reason}`, 'error');

    if (!this.getApiBase()) {
      this.showProbeModal(this.renderApiConfigPrompt());
      return;
    }

    this.showProbeModal('<div class="probe-loading">正在检测播放源...</div>');
    try {
      const result = await this.fetchProbe(url);
      this.showProbeModal(this.renderProbeResult(result));
    } catch (e) {
      this.showProbeModal(`<div class="probe-error">检测失败：${escapeHtml(e.message)}</div>`);
    }
  }

  async fetchProbe(url) {
    const apiBase = this.getApiBase();
    if (!apiBase) throw new Error('后端 API 未配置，无法检测播放源');
    const resp = await fetch(`${apiBase}/api/probe?url=${encodeURIComponent(url)}`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `检测请求失败: ${resp.status}`);
    return data;
  }

  getApiBase() {
    const envBase = import.meta.env?.VITE_API_BASE?.trim();
    if (envBase) return envBase.replace(/\/+$/, '');
    const runtimeBase = window.APP_CONFIG?.API_BASE?.trim();
    if (runtimeBase && !runtimeBase.includes('your-backend')) return runtimeBase.replace(/\/+$/, '');
    const savedBase = localStorage.getItem('qingyunbo_api_base')?.trim();
    if (savedBase) return savedBase.replace(/\/+$/, '');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '';
  }

  renderApiConfigPrompt() {
    return `
      <div class="probe-error">检测失败：前端没有配置后端 API 地址。</div>
      <div class="probe-section">
        <h4>填写 Render 后端地址</h4>
        <div class="api-base-form">
          <input id="apiBaseInput" type="url" placeholder="https://你的后端.onrender.com" value="${escapeHtml(localStorage.getItem('qingyunbo_api_base') || '')}">
          <button id="saveApiBaseBtn" class="btn btn-primary" type="button">保存</button>
        </div>
        <p class="probe-help">这会保存到当前浏览器。正式修复还需要在 GitHub 仓库的 Actions Secret 里配置 VITE_API_BASE，然后重新触发 Pages 构建。</p>
      </div>
    `;
  }

  saveApiBaseFromProbeModal() {
    const input = document.getElementById('apiBaseInput');
    const value = input?.value.trim().replace(/\/+$/, '');
    if (!value) return showToast('请填写后端 API 地址', 'warning');
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
      localStorage.setItem('qingyunbo_api_base', value);
      showToast('后端 API 地址已保存，请重新点击检测源', 'success');
      this.hideProbeModal();
    } catch {
      showToast('后端 API 地址格式不正确', 'error');
    }
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
        try {
          await github.updateGist(gistId, { title: '青云播播放列表', description: '', videos: this.videos });
        } catch (error) {
          if (!this._isExpiredGistError(error)) throw error;
          store.removePlaylistGistId();
          showToast('原分享链接已失效，正在重新生成...', 'warning');
          const result = await github.sharePlaylist(this.videos);
          if (result) store.setPlaylistGistId(result.gist_id);
        }
      } else {
        const result = await github.sharePlaylist(this.videos);
        if (result) store.setPlaylistGistId(result.gist_id);
      }
      return true;
    } catch (e) {
      console.warn('GitHub同步失败:', e);
      throw e;
    }
  }

  syncToGitHubSilently() {
    this.autoSyncToGitHub().catch((e) => {
      showToast(`GitHub自动同步失败: ${e.message}`, 'warning');
    });
  }

  _isExpiredGistError(error) {
    const message = (error?.message || '').toLowerCase();
    return error?.status === 404 || error?.status === 410 || message.includes('not found');
  }

  async handleShare() {
    if (!github.isAuthenticated()) {
      github.showAuthGuide();
      return;
    }
    try {
      await this.autoSyncToGitHub();
    } catch (e) {
      showToast(`GitHub同步失败: ${e.message}`, 'error');
      return;
    }
    const gistId = store.getPlaylistGistId();
    if (!gistId) return showToast('同步失败，无法生成分享链接。请重新授权后再试。', 'error');
    const shareUrl = github.getPlayerUrl(gistId);
    this.showShareModal(shareUrl, '正在复制链接...');
    try {
      await navigator.clipboard.writeText(shareUrl);
      this.setShareCopyStatus('链接已复制到剪贴板', 'success');
      showToast('分享链接已复制到剪贴板', 'success');
    } catch {
      this.setShareCopyStatus('浏览器未允许自动复制，请手动复制链接', 'warning');
      showToast('已生成分享链接，请在弹窗中复制', 'warning');
    }
  }

  showShareModal(shareUrl, status = '') {
    const modal = document.getElementById('shareModal');
    const input = document.getElementById('shareUrlInput');
    if (!modal || !input) return;
    input.value = shareUrl;
    modal.classList.add('show');
    this.setShareCopyStatus(status, 'info');
    setTimeout(() => input.select(), 0);
  }

  hideShareModal() {
    document.getElementById('shareModal')?.classList.remove('show');
  }

  showProbeModal(html) {
    const modal = document.getElementById('probeModal');
    const result = document.getElementById('probeResult');
    if (!modal || !result) return;
    result.innerHTML = html;
    modal.classList.add('show');
  }

  hideProbeModal() {
    document.getElementById('probeModal')?.classList.remove('show');
  }

  renderProbeResult(result) {
    const headers = result.headers || {};
    const media = result.media || {};
    const diagnosis = result.diagnosis || {};
    const video = media.video;
    const audio = media.audio;
    const format = media.format || {};
    const warnings = diagnosis.warnings || [];
    const suggestions = diagnosis.suggestions || [];

    return `
      <div class="probe-summary ${diagnosis.playableHint === 'likely' ? 'ok' : 'warn'}">
        ${diagnosis.playableHint === 'likely' ? '未发现明显兼容性问题' : '发现可能影响网页播放的问题'}
      </div>
      <div class="probe-grid">
        ${this.renderProbeItem('HTTP 状态', headers.statusCode || '未知')}
        ${this.renderProbeItem('Content-Type', headers.contentType || '未知')}
        ${this.renderProbeItem('文件大小', this.formatBytes(headers.contentLength || format.size))}
        ${this.renderProbeItem('Range', headers.acceptRanges || headers.contentRange || '未声明')}
        ${this.renderProbeItem('容器', format.longName || format.name || '未知')}
        ${this.renderProbeItem('时长', this.formatDuration(format.duration))}
        ${this.renderProbeItem('视频编码', video ? `${video.codec}${video.profile ? ` / ${video.profile}` : ''}` : '未检测到')}
        ${this.renderProbeItem('分辨率', video?.width && video?.height ? `${video.width} x ${video.height}` : '未知')}
        ${this.renderProbeItem('像素格式', video?.pixelFormat || '未知')}
        ${this.renderProbeItem('音频编码', audio ? `${audio.codec}${audio.profile ? ` / ${audio.profile}` : ''}` : '未检测到')}
      </div>
      ${this.renderProbeList('风险提示', warnings)}
      ${this.renderProbeList('建议', suggestions)}
    `;
  }

  renderProbeItem(label, value) {
    return `<div class="probe-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? '未知'))}</strong></div>`;
  }

  renderProbeList(title, items) {
    if (!items?.length) return '';
    return `
      <div class="probe-section">
        <h4>${escapeHtml(title)}</h4>
        <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    `;
  }

  formatBytes(bytes) {
    if (!bytes) return '未知';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  formatDuration(seconds) {
    if (!seconds) return '未知';
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  async copyShareUrlFromModal() {
    const input = document.getElementById('shareUrlInput');
    const shareUrl = input?.value;
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      this.setShareCopyStatus('链接已复制到剪贴板', 'success');
      showToast('分享链接已复制到剪贴板', 'success');
    } catch {
      input.focus();
      input.select();
      this.setShareCopyStatus('自动复制失败，已选中链接，可按 Ctrl+C 复制', 'warning');
    }
  }

  setShareCopyStatus(message, type = 'info') {
    const el = document.getElementById('shareCopyStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `share-copy-status ${type}`;
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
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'flex';
    } else {
      username.textContent = '🔐 点击授权';
      userInfo.classList.remove('hidden');
      userInfo.style.display = 'flex';
      userInfo.style.cursor = 'pointer';
      userInfo.onclick = () => github.showAuthGuide();
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'none';
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
          <button class="action-btn probe-btn" data-action="probe" data-id="${v.id}" title="检测播放源">
            <i class="material-icons">manage_search</i>
          </button>
          <button class="action-btn delete-btn" data-action="delete" data-id="${v.id}" title="删除">
            <i class="material-icons">delete</i>
          </button>
        </div>
      </div>`
      )
      .join('');

    if (!this._videoListBound) {
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id);
        if (btn.dataset.action === 'play') this.playVideo(id);
        if (btn.dataset.action === 'probe') {
          const video = this.videos.find((item) => item.id === id);
          if (video) this.probeVideoSource(video.url);
        }
        if (btn.dataset.action === 'delete') this.deleteVideo(id);
      });
      this._videoListBound = true;
    }
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
