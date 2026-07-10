import { APP_ENV } from './env.js';

const trimTrailingSlashes = (s) => String(s).replace(/\/+$/, '');

const readEnv = (key, fallback = '') => {
  if (typeof import.meta === 'undefined' || !import.meta.env) return fallback;
  const v = import.meta.env[key];
  return v !== undefined && v !== '' ? String(v) : fallback;
};

/**
 * Resolve API base for fetch/axios.
 * - Dev: `/api` → Vite proxy
 * - Live build with full `VITE_API_BASE_URL` → use as-is
 * - Live at `/pos/` with relative `/api` → `{origin}/pos_admin/api` (not `{origin}/api`)
 */
function resolveApiBaseUrl() {
  const configured = trimTrailingSlashes(readEnv('VITE_API_BASE_URL', '/api'));

  if (/^https?:\/\//i.test(configured)) {
    return configured;
  }

  const relativePath = configured.startsWith('/') ? configured : `/${configured}`;

  if (import.meta.env.DEV) {
    return relativePath;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const { origin } = window.location;
    const appBase = import.meta.env.BASE_URL || '/';
    const onPosDeploy =
      relativePath === '/api' &&
      (appBase.includes('/pos') || window.location.pathname.startsWith('/pos/'));

    if (onPosDeploy) {
      return `${origin}/pos_admin/api`;
    }

    return `${origin}${relativePath}`;
  }

  return relativePath;
}

/**
 * API base path or URL.
 * - local / development: `/api` (Vite proxy → VITE_API_PROXY_TARGET)
 * - live: `VITE_API_BASE_URL` or runtime `/pos_admin/api` on `/pos/` hosts
 */
export const API_BASE_URL = resolveApiBaseUrl();

function resolveApiMediaOrigin() {
  const configured = trimTrailingSlashes(
    readEnv('VITE_API_MEDIA_ORIGIN', readEnv('VITE_API_ORIGIN', ''))
  );
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return API_BASE_URL;
  }
  return configured;
}

/** Backend origin for uploads/media when paths are not under `/api`. */
export const API_MEDIA_ORIGIN = resolveApiMediaOrigin();

/** Dev-server proxy target (vite.config only). */
export const API_PROXY_TARGET = readEnv('VITE_API_PROXY_TARGET', 'http://localhost:8000');

export { APP_ENV };

/** Build a full API URL from a path segment (no leading slash). */
export function buildApiUrl(pathAndQuery = '') {
  const path = String(pathAndQuery).replace(/^\//, '');
  const base = trimTrailingSlashes(API_BASE_URL);
  return path ? `${base}/${path}` : base;
}

/** Full browser URL for dev help text (relative `/api/...` → resolved API base). */
export function formatDisplayApiUrl(url) {
  if (!url) return '';
  const s = String(url);
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/') ? s.slice(1) : s;
  if (path.startsWith('api/')) {
    return buildApiUrl(path.slice(4));
  }
  return buildApiUrl(path);
}

/**
 * Turn API image fields into a URL the browser can load.
 */
export function resolveCategoryMediaUrl(raw) {
  if (raw == null || raw === '') return '';
  if (typeof File !== 'undefined' && raw instanceof File) return '';
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return '';
  let value = raw;
  if (typeof raw === 'object' && raw !== null && 'url' in raw && raw.url != null) {
    value = raw.url;
  }
  const s = String(value);
  if (!s || /^\[object\s/i.test(s)) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith('/') ? s : `/${s.replace(/^\//, '')}`;
  if (path.startsWith('/api/')) {
    return buildApiUrl(path.slice(5));
  }
  if (API_MEDIA_ORIGIN) return `${API_MEDIA_ORIGIN}${path}`;
  return path;
}
