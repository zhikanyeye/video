# 青云播 v2.0 - 现代化视频播放器

<div align="center">

![版本](https://img.shields.io/badge/版本-v2.0-6c5ce7?style=for-the-badge)
![构建](https://img.shields.io/badge/构建-Vite-646cff?style=for-the-badge&logo=vite)
![后端](https://img.shields.io/badge/后端-Node.js-339933?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-00b894?style=for-the-badge)

**功能强大、界面优雅的现代化视频播放器**

支持 MP4、M3U8、FLV、DASH、MPEG-TS 等主流格式，前后端分离架构，GitHub Gist 云同步

[🚀 在线体验](https://zhikanyeye.github.io/video/) · [📖 部署指南](#-部署指南) · [🎮 快捷键](#-键盘快捷键)

</div>

---

## ✨ 核心亮点

<table>
<tr>
<td width="50%">

### 🎥 全格式播放
基于 **ArtPlayer** 引擎，集成 HLS.js / flv.js，支持 MP4、M3U8、FLV、DASH、MPEG-TS、RTMP 等主流格式，自动检测无需手动选择。

</td>
<td width="50%">

### ☁️ 云端同步
通过 **GitHub Gist** 保存和分享播放列表，生成短链接即可在任意设备打开，无需注册账号，只需一个 GitHub Token。

</td>
</tr>
<tr>
<td width="50%">

### 🔍 智能检测
内置**播放源兼容性检测**与**视频源嗅探**。检测分析 HTTP 头、CORS 策略、M3U8 结构；嗅探从页面 DOM、Script、data-* 属性、iframe 中多层提取视频直链，自动评分排序。

</td>
<td width="50%">

### 🎮 沉浸体验
完整键盘快捷键、播放进度自动记忆、随机/循环/顺序多种播放模式、侧边栏播放列表实时高亮。

</td>
</tr>
</table>

---

## 🏗️ 架构概览

```mermaid
graph TB
    subgraph 前端["前端 · GitHub Pages"]
        A["index.html 视频管理"] -->|localStorage| B["player.html 播放器"]
        A -->|Gist API| C[("GitHub Gist 云同步")]
        B -->|读取| C
    end

    subgraph 后端["后端 · Render / VPS"]
        D["/api/sniff 视频源嗅探"]
        E["/api/probe 格式检测"]
        F["/api/hls HLS 代理"]
    end

    A -->|检测源| E
    A -->|嗅探| D
    B -->|嗅探| D
    B -->|代理流| F
```

```
用户浏览器
   │
   ├─ 前端静态文件（Vite 构建）
   │    └─ GitHub Pages: https://zhikanyeye.github.io/video/
   │
   └─ 后端 API（Node.js + Express）
        └─ Render: https://your-backend.onrender.com
```

---

## 🚀 部署指南

> 推荐方案：**GitHub Pages 托管前端 + Render 托管后端**（均有免费套餐）

### 1. 部署后端（Render）

1. 在 [Render](https://render.com) 创建 **New → Web Service**
2. 关联此 GitHub 仓库，**Root Directory** 填写 `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. 记录生成的公网域名，例如 `https://my-qingyunbo.onrender.com`

#### 后端环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口（平台自动注入，无需设置） |
| `ALLOWED_ORIGINS` | — | 额外允许的 CORS 来源，逗号分隔 |
| `CORS_ALLOW_ALL` | `false` | 设为 `true` 允许所有来源（不推荐） |

> 如果你 fork 了此仓库，需在后端添加：`ALLOWED_ORIGINS=https://yourusername.github.io`

---

### 2. 配置前端环境变量

在仓库 `Settings → Secrets and variables → Actions → Variables` 中添加：

```
名称：VITE_API_BASE
值：https://my-qingyunbo.onrender.com
```

> ⚠️ 注意：这是 **Repository Variable**（不是 Secret），工作流通过 `${{ vars.VITE_API_BASE }}` 读取。

---

### 3. 启用 GitHub Pages

1. 进入仓库 `Settings → Pages`
2. Source 选择 **GitHub Actions**
3. 推送到 `master` 分支，Actions 自动构建并部署
4. 约 1~2 分钟后访问 `https://zhikanyeye.github.io/video/`

---

### 4. 本地开发

```bash
# 克隆仓库
git clone https://github.com/zhikanyeye/video.git
cd video

# 安装前端依赖
npm install

# 启动前端开发服务器（http://localhost:5173）
npm run dev

# 另开终端，启动后端（http://localhost:3000）
cd backend && npm install && npm start
```

#### 本地验收步骤

```bash
# 1. 确认前后端均已启动
# 2. 浏览器访问 http://localhost:5173
# 3. 添加一个 .mp4 或 .m3u8 链接，点击"检测源"
# 4. F12 → Network，可看到对 http://localhost:3000/api/probe 的请求
# 5. 点击播放，确认视频正常加载
```

---

## 🎬 功能详解

### 视频管理页（index.html）

- ✅ **单个添加**：输入标题 + 链接，选择格式（支持自动检测）
- ✅ **批量添加**：折叠面板，每行一个链接，可在链接后加空格指定标题
- ✅ **播放源检测**：分析 HTTP 头 / CORS / M3U8 结构，定位兼容性问题
- ✅ **视频源嗅探**：从页面 DOM、Script、data-* 属性、iframe 多层提取视频直链，自动评分排序，一键添加到播放列表
- ✅ **导出列表**：导出为 JSON 文件备份
- ✅ **GitHub Gist 导入**：粘贴 Gist URL 或 ID 即可导入
- ✅ **生成分享链接**：保存到 Gist，生成可跨设备打开的播放链接

### 播放器页（player.html）

- ✅ **多格式支持**：MP4、M3U8（HLS）、FLV、DASH、MPEG-TS、iframe 嵌入
- ✅ **播放模式**：顺序 / 列表循环 / 单曲循环 / 随机（随机排除当前集）
- ✅ **进度记忆**：自动保存每个视频的播放进度，支持非 ASCII URL
- ✅ **侧边栏列表**：当前播放项左侧高亮，自动滚动到可见区域
- ✅ **设置面板**：自动播放下一集、HLS 代理开关
- ✅ **错误处理**：播放失败时显示详细错误信息，支持重试

---

## 🎮 键盘快捷键

| 按键 | 功能 |
|------|------|
| `Space` / `K` | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 10 秒 |
| `↑` / `↓` | 音量 +10% / -10% |
| `Ctrl + ←` | 上一集 |
| `Ctrl + →` | 下一集 |
| `M` | 静音切换 |
| `F` | 全屏切换 |
| `Esc` | 退出全屏 / 关闭面板 |
| `1` – `9` | 跳转到视频 10% – 90% 位置 |
| `0` | 跳转到视频开头 |

---

## 📁 项目结构

```
video/
├── index.html                  # 视频管理页
├── player.html                 # 播放器页
├── src/
│   ├── main.js                 # 管理页逻辑
│   ├── player-main.js          # 播放器页逻辑
│   ├── player/
│   │   ├── core.js             # ArtPlayer 封装
│   │   ├── keyboard.js         # 键盘快捷键
│   │   └── playlist.js         # 播放列表 / 播放模式
│   ├── parsers/
│   │   └── video-url.js        # URL 格式解析
│   ├── components/
│   │   ├── github-manager.js   # GitHub Gist 管理
│   │   ├── modal.js            # 通用弹窗
│   │   └── toast.js            # 消息提示
│   ├── store/
│   │   └── index.js            # localStorage 状态管理
│   └── utils/
│       └── index.js            # 共享工具函数
├── styles/
│   ├── main.css                # 管理页样式
│   └── player.css              # 播放器样式
├── assets/                     # 图标资源
├── backend/
│   ├── server.js               # Express 入口
│   ├── routes/
│   │   ├── sniff.js            # 视频源嗅探（分层提取 + HEAD 验证，SSRF 防护）
│   │   ├── probe.js            # 格式 / 编码检测
│   │   ├── hls.js              # HLS 反向代理
│   │   └── playlists.js        # 播放列表持久化（串行写锁）
│   ├── middlewares/
│   │   └── cors.js             # CORS 中间件
│   └── utils/
│       └── safe-url.js         # URL 安全校验
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自动部署
├── vite.config.js
└── package.json
```

---

## 🌐 浏览器支持

| 浏览器 | 支持情况 |
|--------|----------|
| Chrome 88+ | ✅ 完整支持，推荐首选 |
| Edge 88+ | ✅ 完整支持 |
| Firefox 85+ | ✅ 完整支持 |
| Safari 14+ | ✅ 主要功能完整 |
| iOS Safari | ⚠️ 核心功能可用，部分手势受限 |
| Internet Explorer | ❌ 不支持 |

---

## 🔧 常见问题

**嗅探没有找到视频源？**
- 嗅探仅解析静态 HTML，无法执行 JavaScript（不使用 Puppeteer）
- 页面需要登录或视频源由 JS 动态加载时，嗅探无法提取
- 可尝试直接粘贴视频直链，或使用浏览器开发者工具手动找到 m3u8/mp4 地址

**视频无法播放？**
- 点击"检测源"查看兼容性报告
- 确认视频链接可直接在浏览器访问
- M3U8 跨域问题可在播放器设置中开启 HLS 代理

**环境变量配置后仍不生效？**
- 确认添加的是 Repository **Variable**（不是 Secret）
- 变量名必须是 `VITE_API_BASE`，区分大小写
- 重新触发一次 Actions 构建

**本地开发时 API 请求失败？**
- 确认后端已在 `http://localhost:3000` 运行
- 本地环境会自动回退到 `localhost:3000`，无需配置

---

## 📄 License

MIT © [zhikanyeye](https://github.com/zhikanyeye)

---

<div align="center">

**如果青云播对你有帮助，欢迎点个 Star ⭐**

</div>
