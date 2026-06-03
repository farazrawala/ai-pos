import { API_BASE_URL } from '../../config/apiConfig.js';
import { PERMISSION_ACTIONS, PERMISSION_MODULE_KEYS } from '../../constants/permissionModules.js';

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
 * Default: `GET /api/user/get-all-active?include_inactive=true&...`
 * Adjust `USER_LIST_PATH` if your backend uses a different route.
 */
const USER_LIST_PATH = 'user/get-all-active';

/** POST body for POS quick customer. Change path if your API differs. */
const USER_CREATE_PATH = 'user/create';
const USER_GET_PATH = 'user/get';
const USER_UPDATE_PATH = 'user/update';
const TOTAL_CUSTOMERS_PATH = 'user/total-customers';
const TOTAL_USERS_PATH = 'user/total-users';

/** Must match user add/edit forms (`PERMISSION_MODULE_KEYS` / `PERMISSION_ACTIONS`). */

function clonePlainJson(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? {}));
  } catch {
    return {};
  }
}

/**
 * Full permission grid with explicit booleans so JSON does not drop keys and the API never sees “missing” flags as false-only defaults by mistake.
 */
export function normalizePermissionsForApi(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const m of PERMISSION_MODULE_KEYS) {
    out[m] = {};
    for (const a of PERMISSION_ACTIONS) {
      const v = input[m]?.[a];
      out[m][a] = Boolean(v === true || v === 'true' || v === 1 || v === '1');
    }
  }
  return out;
}

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
 * Create a user with role CUSTOMER (POS). Expects auth like other management APIs.
 * Sends `role: ['CUSTOMER']` (backend `role[0]`).
 */
export async function createCustomerUserRequest({ name, email, phone, password, role }) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const roleList = Array.isArray(role) ? role : role ? [role] : ['CUSTOMER'];
  const body = {
    name: String(name || '').trim(),
    email: resolvePosCustomerEmail(email, phone),
    phone: String(phone || '').trim(),
    password: String(password || POS_DEFAULT_CUSTOMER_PASSWORD),
    role: roleList.map((r) => String(r)),
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
  query.set('include_inactive', 'true');
  const limit = params.limit ?? 2000;
  const skip = params.skip ?? 0;
  query.set('limit', String(limit));
  query.set('skip', String(skip));
  if (params.role) query.set('role', String(params.role));

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

export async function fetchUsersRequest(params = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = new URLSearchParams();
  query.set('include_inactive', 'true');
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    query.set('skip', String(skip));
  } else if (params.skip != null) {
    query.set('skip', String(params.skip));
  }
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', String(params.search));
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));

  const queryString = query.toString();
  const url = `${BASE_URL}${USER_LIST_PATH}?${queryString}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  const data = normalizeUsersPayload(result);

  if (result?.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const limit = Number(pagination.limit || params.limit || 10);
    const skip = Number(pagination.skip || 0);
    const total = Number(pagination.total || data.length || 0);
    return {
      data,
      total,
      page: limit > 0 ? Math.floor(skip / limit) + 1 : 1,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  const fallbackLimit = Number(params.limit || result?.limit || 10);
  const fallbackTotal = Number(result?.total || data.length || 0);
  return {
    data,
    total: fallbackTotal,
    page: Number(params.page || result?.page || 1),
    limit: fallbackLimit,
    totalPages: fallbackLimit > 0 ? Math.ceil(fallbackTotal / fallbackLimit) : 0,
  };
}

const normalizeSingleUserPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) return result.data;
  if (result.user && typeof result.user === 'object' && !Array.isArray(result.user)) return result.user;
  if (result._id || result.id) return result;
  return null;
};

export async function fetchUserByIdRequest(userId) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${USER_GET_PATH}/${userId}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const result = await response.json();
  const user = normalizeSingleUserPayload(result);
  if (!user) {
    throw new Error('Invalid user response format');
  }
  return user;
}

export async function createUserRequest(payload = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const roleList = Array.isArray(payload.role) ? payload.role : payload.role ? [payload.role] : [];
  const permissions = normalizePermissionsForApi(clonePlainJson(payload.permissions));
  const body = {
    name: payload.name != null ? String(payload.name) : '',
    email: payload.email != null ? String(payload.email) : '',
    password: payload.password != null ? String(payload.password) : '',
    status: payload.status != null ? String(payload.status) : 'active',
    role: roleList.map((r) => String(r)),
    initial_balance:
      payload.initial_balance != null ? Number(payload.initial_balance) || 0 : undefined,
    permissions,
  };
  if (payload.phone != null && String(payload.phone).trim() !== '') {
    body.phone = String(payload.phone).trim();
  }

  const url = `${BASE_URL}${USER_CREATE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const result = await response.json().catch(() => ({}));
  return normalizeSingleUserPayload(result) || result;
}

export async function updateUserRequest(userId, payload = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const roleList = Array.isArray(payload.role) ? payload.role : payload.role ? [payload.role] : [];
  const permissions = normalizePermissionsForApi(clonePlainJson(payload.permissions));
  const body = {
    name: payload.name != null ? String(payload.name) : undefined,
    email: payload.email != null ? String(payload.email) : undefined,
    status: payload.status != null ? String(payload.status) : undefined,
    role: roleList.map((r) => String(r)),
    permissions,
    initial_balance:
      payload.initial_balance != null ? Number(payload.initial_balance) || 0 : undefined,
  };
  if (payload.password != null && String(payload.password).trim()) {
    body.password = String(payload.password);
  }
  if (payload.phone != null && String(payload.phone).trim() !== '') {
    body.phone = String(payload.phone).trim();
  }

  const url = `${BASE_URL}${USER_UPDATE_PATH}/${userId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    throw new Error(result.message || result.error || 'Failed to update user');
  }
  return normalizeSingleUserPayload(result) || result;
}

/**
 * GET `user/total-customers` — `{ success, customer_count }`.
 */
export async function fetchTotalCustomersRequest() {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${TOTAL_CUSTOMERS_PATH}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    throw new Error(result.message || 'Could not load customer count');
  }

  const raw = result.customer_count ?? result.customerCount ?? result.total ?? result.count;
  const customerCount =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseInt(String(raw ?? ''), 10);

  return {
    customerCount: Number.isFinite(customerCount) ? customerCount : 0,
  };
}

/**
 * GET `user/total-users` — `{ success, user_count }`.
 */
export async function fetchTotalUsersRequest() {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${TOTAL_USERS_PATH}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    throw new Error(result.message || 'Could not load user count');
  }

  const raw = result.user_count ?? result.userCount ?? result.total ?? result.count;
  const userCount =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseInt(String(raw ?? ''), 10);

  return {
    userCount: Number.isFinite(userCount) ? userCount : 0,
  };
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
