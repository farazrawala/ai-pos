import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logSyncBrandModuleError = (operation, details) => {
  console.error(`[Sync brand module] ${operation}`, details);
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

export const fetchSyncBrandsRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.brand_id) queryParams.append('brand_id', params.brand_id);
  if (params.populate) queryParams.append('populate', params.populate);
  if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}sync_brand/get-all${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logSyncBrandModuleError('fetchSyncBrandsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncBrandModuleError('fetchSyncBrandsRequest failed', {
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
    : Array.isArray(result.sync_brands)
      ? result.sync_brands
      : [];

  return {
    data,
    total: result.pagination?.total ?? data.length,
  };
};

export const updateSyncBrandRequest = async (syncBrandId, syncBrandData = {}) => {
  const id = String(syncBrandId || '').trim();
  if (!id) throw new Error('Sync brand id is required');

  const url = `${BASE_URL}sync_brand/update/${encodeURIComponent(id)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(syncBrandData),
    });
  } catch (err) {
    logSyncBrandModuleError('updateSyncBrandRequest network error', {
      url,
      syncBrandId: id,
      syncBrandData,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncBrandModuleError('updateSyncBrandRequest failed', {
      status: response.status,
      syncBrandId: id,
      syncBrandData,
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
