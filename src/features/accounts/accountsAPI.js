import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const ACCOUNT_LIST_PATH = 'account/get-all-active';
const ACCOUNT_GET_PATH = 'account/get';
const ACCOUNT_CREATE_PATH = 'account/custom-create';
const ACCOUNT_UPDATE_PATH = 'account/custom-update';
const ACCOUNT_DELETE_PATH = 'account/delete';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const normalizeAccountsPayload = (result) => {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.accounts)) return result.accounts;
  if (Array.isArray(result.account)) return result.account;
  if (Array.isArray(result)) return result;
  return [];
};

export async function fetchAccountsRequest(params = {}) {
  const query = new URLSearchParams();
  if (params.page && params.limit) {
    query.set('skip', String((params.page - 1) * params.limit));
  } else if (params.skip != null) {
    query.set('skip', String(params.skip));
  }
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.search) query.set('search', String(params.search));
  if (params.account_type) query.set('account_type', String(params.account_type));
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));

  const queryString = query.toString();
  const url = `${BASE_URL}${ACCOUNT_LIST_PATH}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  const data = normalizeAccountsPayload(result);

  if (result.pagination && typeof result.pagination === 'object') {
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

  const fallbackLimit = Number(params.limit || result.limit || 10);
  const fallbackTotal = Number(result.total || data.length || 0);
  return {
    data,
    total: fallbackTotal,
    page: Number(params.page || result.page || 1),
    limit: fallbackLimit,
    totalPages: fallbackLimit > 0 ? Math.ceil(fallbackTotal / fallbackLimit) : 0,
  };
}

const normalizeSingleAccountPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data))
    return result.data;
  if (result.account && typeof result.account === 'object' && !Array.isArray(result.account)) {
    return result.account;
  }
  if (result._id || result.id) return result;
  return null;
};

export async function fetchAccountByIdRequest(accountId) {
  const response = await fetch(`${BASE_URL}${ACCOUNT_GET_PATH}/${accountId}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  const result = await response.json().catch(() => ({}));
  const account = normalizeSingleAccountPayload(result);
  if (!account) {
    throw new Error('Invalid account response format');
  }
  return account;
}

export async function updateAccountRequest(accountId, accountData = {}) {
  const response = await fetch(`${BASE_URL}${ACCOUNT_UPDATE_PATH}/${accountId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(accountData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  const result = await response.json().catch(() => ({}));
  return normalizeSingleAccountPayload(result) || result;
}

export async function createAccountRequest(accountData = {}) {
  const response = await fetch(`${BASE_URL}${ACCOUNT_CREATE_PATH}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(accountData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  const result = await response.json().catch(() => ({}));
  return normalizeSingleAccountPayload(result) || result;
}

export async function deleteAccountRequest(accountId) {
  const response = await fetch(`${BASE_URL}${ACCOUNT_DELETE_PATH}/${accountId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}
