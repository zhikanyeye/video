// GitHub授权管理器 - 用户友好的Token管理
class GitHubAuthManager {
    constructor() {
        this.tokenKey = 'github_token';
        this.userKey = 'github_user';
    }

    // 检查是否已授权
    isAuthenticated() {
        return !!this.getToken();
    }

    // 获取存储的Token
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    // 获取用户信息
    getUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    // 保存Token和用户信息
    async saveToken(token) {
        try {
            // 验证Token有效性
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
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

    // 清除授权信息
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    // 显示授权引导
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
        });        saveBtn.addEventListener('click', async () => {
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
                
                // 隐藏授权相关的UI元素
                this.hideAuthUI();
                
            } catch (error) {
                alert(error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '保存授权';
            }
        });

        return modal;
    }    // 隐藏授权相关的UI元素
    hideAuthUI() {
        // 如果有授权引导弹窗，隐藏它
        const authModal = document.querySelector('.auth-modal');
        if (authModal) {
            authModal.style.display = 'none';
        }
        
        // 显示简洁的授权成功状态，而不是完整的用户信息
        const githubUserInfo = document.getElementById('githubUserInfo');
        if (githubUserInfo) {
            const user = this.getUser();
            if (user) {
                githubUserInfo.innerHTML = `
                    <div class="auth-success-badge">
                        <i class="material-icons">check_circle</i>
                        <span>已授权 (${user.login})</span>
                    </div>
                `;
                githubUserInfo.style.display = 'block';
            }
        }
        
        // 隐藏任何可能的Token输入界面
        const tokenInputs = document.querySelectorAll('[id*="token"], [id*="Token"]');
        tokenInputs.forEach(input => {
            const parent = input.closest('.form-group, .auth-input-group, .input-group');
            if (parent) {
                parent.classList.add('auth-hidden');
            }
        });
        
        // 隐藏GitHub相关的设置按钮（但不隐藏授权成功的显示）
        const githubButtons = document.querySelectorAll('[class*="github"], [id*="github"]');
        githubButtons.forEach(btn => {
            if (btn.textContent.includes('Token') || btn.textContent.includes('授权')) {
                btn.classList.add('auth-hidden');
            }
        });
        
        // 给body添加授权成功状态类
        document.body.classList.add('auth-success-state');
    }

    // 初始化时检查授权状态
    checkAuthStatus() {
        if (this.isAuthenticated()) {
            this.hideAuthUI();
        }
    }

    // 显示用户信息
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
                <button class="logout-btn" onclick="gitHubAuth.logout(); location.reload();">
                    退出登录
                </button>
            </div>
        `;
    }
}

// 全局实例
const gitHubAuth = new GitHubAuthManager();
