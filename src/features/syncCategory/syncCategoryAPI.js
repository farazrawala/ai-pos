import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logSyncCategoryModuleError = (operation, details) => {
  console.error(`[Sync category module] ${operation}`, details);
};

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

export const fetchSyncCategoriesRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.category_id) queryParams.append('category_id', params.category_id);
  if (params.populate) queryParams.append('populate', params.populate);
  if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}sync_category/get-all${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logSyncCategoryModuleError('fetchSyncCategoriesRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncCategoryModuleError('fetchSyncCategoriesRequest failed', {
      status: response.status,
      params,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  const data = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.sync_categories)
      ? result.sync_categories
      : [];

  return {
    data,
    total: result.pagination?.total ?? data.length,
  };
};

export const updateSyncCategoryRequest = async (syncCategoryId, syncCategoryData = {}) => {
  const id = String(syncCategoryId || '').trim();
  if (!id) throw new Error('Sync category id is required');

  const url = `${BASE_URL}sync_category/update/${encodeURIComponent(id)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(syncCategoryData),
    });
  } catch (err) {
    logSyncCategoryModuleError('updateSyncCategoryRequest network error', {
      url,
      syncCategoryId: id,
      syncCategoryData,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncCategoryModuleError('updateSyncCategoryRequest failed', {
      status: response.status,
      syncCategoryId: id,
      syncCategoryData,
      errorData,
      message,
    });
    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
};
