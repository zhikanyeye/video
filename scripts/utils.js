/**
 * 通用工具函数库
 * 提供项目中常用的工具方法
 */

// 生成唯一ID
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化时间（秒转为 HH:MM:SS）
export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 解析时间字符串为秒数
export function parseTime(timeString) {
    if (!timeString) return 0;
    
    const parts = timeString.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

// 防抖函数
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// 深度复制对象
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

// 验证URL格式
export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// 获取URL参数
export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// 设置URL参数
export function setUrlParam(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    window.history.replaceState({}, '', url);
}

// 移除URL参数
export function removeUrlParam(key) {
    const url = new URL(window.location);
    url.searchParams.delete(key);
    window.history.replaceState({}, '', url);
}

// 显示通知
export function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const toastHeader = document.createElement('div');
    toastHeader.className = 'toast-header';
    
    const toastTitle = document.createElement('div');
    toastTitle.className = 'toast-title';
    toastTitle.textContent = getToastTitle(type);
    
    const toastClose = document.createElement('button');
    toastClose.className = 'toast-close';
    toastClose.innerHTML = '×';
    toastClose.onclick = () => removeToast(toast);
    
    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-message';
    toastMessage.textContent = message;
    
    toastHeader.appendChild(toastTitle);
    toastHeader.appendChild(toastClose);
    toast.appendChild(toastHeader);
    toast.appendChild(toastMessage);
    
    toastContainer.appendChild(toast);
    
    // 显示动画
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 自动移除
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }
    
    return toast;
}

// 移除通知
function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// 获取通知标题
function getToastTitle(type) {
    const titles = {
        'success': '成功',
        'error': '错误',
        'warning': '警告',
        'info': '提示'
    };
    return titles[type] || '通知';
}

// 复制文本到剪贴板
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板', 'success');
        return true;
    } catch (err) {
        console.error('复制失败:', err);
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('已复制到剪贴板', 'success');
            return true;
        } catch (e) {
            showToast('复制失败', 'error');
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

// 下载文件
export function downloadFile(content, filename, contentType = 'application/json') {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// 读取文件内容
export function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// 元素拖拽排序
export function makeSortable(container, itemSelector, onSort) {
    let draggedElement = null;
    let placeholder = null;
    
    container.addEventListener('dragstart', (e) => {
        if (!e.target.matches(itemSelector)) return;
        
        draggedElement = e.target;
        e.target.classList.add('dragging');
        
        // 创建占位符
        placeholder = e.target.cloneNode(true);
        placeholder.classList.add('placeholder');
        placeholder.style.opacity = '0.5';
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    });
    
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = getDragAfterElement(container, e.clientY, itemSelector);
        if (afterElement == null) {
            container.appendChild(placeholder);
        } else {
            container.insertBefore(placeholder, afterElement);
        }
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedElement && placeholder) {
            placeholder.parentNode.replaceChild(draggedElement, placeholder);
            if (onSort) {
                const items = Array.from(container.querySelectorAll(itemSelector));
                const newIndex = items.indexOf(draggedElement);
                onSort(draggedElement, newIndex);
            }
        }
    });
    
    container.addEventListener('dragend', (e) => {
        if (e.target.matches(itemSelector)) {
            e.target.classList.remove('dragging');
        }
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }
        draggedElement = null;
        placeholder = null;
    });
}

// 获取拖拽后的位置
function getDragAfterElement(container, y, itemSelector) {
    const draggableElements = [...container.querySelectorAll(`${itemSelector}:not(.dragging)`)];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 键盘快捷键管理
export class KeyboardManager {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }
    
    init() {
        document.addEventListener('keydown', (e) => {
            const key = this.getKeyString(e);
            const handler = this.shortcuts.get(key);
            if (handler) {
                e.preventDefault();
                handler(e);
            }
        });
    }
    
    register(keys, handler) {
        if (Array.isArray(keys)) {
            keys.forEach(key => this.shortcuts.set(key, handler));
        } else {
            this.shortcuts.set(keys, handler);
        }
    }
    
    unregister(keys) {
        if (Array.isArray(keys)) {
            keys.forEach(key => this.shortcuts.delete(key));
        } else {
            this.shortcuts.delete(keys);
        }
    }
    
    getKeyString(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }
}

// 全局键盘管理器实例
export const keyboardManager = new KeyboardManager();

// 模态框管理
export class ModalManager {
    constructor() {
        this.openModals = [];
        this.init();
    }
    
    init() {
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.openModals.length > 0) {
                this.close(this.openModals[this.openModals.length - 1]);
            }
        });
        
        // 点击背景关闭模态框
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.close(e.target);
            }
        });
    }
    
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('show');
        this.openModals.push(modal);
        
        // 聚焦第一个可聚焦元素
        const focusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) {
            setTimeout(() => focusable.focus(), 100);
        }
    }
    
    close(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        if (!modal) return;
        
        modal.classList.remove('show');
        const index = this.openModals.indexOf(modal);
        if (index > -1) {
            this.openModals.splice(index, 1);
        }
    }
    
    closeAll() {
        this.openModals.forEach(modal => this.close(modal));
    }
}

// 全局模态框管理器实例
export const modalManager = new ModalManager();

// 错误处理
export function handleError(error, context = '') {
    console.error(`错误 [${context}]:`, error);
    
    let message = '发生未知错误';
    if (error.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    
    showToast(context ? `${context}: ${message}` : message, 'error');
}

// 性能监控
export class PerformanceMonitor {
    constructor() {
        this.marks = new Map();
    }
    
    start(name) {
        this.marks.set(name, performance.now());
    }
    
    end(name) {
        const startTime = this.marks.get(name);
        if (startTime) {
            const duration = performance.now() - startTime;
            console.log(`性能监控 [${name}]: ${duration.toFixed(2)}ms`);
            this.marks.delete(name);
            return duration;
        }
        return 0;
    }
    
    measure(name, fn) {
        this.start(name);
        const result = fn();
        this.end(name);
        return result;
    }
}

// 全局性能监控器实例
export const performanceMonitor = new PerformanceMonitor();
