/** True when a prior login left auth data in localStorage (offline session). */
export function hasCachedAuthSession() {
  if (typeof window === 'undefined') return false;
  try {
    const token = localStorage.getItem('authToken');
    if (token && String(token).trim()) return true;
    const userData = localStorage.getItem('userData');
    if (!userData) return false;
    const user = JSON.parse(userData);
    return Boolean(user && (user._id || user.id || user.email || user.name));
  } catch {
    return false;
  }
}

export const OFFLINE_SIGN_IN_MESSAGE = 'Connect to the internet to sign in';
