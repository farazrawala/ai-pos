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

/** True when running as an installed PWA / desktop app window (not a normal browser tab). */
export function isInstalledAppDisplay() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  } catch {
    /* ignore */
  }
  // Legacy iOS home-screen web apps
  return window.navigator?.standalone === true;
}

/**
 * Open an in-app path in a real browser tab.
 *
 * Avoids two PWA pitfalls:
 * 1) `window.open(..., 'noopener')` returns null in Chromium and used to fall back to
 *    navigating the current app window.
 * 2) Installed PWAs capture same-origin `target=_blank` / `window.open` into the desktop
 *    app — even from a normal browser tab when "Open in app" is enabled — so we prefer OS
 *    browser protocol handlers (Chrome/Edge) whenever possible.
 */
export function openAppPathInNewTab(path = '') {
  if (typeof window === 'undefined') return null;
  const href = absoluteAppUrl(path);

  const ua = String(navigator.userAgent || '');
  const isEdge = /\bEdg\//.test(ua);
  const isChrome = /\bChrome\//.test(ua) && !isEdge && !/\bOPR\//.test(ua);

  // Force the system browser so Chromium link-capturing cannot hand off to the PWA.
  if (isEdge) {
    const edgeWin = window.open(`microsoft-edge:${href}`, '_blank');
    if (edgeWin) return edgeWin;
  }
  if (isChrome) {
    const chromeWin = window.open(`googlechrome:${href}`, '_blank');
    if (chromeWin) return chromeWin;
  }

  // Do NOT put noopener/noreferrer in the features string — Chromium then returns null
  // even when the tab opened, which previously caused a same-window navigation fallback.
  const win = window.open(href, '_blank');
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }
    return win;
  }

  // Popup blocked: last resort (may stay in the current window / get captured by PWA).
  window.location.assign(href);
  return null;
}

/** POS invoice route — avoids `/pos/pos/invoice` when the app basename is `/pos`. */
export function posInvoiceRoutePath(invoiceId) {
  const id = String(invoiceId ?? '').trim();
  if (!id) return ROUTER_BASENAME ? '/invoice' : '/pos/invoice';
  const encoded = encodeURIComponent(id);
  return ROUTER_BASENAME ? `/invoice/${encoded}` : `/pos/invoice/${encoded}`;
}
