/** Paths to extract bearer token from axios login/signup responses. */
export const AUTH_TOKEN_SAVE_PATHS = [
  'response.data.data.token',
  'response.data.data.access_token',
  'response.data.data.accessToken',
  'response.data.data.jwt',
  'response.data.token',
  'response.data.access_token',
  'response.data.accessToken',
  'response.data.jwt',
  'response.data.data.user.token',
  'response.data.data.user.access_token',
  'response.data.data.user.accessToken',
  'response.data.user.token',
  'response.data.user.access_token',
  'response.data.user.accessToken',
];

/**
 * Token for workflow steps: saved variables first, then app localStorage session.
 * @param {Record<string, unknown>} [vars]
 */
export function resolveWorkflowAuthToken(vars = {}) {
  const fromVars = vars.auth_token ?? vars.token;
  if (typeof fromVars === 'string' && fromVars.trim()) {
    return fromVars.trim();
  }
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('authToken');
    if (typeof stored === 'string' && stored.trim()) {
      return stored.trim();
    }
    try {
      const raw = localStorage.getItem('userData');
      if (raw) {
        const userData = JSON.parse(raw);
        const nested =
          userData?.token ??
          userData?.access_token ??
          userData?.accessToken ??
          userData?.jwt;
        if (typeof nested === 'string' && nested.trim()) {
          return nested.trim();
        }
      }
    } catch {
      /* ignore */
    }
  }
  return '';
}
