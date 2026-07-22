/** Vite `base` (e.g. `/` or `/pos/`). Always ends with `/`. */
export const APP_BASE_URL = import.meta.env.BASE_URL || '/';

/** React Router `basename` (no trailing slash). */
export const ROUTER_BASENAME =
  APP_BASE_URL === '/' ? '' : APP_BASE_URL.replace(/\/+$/, '');

/** Prefix a root-relative path with the app base (for static assets, external links). */
export function withBase(path = '') {
  if (path == null || path === '') {
    return APP_BASE_URL.replace(/\/+$/, '') || '/';
  }
  const s = String(path);
  if (/^https?:\/\//i.test(s)) return s;
  const normalized = s.startsWith('/') ? s.slice(1) : s;
  return `${APP_BASE_URL}${normalized}`.replace(/([^:]\/)\/+/g, '$1');
}

/** Absolute http(s) URL for an in-app path (uses current origin). */
export function absoluteAppUrl(path = '') {
  if (typeof window === 'undefined') return withBase(path);
  return new URL(withBase(path), window.location.origin).href;
}

/**
 * Open an in-app path in a new browser tab.
 * Prefer this over relative `target="_blank"` so installed PWAs are less likely to steal the navigation.
 */
export function openAppPathInNewTab(path = '') {
  const href = absoluteAppUrl(path);
  const win = window.open(href, '_blank', 'noopener,noreferrer');
  if (!win) {
    window.location.assign(href);
  }
  return win;
}

/** POS invoice route — avoids `/pos/pos/invoice` when the app basename is `/pos`. */
export function posInvoiceRoutePath(invoiceId) {
  const id = String(invoiceId ?? '').trim();
  if (!id) return ROUTER_BASENAME ? '/invoice' : '/pos/invoice';
  const encoded = encodeURIComponent(id);
  return ROUTER_BASENAME ? `/invoice/${encoded}` : `/pos/invoice/${encoded}`;
}
