/**
 * GitHub管理器 - 统一的GitHub授权和Gist管理
 * 整合了用户授权、Token管理、Gist分享和导入等功能
 */
class GitHubManager {
    constructor() {
        this.tokenKey = 'github_token';
        this.userKey = 'github_user';
        this.baseUrl = 'https://api.github.com';
        this.gistUrl = 'https://api.github.com/gists';
    }

    // ==================== 授权相关方法 ====================

    /**
     * 检查是否已授权
     */
    isAuthenticated() {
        return !!this.getToken();
    }

    /**
     * 获取存储的Token
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    /**
     * 获取用户信息
     */
    getUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    /**
     * 保存Token和用户信息
     */
    async saveToken(token) {
        try {
            // 验证Token有效性
            const response = await fetch(`${this.baseUrl}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Token验证失败，请检查Token是否正确');
            }

            const user = await response.json();
            
            // 保存Token和用户信息
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify({
                login: user.login,
                name: user.name,
                avatar_url: user.avatar_url
            }));

            return user;
        } catch (error) {
            throw new Error('Token验证失败，请检查Token是否正确');
        }
    }

    /**
     * 清除授权信息
     */
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        // 移除授权成功状态类
        document.body.classList.remove('auth-success-state');
        
        // 重新显示授权UI
        this.showAuthUI();
    }

    // ==================== UI相关方法 ====================

    /**
     * 显示授权引导弹窗
     */
    showAuthGuide() {
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-content">
                <div class="auth-header">
                    <h3>🔐 GitHub授权</h3>
                    <span class="auth-close">&times;</span>
                </div>
                <div class="auth-body">
                    <p>为了保存和分享您的播放列表，需要GitHub授权：</p>
                    <ol class="auth-steps">
                        <li>点击下方按钮前往GitHub创建Token</li>
                        <li>勾选 <strong>gist</strong> 权限</li>
                        <li>复制生成的Token并粘贴到下方</li>
                    </ol>
                    <div class="auth-actions">
                        <a href="https://github.com/settings/tokens/new?description=青云播视频分享&scopes=gist" 
                           target="_blank" class="auth-btn primary">
                            🔗 创建GitHub Token
                        </a>
                    </div>
                    <div class="auth-input-group">
                        <label for="githubToken">粘贴您的GitHub Token:</label>
                        <input type="password" id="githubToken" placeholder="ghp_xxxxxxxxxxxx..." />
                        <button id="saveTokenBtn" class="auth-btn secondary">保存授权</button>
                    </div>
                    <div class="auth-note">
                        <small>
                            💡 Token仅存储在本地浏览器中，不会上传到任何服务器<br>
                            🔒 您可以随时在设置中撤销授权
                        </small>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定事件
        const closeBtn = modal.querySelector('.auth-close');
        const saveBtn = modal.querySelector('#saveTokenBtn');
        const tokenInput = modal.querySelector('#githubToken');

        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        saveBtn.addEventListener('click', async () => {
            const token = tokenInput.value.trim();
            if (!token) {
                alert('请输入GitHub Token');
                return;
            }

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = '验证中...';
                
                await this.saveToken(token);
                
                alert('授权成功！现在可以分享播放列表了。');
                document.body.removeChild(modal);
                
                // 触发授权成功事件
                window.dispatchEvent(new Event('github-auth-success'));
                
                // 更新UI
                this.hideAuthUI();
                this.showAuthStatus();
                
            } catch (error) {
                alert(error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '保存授权';
            }
        });

        return modal;
    }

    /**
     * 显示授权状态（已授权时显示用户信息和管理选项）
     */
    showAuthStatus() {
        const githubUserInfo = document.getElementById('githubUserInfo');
        if (githubUserInfo) {
            const user = this.getUser();
            if (user) {
                githubUserInfo.innerHTML = `
                    <div class="auth-status-container">
                        <div class="auth-success-badge">
                            <i class="material-icons">check_circle</i>
                            <span>已授权 (${user.login})</span>
                        </div>
                        <div class="auth-actions">
                            <button class="btn-small" onclick="gitHubManager.showAuthGuide()">重新授权</button>
                            <button class="btn-small danger" onclick="gitHubManager.logout()">退出登录</button>
                        </div>
                    </div>
                `;
                githubUserInfo.style.display = 'block';
            }
        }
    }

    /**
     * 显示授权UI（未授权时显示）
     */
    showAuthUI() {
        const githubUserInfo = document.getElementById('githubUserInfo');
        if (githubUserInfo) {
            githubUserInfo.innerHTML = `
                <div class="auth-prompt">
                    <span>GitHub未授权</span>
                    <button onclick="gitHubManager.showAuthGuide()" class="btn btn-primary btn-sm">
                        授权登录
                    </button>
                </div>
            `;
            githubUserInfo.style.display = 'block';
        }
    }

    /**
     * 隐藏授权UI（授权成功后调用）
     */
    hideAuthUI() {
        const authModal = document.querySelector('.auth-modal');
        if (authModal) {
            authModal.style.display = 'none';
        }
        
        document.body.classList.add('auth-success-state');
    }

    /**
     * 初始化时检查授权状态
     */
    checkAuthStatus() {
        if (this.isAuthenticated()) {
            this.showAuthStatus();
        } else {
            this.showAuthUI();
        }
    }

    /**
     * 渲染用户信息
     */
    renderUserInfo(container) {
        const user = this.getUser();
        if (!user) return;

        container.innerHTML = `
            <div class="user-info">
                <img src="${user.avatar_url}" alt="${user.login}" class="user-avatar">
                <div class="user-details">
                    <div class="user-name">${user.name || user.login}</div>
                    <div class="user-login">@${user.login}</div>
                </div>
                <button class="logout-btn" onclick="gitHubManager.logout();">
                    退出登录
                </button>
            </div>
        `;
    }

    // ==================== Gist相关方法 ====================

    /**
     * 检查是否可以分享（需要授权）
     */
    canShare() {
        return this.isAuthenticated();
    }

    /**
     * 分享播放列表到Gist
     */
    async sharePlaylist(videos, title = '青云播视频播放列表', description = '') {
        if (!this.canShare()) {
            this.showAuthGuide();
            return null;
        }

        try {
            // 创建基本的gist结构
            const gistData = {
                description: description || `${title} - 共${videos.length}个视频`,
                public: true,
                files: {
                    "playlist.json": {
                        content: JSON.stringify({
                            title,
                            description,
                            created: new Date().toISOString(),
                            videos: videos,
                            player_url: this.getPlayerUrl()
                        }, null, 2)
                    }
                }
            };

            const response = await fetch(this.gistUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '分享失败');
            }

            const gist = await response.json();

            // 生成README内容
            const readmeContent = this.generateReadme(title, description, videos, gist.html_url, gist.id);
            
            // 更新Gist，添加README
            const updateData = {
                files: {
                    "README.md": {
                        content: readmeContent
                    }
                }
            };

            await fetch(`${this.gistUrl}/${gist.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.getToken()}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            return {
                gist_id: gist.id,
                gist_url: gist.html_url,
                player_url: this.getPlayerUrl(gist.id),
                share_url: this.getShareUrl(gist.id)
            };

        } catch (error) {
            console.error('分享失败:', error);
            throw error;
        }
    }

    /**
     * 从Gist导入播放列表
     */
    async importFromGist(gistId) {
        try {
            const response = await fetch(`${this.gistUrl}/${gistId}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Gist不存在或无法访问');
            }

            const gist = await response.json();
            const playlistFile = gist.files['playlist.json'];
            
            if (!playlistFile) {
                throw new Error('这不是一个有效的播放列表Gist');
            }

            const playlist = JSON.parse(playlistFile.content);
            
            if (!playlist.videos || !Array.isArray(playlist.videos)) {
                throw new Error('播放列表格式不正确');
            }

            return playlist;

        } catch (error) {
            console.error('导入失败:', error);
            throw error;
        }
    }

    /**
     * 加载播放列表（兼容旧的API）
     */
    async loadPlaylist(gistId) {
        return await this.importFromGist(gistId);
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取播放器URL
     */
    getPlayerUrl(gistId = '') {
        const baseUrl = window.location.origin;
        return gistId ? `${baseUrl}/player.html?gist=${gistId}` : `${baseUrl}/player.html`;
    }

    /**
     * 获取分享URL
     */
    getShareUrl(gistId) {
        return this.getPlayerUrl(gistId);
    }

    /**
     * 生成README内容
     */
    generateReadme(title, description, videos, gistUrl, gistId) {
        const playerUrl = this.getPlayerUrl(gistId);
        
        return `# ${title}

${description ? `## ${description}` : ''}

## 📺 视频列表

${videos.map((video, index) => `${index + 1}. **${video.title}**${video.description ? ` - ${video.description}` : ''}`).join('\n')}

## 🎬 播放方式

- **在线播放**: [点击这里播放](${playerUrl})
- **Gist链接**: [查看源码](${gistUrl})

---

*播放列表创建时间: ${new Date().toLocaleString('zh-CN')}*
*共 ${videos.length} 个视频*
`;
    }

    /**
     * 解析Gist ID从URL
     */
    parseGistId(url) {
        const patterns = [
            /gist\.github\.com\/[^\/]+\/([a-f0-9]+)/i,
            /api\.github\.com\/gists\/([a-f0-9]+)/i,
            /^([a-f0-9]+)$/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }
}

// 创建全局实例
const gitHubManager = new GitHubManager();

// 兼容旧的变量名（向后兼容）
const gitHubAuth = gitHubManager;
const improvedGistManager = gitHubManager;
