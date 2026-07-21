/** Cookie names shared with the Store Sync WhatsApp extension. */
export const POS_AUTH_TOKEN_COOKIE = 'pos_auth_token';
export const POS_COMPANY_ID_COOKIE = 'pos_company_id';
export const POS_COMPANY_NAME_COOKIE = 'pos_company_name';

const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function cookieBaseAttrs() {
  if (typeof window === 'undefined') return 'path=/; max-age=0';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function setCookie(name, value) {
  const base = cookieBaseAttrs();
  const text = String(value || '').trim();
  if (text) {
    document.cookie = `${name}=${encodeURIComponent(text)}; ${base}`;
  } else {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/**
 * Persist auth for the browser extension (reads cookies on the POS origin).
 * Keeps localStorage as the primary store; cookies mirror the session for cross-context access.
 */
export function setAuthCookies({ token, companyId, companyName } = {}) {
  if (typeof document === 'undefined') return;
  setCookie(POS_AUTH_TOKEN_COOKIE, token);
  setCookie(POS_COMPANY_ID_COOKIE, companyId);
  setCookie(POS_COMPANY_NAME_COOKIE, companyName);
}

/** Remove extension auth cookies (logout). */
export function clearAuthCookies() {
  if (typeof document === 'undefined') return;
  const expire = 'path=/; max-age=0; SameSite=Lax';
  document.cookie = `${POS_AUTH_TOKEN_COOKIE}=; ${expire}`;
  document.cookie = `${POS_COMPANY_ID_COOKIE}=; ${expire}`;
  document.cookie = `${POS_COMPANY_NAME_COOKIE}=; ${expire}`;
}

function readCompanyNameFromStorage() {
  try {
    const raw = localStorage.getItem('companyData');
    if (raw) {
      const company = JSON.parse(raw);
      return String(company?.company_name ?? company?.name ?? '').trim();
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem('userData');
    if (raw) {
      const user = JSON.parse(raw);
      const ref = user?.company_id ?? user?.company;
      if (ref && typeof ref === 'object') {
        return String(ref?.company_name ?? ref?.name ?? '').trim();
      }
    }
  } catch {
    // ignore
  }
  return '';
}

/** Sync cookies from an existing localStorage session (e.g. after refresh). */
export function syncAuthCookiesFromStorage() {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('authToken') || '';
  let companyId = '';
  try {
    const raw = localStorage.getItem('companyData');
    if (raw) {
      const company = JSON.parse(raw);
      companyId = String(company?._id ?? company?.id ?? '').trim();
    }
  } catch {
    // ignore
  }
  if (!companyId) {
    try {
      const raw = localStorage.getItem('userData');
      if (raw) {
        const user = JSON.parse(raw);
        const ref = user?.company_id ?? user?.company;
        companyId =
          typeof ref === 'object'
            ? String(ref?._id ?? ref?.id ?? '').trim()
            : String(ref || '').trim();
      }
    } catch {
      // ignore
    }
  }
  const companyName = readCompanyNameFromStorage();
  if (token || companyId) {
    setAuthCookies({ token, companyId, companyName });
  } else {
    clearAuthCookies();
  }
}
