import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logSyncOrderModuleError = (operation, details) => {
  console.error(`[Sync order module] ${operation}`, details);
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

export const fetchSyncOrdersRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.order_id) queryParams.append('order_id', params.order_id);
  if (params.populate) queryParams.append('populate', params.populate);
  if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}sync_order/get-all${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logSyncOrderModuleError('fetchSyncOrdersRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncOrderModuleError('fetchSyncOrdersRequest failed', {
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
    : Array.isArray(result.sync_orders)
      ? result.sync_orders
      : [];

  return {
    data,
    total: result.pagination?.total ?? data.length,
  };
};

export const updateSyncOrderRequest = async (syncOrderId, syncOrderData = {}) => {
  const id = String(syncOrderId || '').trim();
  if (!id) throw new Error('Sync order id is required');

  const url = `${BASE_URL}sync_order/update/${encodeURIComponent(id)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(syncOrderData),
    });
  } catch (err) {
    logSyncOrderModuleError('updateSyncOrderRequest network error', {
      url,
      syncOrderId: id,
      syncOrderData,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncOrderModuleError('updateSyncOrderRequest failed', {
      status: response.status,
      syncOrderId: id,
      syncOrderData,
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
