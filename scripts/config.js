/**
 * 前端全局配置
 * 自动检测运行环境，在本地开发与生产（GitHub Pages）之间切换 API 基地址。
 *
 * 本地开发：http://localhost:3000（对应 backend/server.js 默认端口）
 * 生产环境：将下方占位符替换为实际部署的后端公网地址
 *            例如：https://your-app.onrender.com
 *                  https://your-app.railway.app
 *                  https://your-app.fly.dev
 *
 * 不要在此文件中写入真实密钥或敏感信息。
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
