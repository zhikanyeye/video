/**
 * GitHub Gist 管理器
 */
import * as store from '../store/index.js';

const GIST_API = 'https://api.github.com/gists';
const GITHUB_API = 'https://api.github.com';

export class GitHubManager {
  // ---- 授权 ----

  isAuthenticated() {
    return !!store.getGitHubToken() && !!store.getGitHubUser();
  }

  getToken() {
    return store.getGitHubToken();
  }

  getUser() {
    return store.getGitHubUser();
  }

  async saveToken(token) {
    const resp = await fetch(`${GITHUB_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) throw new Error('Token验证失败，请检查Token是否正确');
    const user = await resp.json();
    store.setGitHubToken(token);
    store.setGitHubUser({ login: user.login, name: user.name, avatar_url: user.avatar_url });
    return user;
  }

  logout() {
    store.clearGitHubAuth();
  }

  showAuthGuide() {
    const existing = document.querySelector('.auth-modal');
    if (existing) {
      existing.querySelector('#githubToken')?.focus();
      return existing;
    }

    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'githubAuthTitle');
    modal.innerHTML = `
      <div class="auth-modal-content">
        <div class="auth-header">
          <h3 id="githubAuthTitle">GitHub Gist 授权</h3>
          <button type="button" class="auth-close" aria-label="关闭授权弹窗">&times;</button>
        </div>
        <div class="auth-body">
          <p>使用免费的 GitHub Gist 保存和分享播放列表，需要一个只包含 <strong>gist</strong> 权限的 Token。</p>
          <ol class="auth-steps">
            <li>点击下方按钮打开 GitHub Token 创建页</li>
            <li>确认只勾选 <strong>gist</strong> 权限</li>
            <li>复制生成的 Token，粘贴到这里保存</li>
          </ol>
          <div class="auth-actions">
            <a href="https://github.com/settings/tokens/new?description=%E9%9D%92%E4%BA%91%E6%92%AD%E8%A7%86%E9%A2%91%E5%88%86%E4%BA%AB&scopes=gist"
               target="_blank"
               rel="noopener noreferrer"
               class="auth-btn primary">
              创建 GitHub Token
            </a>
          </div>
          <div class="auth-input-group">
            <label for="githubToken">粘贴 GitHub Token</label>
            <input type="password" id="githubToken" autocomplete="off" placeholder="ghp_... 或 github_pat_..." />
            <button type="button" id="saveTokenBtn" class="auth-btn secondary">保存授权</button>
            <div id="authMessage" class="auth-message" aria-live="polite"></div>
          </div>
          <div class="auth-note">
            <small>Token 只保存在当前浏览器的 localStorage 中。后续会用它通过 GitHub Gist API 创建和更新播放列表。</small>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    const closeBtn = modal.querySelector('.auth-close');
    const saveBtn = modal.querySelector('#saveTokenBtn');
    const tokenInput = modal.querySelector('#githubToken');
    const message = modal.querySelector('#authMessage');

    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    saveBtn?.addEventListener('click', async () => {
      const token = tokenInput?.value.trim();
      if (!token) {
        message.textContent = '请先粘贴 GitHub Token';
        message.className = 'auth-message error';
        tokenInput?.focus();
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = '验证中...';
        message.textContent = '';
        message.className = 'auth-message';

        const user = await this.saveToken(token);
        close();
        window.dispatchEvent(new CustomEvent('github-auth-success', { detail: { user } }));
      } catch (error) {
        message.textContent = error.message || '授权失败，请检查 Token';
        message.className = 'auth-message error';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存授权';
      }
    });

    tokenInput?.focus();
    return modal;
  }

  // ---- Gist 操作 ----

  async sharePlaylist(videos, title = '青云播视频播放列表', description = '') {
    if (!this.isAuthenticated()) return null;

    const gistData = {
      description: description || `${title} - 共${videos.length}个视频`,
      public: true,
      files: {
        'playlist.json': {
          content: JSON.stringify(
            { title, description, created: new Date().toISOString(), videos, player_url: this.getPlayerUrl() },
            null,
            2
          ),
        },
      },
    };

    const resp = await fetch(GIST_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(gistData),
    });
    if (!resp.ok) throw await this._createApiError(resp, '分享失败');

    const gist = await resp.json();

    // 更新 Gist 添加 README
    await fetch(`${GIST_API}/${gist.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${this.getToken()}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: { 'README.md': { content: this._generateReadme(title, description, videos, gist.html_url, gist.id) } },
      }),
    });

    return {
      gist_id: gist.id,
      gist_url: gist.html_url,
      player_url: this.getPlayerUrl(gist.id),
    };
  }

  async updateGist(gistId, playlistData) {
    if (!this.isAuthenticated()) throw new Error('未授权');
    const resp = await fetch(`${GIST_API}/${gistId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${this.getToken()}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: {
          'playlist.json': {
            content: JSON.stringify(
              { title: playlistData.title, description: playlistData.description, updated: new Date().toISOString(), videos: playlistData.videos },
              null,
              2
            ),
          },
        },
      }),
    });
    if (!resp.ok) throw await this._createApiError(resp, '更新失败');
    return { success: true, gistId };
  }

  async importFromGist(gistIdOrUrl) {
    const gistId = this._parseGistId(gistIdOrUrl);
    if (!gistId) throw new Error('无效的Gist ID或URL');

    const resp = await fetch(`${GIST_API}/${gistId}`, { headers: { Accept: 'application/vnd.github.v3+json' } });
    if (!resp.ok) throw new Error('Gist不存在或无法访问');

    const gist = await resp.json();
    const file = gist.files['playlist.json'];
    if (!file) throw new Error('这不是一个有效的播放列表Gist');

    const playlist = JSON.parse(file.content);
    if (!playlist.videos || !Array.isArray(playlist.videos)) throw new Error('播放列表格式不正确');

    return { success: true, videos: playlist.videos, title: playlist.title, gistId, gistUrl: gist.html_url };
  }

  // ---- URL 生成 ----

  getPlayerUrl(gistId) {
    const pathname = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    const base = `${window.location.origin}${pathname}`;
    return gistId ? `${base}/player.html?gist=${gistId}` : `${base}/player.html`;
  }

  getShareUrl(gistId) {
    return this.getPlayerUrl(gistId);
  }

  _parseGistId(input) {
    if (!input) return null;
    // 直接是 gist ID
    if (/^[a-f0-9]{32}$/.test(input)) return input;
    // 从 URL 提取
    const m = input.match(/gist\.github\.com\/[^/]+\/([a-f0-9]{32})/);
    return m ? m[1] : input.trim();
  }

  _generateReadme(title, description, videos, gistUrl, gistId) {
    const videoList = videos.map((v, i) => `${i + 1}. [${v.title}](${v.url})`).join('\n');
    return `# ${title}\n\n${description || ''}\n\n## 🎬 视频列表\n\n${videoList}\n\n---\n\n▶️ [在线播放](${this.getPlayerUrl(gistId)}) | 📄 [Gist](${gistUrl})\n`;
  }

  async _createApiError(resp, fallbackMessage) {
    let detail = null;
    try {
      detail = await resp.json();
    } catch {
      detail = null;
    }
    const message = detail?.message || fallbackMessage;
    const error = new Error(message);
    error.status = resp.status;
    error.apiMessage = message;
    return error;
  }
}
