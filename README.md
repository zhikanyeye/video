# 青云播 v2.0

现代化视频播放器，支持 MP4、M3U8、FLV、DASH、MPEG-TS 等格式，基于 ArtPlayer 引擎，前后端分离架构。

**在线体验**: https://zhikanyeye.github.io/video/

---

## 架构概览

```
前端（GitHub Pages）          后端（Render / Railway / VPS）
Vite + 原生 JS ES Modules     Node.js + Express
        │                              │
        ├─ index.html  视频管理         ├─ /api/sniff   视频源嗅探
        ├─ player.html 播放器           ├─ /api/probe   格式检测
        └─ GitHub Gist 云同步           └─ /api/hls     HLS 代理
```

---

## 快速开始

### 本地开发

```bash
# 安装前端依赖
npm install

# 启动前端开发服务器（含热更新）
npm run dev

# 启动后端（另开终端）
cd backend && npm install && npm start
```

前端默认访问 `http://localhost:5173`，后端运行于 `http://localhost:3000`。

### 构建生产版本

```bash
npm run build   # 输出到 dist/
```

---

## 部署

### 前端 — GitHub Pages

1. 在仓库 `Settings → Secrets and variables → Actions → Variables` 中添加：
   ```
   VITE_API_BASE = https://your-backend.onrender.com
   ```
2. 推送到 `master` 分支，GitHub Actions 自动构建并部署到 Pages。

> 注意：`VITE_API_BASE` 是 **Repository Variable**（不是 Secret），Actions 工作流通过 `${{ vars.VITE_API_BASE }}` 读取。

### 后端 — Render（免费套餐）

1. 在 [Render](https://render.com) 创建 **New → Web Service**
2. 关联此仓库，**Root Directory** 填 `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. 将生成的域名填入前端的 `VITE_API_BASE`

#### 后端环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口（平台自动注入） |
| `ALLOWED_ORIGINS` | — | 额外允许的 CORS 来源，逗号分隔 |
| `CORS_ALLOW_ALL` | `false` | 设为 `true` 允许所有来源（不推荐） |

默认 CORS 白名单已包含 `https://zhikanyeye.github.io`。如果你 fork 了此仓库，需在后端设置：
```
ALLOWED_ORIGINS=https://yourusername.github.io
```

---

## 功能

### 视频管理页（index.html）
- 单个 / 批量添加视频链接（折叠面板）
- 自动检测格式（MP4、M3U8、FLV、RTMP、DASH、MPEG-TS）
- 播放源兼容性检测（编码 / 格式 / CORS）
- 导出 / 从 GitHub Gist 导入播放列表
- 生成分享链接（保存到 GitHub Gist，可跨设备打开）

### 播放器页（player.html）
- ArtPlayer 引擎，支持 HLS.js / flv.js / DASH
- 顺序 / 列表循环 / 单曲循环 / 随机播放
- 播放进度自动记忆（非 ASCII URL 安全存储）
- 侧边栏播放列表，当前项高亮
- 播放设置面板（自动播放下一集、HLS 代理开关）

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `Space` / `K` | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 10 秒 |
| `↑` / `↓` | 音量 +10% / -10% |
| `Ctrl + ←` / `Ctrl + →` | 上一集 / 下一集 |
| `M` | 静音切换 |
| `F` | 全屏切换 |
| `Esc` | 退出全屏 / 关闭面板 |
| `1`–`9` | 跳转到 10%–90% 位置 |

---

## 项目结构

```
video/
├── index.html              # 视频管理页
├── player.html             # 播放器页
├── src/
│   ├── main.js             # 管理页逻辑
│   ├── player-main.js      # 播放器页逻辑
│   ├── player/
│   │   ├── core.js         # ArtPlayer 封装
│   │   ├── keyboard.js     # 键盘快捷键
│   │   └── playlist.js     # 播放列表 / 播放模式
│   ├── parsers/
│   │   └── video-url.js    # URL 格式解析
│   ├── components/
│   │   ├── github-manager.js  # GitHub Gist 管理
│   │   ├── modal.js
│   │   └── toast.js
│   ├── store/
│   │   └── index.js        # localStorage 状态管理
│   └── utils/
│       └── index.js        # 共享工具函数（含 getApiBase）
├── styles/
│   ├── main.css            # 管理页样式
│   └── player.css          # 播放器样式
├── backend/
│   ├── server.js           # Express 入口
│   ├── routes/
│   │   ├── sniff.js        # 视频源嗅探
│   │   ├── probe.js        # 格式 / 编码检测
│   │   ├── hls.js          # HLS 代理
│   │   └── playlists.js    # 播放列表持久化
│   ├── middlewares/
│   │   └── cors.js         # CORS 中间件
│   └── utils/
│       └── safe-url.js     # SSRF 防护
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 自动部署
├── vite.config.js
└── package.json
```

---

## License

MIT
