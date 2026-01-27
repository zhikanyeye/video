/**
 * 通用工具函数库
 * 提供播放器和主应用共用的工具方法
 */

/**
 * 防抖函数 - 延迟执行，只执行最后一次调用
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * 节流函数 - 限制执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 格式化时间为 HH:MM:SS 或 MM:SS
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return hrs.toString().padStart(2, '0') + ':' + 
               mins.toString().padStart(2, '0') + ':' + 
               secs.toString().padStart(2, '0');
    } else {
        return mins.toString().padStart(2, '0') + ':' + 
               secs.toString().padStart(2, '0');
    }
}

/**
 * HTML转义，防止XSS攻击
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的HTML安全文本
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 生成唯一ID
 * @param {string} prefix - ID前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延迟执行
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise} 延迟Promise
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证视频URL的安全性
 * @param {string} url - 要验证的URL
 * @returns {Object} 验证结果 {valid: boolean, reason?: string}
 */
function isValidVideoUrl(url) {
    try {
        const parsed = new URL(url);
        
        // 只允许 http/https/rtmp 协议
        const allowedProtocols = ['http:', 'https:', 'rtmp:'];
        if (!allowedProtocols.includes(parsed.protocol)) {
            return { valid: false, reason: '不支持的协议' };
        }
        
        // 检查是否为 javascript: 协议（XSS 防护）
        if (url.toLowerCase().includes('javascript:')) {
            return { valid: false, reason: '不安全的链接' };
        }
        
        return { valid: true };
    } catch {
        return { valid: false, reason: '无效的链接格式' };
    }
}

// 导出所有工具函数（用于 ES6 模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        debounce,
        throttle,
        formatTime,
        escapeHtml,
        generateId,
        delay,
        isValidVideoUrl
    };
}
