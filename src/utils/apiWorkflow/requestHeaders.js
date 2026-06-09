import { resolveWorkflowAuthToken } from './authToken.js';

/**
 * Headers for workflow API calls. Authorization is always sent when a token exists.
 * @param {{
 *   vars?: Record<string, unknown>;
 *   method?: string;
 *   bodyType?: string;
 *   hasJsonBody?: boolean;
 * }} options
 */
export function buildWorkflowRequestHeaders({
  vars = {},
  method = 'GET',
  bodyType,
  hasJsonBody = false,
} = {}) {
  const m = String(method).toUpperCase();
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
  };

  const token = resolveWorkflowAuthToken(vars);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const sendsJsonBody =
    hasJsonBody ||
    (m !== 'GET' && m !== 'HEAD' && m !== 'DELETE' && bodyType !== 'form');
  if (sendsJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}
