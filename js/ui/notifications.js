/**
 * notifications.js — transient Bootstrap toasts for success and error messages.
 */

import { escapeHtml, elementFromHtml } from '../utilities.js';

const ICONS = {
  success: 'bi-check-circle-fill',
  danger: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
};

/**
 * Show a toast message.
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} [variant]
 */
export function showNotification(message, variant = 'info') {
  const container = document.getElementById('toast-container');
  const toastElement = elementFromHtml(`
    <div class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body"><i class="bi ${ICONS[variant]} me-2"></i>${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`);
  container.appendChild(toastElement);
  toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
  new bootstrap.Toast(toastElement, { delay: variant === 'danger' ? 8000 : 4000 }).show();
}

export function showError(error) {
  console.error(error);
  showNotification(error?.message ?? String(error), 'danger');
}
