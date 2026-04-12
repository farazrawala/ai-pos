// API Configuration
// Use relative URL to leverage Vite proxy and avoid CORS issues
export const API_BASE_URL = '/api';

const trimTrailingSlashes = (s) => String(s).replace(/\/+$/, '');

/**
 * Backend origin for resolving category image URLs stored as paths (e.g. `/uploads/...`)
 * when files are served from the API host, not under `/api`.
 * Optional .env: `VITE_API_MEDIA_ORIGIN` or `VITE_API_ORIGIN` (e.g. http://localhost:8000).
 */
const readMediaOrigin = () => {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  const v = import.meta.env.VITE_API_MEDIA_ORIGIN || import.meta.env.VITE_API_ORIGIN;
  return v ? trimTrailingSlashes(v) : '';
};

export const API_MEDIA_ORIGIN = readMediaOrigin();

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
