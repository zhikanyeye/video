/**
 * Toast 提示组件
 */
let _toastEl = null;
let _toastTimer = null;

export function showToast(message, type = 'info', duration = 3000) {
  if (!_toastEl) {
    _toastEl = document.createElement('div');
    _toastEl.className = 'toast-container';
    _toastEl.setAttribute('role', 'status');
    _toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(_toastEl);
  }

  clearTimeout(_toastTimer);
  _toastEl.textContent = message;
  _toastEl.className = `toast-container toast-${type} toast-show`;

  _toastTimer = setTimeout(() => {
    _toastEl.classList.remove('toast-show');
    _toastEl.textContent = '';
  }, duration);
}
