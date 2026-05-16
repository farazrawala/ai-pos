import { APP_ENV } from './env.js';

const trimTrailingSlashes = (s) => String(s).replace(/\/+$/, '');

const readEnv = (key, fallback = '') => {
  if (typeof import.meta === 'undefined' || !import.meta.env) return fallback;
  const v = import.meta.env[key];
  return v !== undefined && v !== '' ? String(v) : fallback;
};

/**
 * API base path or URL.
 * - local / development: `/api` (Vite proxy → VITE_API_PROXY_TARGET)
 * - live: full URL from VITE_API_BASE_URL
 */
export const API_BASE_URL = readEnv('VITE_API_BASE_URL', '/api');

/** Backend origin for uploads/media when paths are not under `/api`. */
export const API_MEDIA_ORIGIN = trimTrailingSlashes(
  readEnv('VITE_API_MEDIA_ORIGIN', readEnv('VITE_API_ORIGIN', ''))
);

/** Dev-server proxy target (vite.config only). */
export const API_PROXY_TARGET = readEnv('VITE_API_PROXY_TARGET', 'http://localhost:8000');

export { APP_ENV };

/**
 * Turn API image fields into a URL the browser can load.
 */
export function resolveCategoryMediaUrl(raw) {
  if (raw == null || raw === '') return '';
  let value = raw;
  if (typeof raw === 'object' && raw !== null && 'url' in raw && raw.url != null) {
    value = raw.url;
  }
  const s = String(value);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/') ? s : `/${s.replace(/^\//, '')}`;
  if (path.startsWith('/api/')) return path;
  if (API_MEDIA_ORIGIN) return `${API_MEDIA_ORIGIN}${path}`;
  return path;
}
