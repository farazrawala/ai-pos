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
