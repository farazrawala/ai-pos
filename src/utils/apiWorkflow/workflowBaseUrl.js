import { API_BASE_URL } from '../../config/apiConfig.js';

/**
 * Base URL for workflow `{{url}}` tokens. Step paths are written as `{{url}}api/...`.
 * - Dev (`VITE_API_BASE_URL=/api`): `http://localhost:5173/` → `/api/...` via Vite proxy
 * - Live (`.../pos_admin/api`): `https://host/pos_admin/` → `.../pos_admin/api/...`
 */
export function getWorkflowBaseUrl() {
  const apiBase = String(API_BASE_URL || '/api')
    .trim()
    .replace(/\/+$/, '');

  if (/^https?:\/\//i.test(apiBase)) {
    if (apiBase.endsWith('/api')) {
      return `${apiBase.slice(0, -4)}/`;
    }
    return `${apiBase}/`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }

  return 'http://localhost/';
}

/** @param {Record<string, unknown>} varsSnapshot @param {string} [baseUrlRaw] */
export function buildWorkflowInterpVars(varsSnapshot, baseUrlRaw) {
  const b = (baseUrlRaw ?? '').trim();
  const url = (b === '' ? getWorkflowBaseUrl() : b).replace(/\/?$/, '/');
  return { url, ...varsSnapshot };
}
