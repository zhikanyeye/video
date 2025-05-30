# 增强版视频播放器

## 功能特点
- 支持多种视频格式 (HLS, FLV, MP4)
- 自动检测网页中的视频资源
- 支持播放列表管理
- 支持视频分享
- 支持移动端访问

## 使用前准备
1. 获取 GitHub Token
   - 访问 https://github.com/settings/tokens
   - 创建新 Token，确保勾选 `gist` 权限
   - 复制并保存 Token

2. 设置 Token
   - 在首页点击 "GitHub 设置"
   - 粘贴你的 Token
   - 点击保存

## 使用方法
1. 添加视频
   - 单个添加：填写标题和链接
   - 批量添加：每行一个视频，格式为 "标题,链接"

2. 播放视频
   - 点击 "生成播放页面" 打开播放器
   - 使用播放列表控制播放顺序
   - 支持键盘控制 (左右方向键切换视频，F键全屏)

3. 分享播放列表
   - 点击 "复制分享链接" 获取分享链接
   - 分享链接可直接打开播放器页面

## 支持的视频格式
- HLS (.m3u8)
- HTTP-FLV (.flv)
- MP4
- YouTube 视频
- Bilibili 视频

## 注意事项
- 确保浏览器已启用 JavaScript
- 部分视频可能因跨域限制无法播放
- 建议使用最新版本的现代浏览器
