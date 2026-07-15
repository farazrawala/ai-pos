import { API_BASE_URL, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
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
 * Default: `GET /api/user/get-all-active?limit=...&skip=...`
 * Adjust `USER_LIST_PATH` if your backend uses a different route.
 */
const USER_LIST_PATH = 'user/get-all-active';

/** POST body for POS quick customer. Change path if your API differs. */
const USER_CREATE_PATH = 'user/create';
const USER_GET_PATH = 'user/get';
const USER_UPDATE_PATH = 'user/update';
const USER_DELETE_PATH = 'user/delete';
const TOTAL_CUSTOMERS_PATH = 'user/total-customers';
const TOTAL_USERS_PATH = 'user/total-users';

export const USER_PROFILE_IMAGE_FIELD = 'profile_image';

/** True for values from `<input type="file">`. */
export function isUserUploadFilePart(value) {
  if (value == null || typeof value !== 'object') return false;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob === 'undefined' || !(value instanceof Blob)) return false;
  if (typeof value.name === 'string') return true;
  return typeof value.lastModified === 'number';
}

function appendUserFieldsToFormData(formData, data = {}) {
  const { profile_image: _file, permissions, role, ...rest } = data;

  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) {
      formData.append(key, '');
      return;
    }
    formData.append(key, typeof value === 'string' ? value : String(value));
  });

  if (Array.isArray(role)) {
    role.forEach((r, index) => {
      formData.append(`role[${index}]`, String(r));
    });
  }

  if (permissions != null) {
    formData.append('permissions', JSON.stringify(permissions));
  }
}

function buildUserUpdateFields(payload = {}) {
  const roleList = Array.isArray(payload.role) ? payload.role : payload.role ? [payload.role] : [];
  const permissions = normalizePermissionsForApi(clonePlainJson(payload.permissions));
  const fields = {
    name: payload.name != null ? String(payload.name) : undefined,
    email: payload.email != null ? String(payload.email) : undefined,
    status: payload.status != null ? String(payload.status) : undefined,
    role: roleList.map((r) => String(r)),
    permissions,
    initial_balance:
      payload.initial_balance != null ? Number(payload.initial_balance) || 0 : undefined,
  };
  if (payload.password != null && String(payload.password).trim()) {
    fields.password = String(payload.password);
  }
  if (payload.phone != null && String(payload.phone).trim() !== '') {
    fields.phone = String(payload.phone).trim();
  }
  return fields;
}

async function patchUserFieldsRequest(userId, fields = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const id = String(userId ?? '').trim();
  if (!id) throw new Error('Missing user id');

  const url = `${BASE_URL}${USER_UPDATE_PATH}/${id}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(fields),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    throw new Error(result.message || result.error || 'Failed to update user');
  }
  return normalizeSingleUserPayload(result) || result;
}

export async function markUserAsDefaultCustomerRequest(userId) {
  return patchUserFieldsRequest(userId, { mark_as_default_customer: true });
}

export async function markUserAsDefaultVendorRequest(userId) {
  return patchUserFieldsRequest(userId, { mark_as_default_vendor: true });
}

export async function updateUserStatusRequest(userId, status) {
  const normalized = String(status || '').trim().toLowerCase() === 'active' ? 'active' : 'inactive';
  return patchUserFieldsRequest(userId, { status: normalized });
}

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
 * Create a tenant customer (role CUSTOMER) for POS / sales forms.
 * Uses FormData `role[0]` so the backend multiselect parser applies CUSTOMER
 * (JSON `role: []` alone can be ignored and Mongoose then defaults to USER).
 */
export async function createCustomerUserRequest({ name, email, phone, password, role }) {
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const roleList = (Array.isArray(role) ? role : role ? [role] : ['CUSTOMER'])
    .map((r) => String(r || '').trim().toUpperCase())
    .filter(Boolean);
  const roles = roleList.length > 0 ? roleList : ['CUSTOMER'];

  const formData = new FormData();
  formData.append('name', String(name || '').trim());
  formData.append('email', resolvePosCustomerEmail(email, phone));
  formData.append('phone', String(phone || '').trim());
  formData.append('password', String(password || POS_DEFAULT_CUSTOMER_PASSWORD));
  formData.append('status', 'active');
  roles.forEach((r, index) => {
    formData.append(`role[${index}]`, r);
  });

  const url = `${BASE_URL}${USER_CREATE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
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
  if (params.role) query.set('role', String(params.role));
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));

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
  if (params.role) query.set('role', String(params.role));
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
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data))
    return result.data;
  if (result.user && typeof result.user === 'object' && !Array.isArray(result.user))
    return result.user;
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

function buildProfileUpdateFields(payload = {}) {
  const fields = {};
  if (payload.name != null) fields.name = String(payload.name).trim();
  if (payload.email != null) fields.email = String(payload.email).trim();
  if (payload.phone != null && String(payload.phone).trim() !== '') {
    fields.phone = String(payload.phone).trim();
  }
  if (payload.password != null && String(payload.password).trim()) {
    fields.password = String(payload.password);
  }
  return fields;
}

function appendProfileFieldsToFormData(formData, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) {
      formData.append(key, '');
      return;
    }
    formData.append(key, typeof value === 'string' ? value : String(value));
  });
}

export function pickUserProfileImageUrl(user) {
  if (!user || typeof user !== 'object') return '';
  const raw =
    user.profile_image ?? user.profileImage ?? user.avatar ?? user.image ?? user.photo ?? '';
  return resolveCategoryMediaUrl(raw);
}

/** PATCH own profile — name, email, phone, password, profile_image only. */
export async function updateProfileRequest(userId, payload = {}) {
  const token = getAuthToken();
  const { profile_image, ...rest } = payload;
  const fields = buildProfileUpdateFields(rest);
  const url = `${BASE_URL}${USER_UPDATE_PATH}/${userId}`;
  const useMultipart = isUserUploadFilePart(profile_image);

  const parseResponse = async (response) => {
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${response.status}`);
    }
    const result = await response.json().catch(() => ({}));
    if (result && result.success === false) {
      throw new Error(result.message || result.error || 'Failed to update profile');
    }
    return normalizeSingleUserPayload(result) || result;
  };

  if (useMultipart) {
    const formData = new FormData();
    appendProfileFieldsToFormData(formData, fields);
    const fileName = profile_image.name || 'upload';
    formData.append(USER_PROFILE_IMAGE_FIELD, profile_image, fileName);

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { method: 'PATCH', headers, body: formData });
    return parseResponse(response);
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(fields),
  });
  return parseResponse(response);
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
  const { profile_image, ...rest } = payload;
  const fields = buildUserUpdateFields(rest);
  const url = `${BASE_URL}${USER_UPDATE_PATH}/${userId}`;
  const useMultipart = isUserUploadFilePart(profile_image);

  if (useMultipart) {
    const formData = new FormData();
    appendUserFieldsToFormData(formData, fields);
    const fileName = profile_image.name || 'upload';
    formData.append(USER_PROFILE_IMAGE_FIELD, profile_image, fileName);

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { method: 'PATCH', headers, body: formData });

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

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(fields),
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

export async function deleteUserRequest(userId) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${USER_DELETE_PATH}/${userId}`;
  const response = await fetch(url, { method: 'DELETE', headers });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
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
    typeof raw === 'number' && Number.isFinite(raw) ? raw : parseInt(String(raw ?? ''), 10);

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
    typeof raw === 'number' && Number.isFinite(raw) ? raw : parseInt(String(raw ?? ''), 10);

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

function userSortName(user) {
  if (!user || typeof user !== 'object') return '';
  return String(user.name || user.fullName || user.username || user.email || '')
    .trim()
    .toLowerCase();
}

/** Ascending by display name (matches users list `sortBy=name`). */
export function compareUsersByNameAsc(a, b) {
  const nameA = userSortName(a);
  const nameB = userSortName(b);
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return getUserOptionValue(a).localeCompare(getUserOptionValue(b));
}

export function sortUsersByNameAsc(users) {
  if (!Array.isArray(users)) return [];
  return users.filter((u) => getUserOptionValue(u)).sort(compareUsersByNameAsc);
}

export function getFirstCustomerUserId(users) {
  if (!Array.isArray(users)) return '';
  const first = users.find((u) => getUserOptionValue(u));
  return first ? getUserOptionValue(first) : '';
}

export function userHasRole(user, roleName) {
  const roles = Array.isArray(user?.role) ? user.role : user?.role ? [user.role] : [];
  return roles.some((r) => String(r).toUpperCase() === String(roleName).toUpperCase());
}

export function isDefaultCustomerUser(user) {
  return Boolean(user?.mark_as_default_customer);
}

export function isDefaultVendorUser(user) {
  return Boolean(user?.mark_as_default_vendor);
}

/** Prefer `mark_as_default_customer`, else first customer in API order. */
export function getDefaultPosCustomerUserId(users) {
  if (!Array.isArray(users)) return '';
  const marked = users.find((u) => isDefaultCustomerUser(u) && getUserOptionValue(u));
  if (marked) return getUserOptionValue(marked);
  return getFirstCustomerUserId(users);
}
