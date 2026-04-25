/**
 * Modal 模态框组件
 */
let _pendingAction = null;

export function showModal(title, message, onConfirm) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  if (modal && modalTitle && modalMessage) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add('show');
    _pendingAction = onConfirm;
  }
}

export function hideModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.remove('show');
  _pendingAction = null;
}

export function confirmModal() {
  if (_pendingAction) {
    _pendingAction();
    _pendingAction = null;
  }
  hideModal();
}

export function initModalListeners() {
  const close = document.getElementById('modalClose');
  const cancel = document.getElementById('modalCancel');
  const confirm = document.getElementById('modalConfirm');
  const modal = document.getElementById('modal');

  close?.addEventListener('click', hideModal);
  cancel?.addEventListener('click', hideModal);
  confirm?.addEventListener('click', confirmModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });
}
