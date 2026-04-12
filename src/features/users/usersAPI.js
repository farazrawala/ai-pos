import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const normalizeUsersPayload = (result) => {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.users)) return result.users;
  if (Array.isArray(result.user)) return result.user;
  return [];
};

/**
 * GET list of users for POS / admin dropdowns.
 * Default path: `GET /api/user/get-all-active` (same style as categories).
 * Adjust `USER_LIST_PATH` if your backend uses a different route.
 */
const USER_LIST_PATH = 'user/get-all-active';

/** POST body for POS quick customer. Change path if your API differs. */
const USER_CREATE_PATH = 'user/create';

/** Default password sent for POS-created customers (hidden in UI). */
export const POS_DEFAULT_CUSTOMER_PASSWORD = '123456';

/** Digits only from phone (for synthetic email local part). */
export function digitsOnlyFromPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * POS customer email: use trimmed input if valid; otherwise `{digits}@gmail.com` from phone.
 */
export function resolvePosCustomerEmail(email, phone) {
  const trimmed = String(email || '').trim();
  if (trimmed) {
    return trimmed;
  }
  const digits = digitsOnlyFromPhone(phone);
  if (!digits) {
    return `customer_${Date.now()}@gmail.com`;
  }
  return `${digits}@gmail.com`;
}

export function pickCreatedUserFromResponse(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.user != null && typeof result.user === 'object') {
    return result.user;
  }
  if (result._id || result.id) {
    return result;
  }
  return null;
}

/**
 * Create a user with role customer (POS). Expects auth like other management APIs.
 */
export async function createCustomerUserRequest({ name, email, phone, password }) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const body = {
    name: String(name || '').trim(),
    email: resolvePosCustomerEmail(email, phone),
    phone: String(phone || '').trim(),
    password: String(password || POS_DEFAULT_CUSTOMER_PASSWORD),
    role: 'customer',
  };

  const url = `${BASE_URL}${USER_CREATE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = errBody;
    throw error;
  }

  return response.json().catch(() => ({}));
}

export async function fetchUsersListRequest(params = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = new URLSearchParams();
  const limit = params.limit ?? 2000;
  const skip = params.skip ?? 0;
  query.set('limit', String(limit));
  query.set('skip', String(skip));

  const url = `${BASE_URL}${USER_LIST_PATH}?${query.toString()}`;

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  return normalizeUsersPayload(result);
}

export function formatUserOptionLabel(user) {
  if (!user || typeof user !== 'object') return '';
  const name = user.name || user.fullName || user.username || '';
  const mobile = user.mobile || user.phone || user.phoneNumber || '';
  const email = user.email || '';
  if (name && mobile) return `${name} — ${mobile}`;
  if (name && email) return `${name} — ${email}`;
  if (name) return name;
  if (mobile) return mobile;
  if (email) return email;
  return String(user._id || user.id || '');
}

export function getUserOptionValue(user) {
  if (!user || typeof user !== 'object') return '';
  return String(user._id ?? user.id ?? user.user_id ?? '');
}
