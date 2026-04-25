/**
 * 前端全局配置
 * 自动检测运行环境，在本地开发与生产（GitHub Pages）之间切换 API 基地址。
 *
 * 【本地开发】：无需修改，localhost/127.0.0.1 会自动使用 http://localhost:3000
 *              （对应 backend/server.js 默认端口）
 *
 * 【生产部署】：将下方 API_BASE 的生产值替换为你实际部署的后端公网地址，例如：
 *              https://my-app.onrender.com
 *              https://my-app.railway.app
 *              https://my-app.fly.dev
 *   替换步骤：找到 'https://your-backend.onrender.com' 并改为你的真实地址，
 *   然后 git add scripts/config.js && git commit && git push。
 *
 * 不要在此文件中写入密钥或其他敏感信息。
 */
(function () {
    'use strict';

    var isLocal =
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1';

    window.APP_CONFIG = {
        /**
         * 后端 API 基地址（不含末尾斜杠）
         * 所有后端请求均使用此地址拼接，例如：
         *   fetch(APP_CONFIG.API_BASE + '/api/sniff?url=...')
         *
         * ↓↓↓ 部署前请将生产地址替换为你的真实后端域名 ↓↓↓
         */
        API_BASE: isLocal
            ? 'http://localhost:3000'
            : 'https://your-backend.onrender.com'
    };

    // 方便开发调试：在控制台输出当前环境信息
    if (isLocal) {
        console.info('[APP_CONFIG] 本地开发模式，API_BASE =', window.APP_CONFIG.API_BASE);
    }
})();
