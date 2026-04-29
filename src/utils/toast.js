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

export const showToast = ({
  message,
  title,
  variant = 'info',
  delay = 5000,
  autohide = true,
} = {}) => {
  const resolvedVariant = resolveVariant(variant);
  const config = VARIANT_MAP[resolvedVariant];
  const container = getContainer();
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.className = 'toast fade p-2 mt-2 bg-white';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  const header = document.createElement('div');
  header.className = 'toast-header border-0';

  const icon = document.createElement('i');
  icon.className = `${config.icon} ${config.iconClass} me-2`;

  const titleEl = document.createElement('span');
  titleEl.className =
    resolvedVariant === 'error'
      ? 'me-auto text-gradient text-danger font-weight-bold'
      : 'me-auto font-weight-bold';
  titleEl.textContent = title || config.title;

  const timeEl = document.createElement('small');
  timeEl.className = 'text-body';
  timeEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const closeEl = document.createElement('i');
  closeEl.className = 'fas fa-times text-md ms-3 cursor-pointer';
  closeEl.setAttribute('data-bs-dismiss', 'toast');
  closeEl.setAttribute('aria-label', 'Close');

  header.appendChild(icon);
  header.appendChild(titleEl);
  header.appendChild(timeEl);
  header.appendChild(closeEl);

  const hr = document.createElement('hr');
  hr.className = 'horizontal dark m-0';

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.style.whiteSpace = 'pre-line';
  body.textContent = String(message || '');

  toastEl.appendChild(header);
  toastEl.appendChild(hr);
  toastEl.appendChild(body);
  container.appendChild(toastEl);

  if (window.bootstrap && window.bootstrap.Toast) {
    const toast = new window.bootstrap.Toast(toastEl, { autohide, delay });
    toast.show();
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
