/**
 * GitHub Gist 管理器
 */
import * as store from '../store/index.js';

const GIST_API = 'https://api.github.com/gists';
const GITHUB_API = 'https://api.github.com';

export class GitHubManager {
  // ---- 授权 ----

  isAuthenticated() {
    return !!store.getGitHubToken();
  }

  getToken() {
    return store.getGitHubToken();
  }

  getUser() {
    return store.getGitHubUser();
  }

  async saveToken(token) {
    const resp = await fetch(`${GITHUB_API}/user`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
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
      headers: { Authorization: `token ${this.getToken()}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(gistData),
    });
    if (!resp.ok) throw new Error((await resp.json()).message || '分享失败');

    const gist = await resp.json();

    // 更新 Gist 添加 README
    await fetch(`${GIST_API}/${gist.id}`, {
      method: 'PATCH',
      headers: { Authorization: `token ${this.getToken()}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
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
      headers: { Authorization: `token ${this.getToken()}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
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
    if (!resp.ok) throw new Error((await resp.json()).message || '更新失败');
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
    const base = window.location.origin + window.location.pathname.replace(/\/index\.html$/, '');
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
}
