const TOAST_CONTAINER_ID = 'app-toast-container';

const VARIANT_MAP = {
  success: { title: 'Success', icon: 'ni ni-check-bold', iconClass: 'text-success' },
  error: { title: 'Error', icon: 'ni ni-notification-70', iconClass: 'text-danger' },
  warning: { title: 'Warning', icon: 'ni ni-bell-55', iconClass: 'text-warning' },
  info: { title: 'Info', icon: 'ni ni-badge', iconClass: 'text-info' },
};

const resolveVariant = (variant) => {
  if (variant && VARIANT_MAP[variant]) return variant;
  return 'info';
};

const getContainer = () => {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'position-fixed bottom-1 end-1 z-index-2';
    document.body.appendChild(container);
  }
  return container;
};

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Wrap quoted segments (e.g. product names) in <strong> for toast HTML bodies. */
export function boldQuotedNamesInMessage(message) {
  return String(message ?? '').replace(/"([^"]+)"/g, (_, name) => `"<strong>${escapeHtml(name)}</strong>"`);
}

export const showToast = ({
  message,
  title,
  variant = 'info',
  delay = 5000,
  autohide = true,
  html = false,
} = {}) => {
  const resolvedVariant = resolveVariant(variant);
  const config = VARIANT_MAP[resolvedVariant];
  const container = getContainer();
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.className = 'toast fade p-2 mt-2 bg-white position-relative';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  let toastInstance = null;

  const dismissToast = () => {
    if (toastInstance) {
      toastInstance.hide();
      return;
    }
    toastEl.classList.remove('show');
    toastEl.remove();
  };

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className =
    'btn btn-link text-secondary p-0 position-absolute top-0 end-0 m-2 lh-1 app-toast-close';
  closeBtn.style.zIndex = '2';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<i class="fas fa-times text-sm"></i>';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissToast();
  });

  const header = document.createElement('div');
  header.className = 'toast-header border-0 pe-4';

  const icon = document.createElement('i');
  icon.className = `${config.icon} ${config.iconClass} me-2`;

  const titleEl = document.createElement('span');
  titleEl.className =
    resolvedVariant === 'error'
      ? 'me-auto text-gradient text-danger font-weight-bold'
      : 'me-auto font-weight-bold';
  titleEl.textContent = title || config.title;

  const timeEl = document.createElement('small');
  timeEl.className = 'text-body ms-2';
  timeEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  header.appendChild(icon);
  header.appendChild(titleEl);
  header.appendChild(timeEl);

  const hr = document.createElement('hr');
  hr.className = 'horizontal dark m-0';

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.style.whiteSpace = 'pre-line';
  if (html) {
    body.innerHTML = String(message || '');
  } else {
    body.textContent = String(message || '');
  }

  toastEl.appendChild(closeBtn);
  toastEl.appendChild(header);
  toastEl.appendChild(hr);
  toastEl.appendChild(body);
  container.appendChild(toastEl);

  if (window.bootstrap && window.bootstrap.Toast) {
    toastInstance = new window.bootstrap.Toast(toastEl, { autohide, delay });
    toastInstance.show();
    toastEl.addEventListener(
      'hidden.bs.toast',
      () => {
        toastEl.remove();
      },
      { once: true }
    );
  } else {
    toastEl.classList.add('show');
    setTimeout(() => toastEl.remove(), autohide ? delay : 15000);
  }
};

export const toast = {
  success: (message, opts = {}) => showToast({ ...opts, message, variant: 'success' }),
  error: (message, opts = {}) => showToast({ ...opts, message, variant: 'error' }),
  warning: (message, opts = {}) => showToast({ ...opts, message, variant: 'warning' }),
  info: (message, opts = {}) => showToast({ ...opts, message, variant: 'info' }),
};
