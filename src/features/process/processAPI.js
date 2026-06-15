import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logProcessModuleError = (operation, details) => {
  console.error(`[Process module] ${operation}`, details);
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

const parsePaginatedResponse = (result, params = {}) => {
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.processes || [];
    const limit = pagination.limit || params.limit || 10;
    const page =
      limit > 0 && pagination.skip != null
        ? Math.floor(pagination.skip / limit) + 1
        : params.page || 1;
    const totalPages = limit > 0 ? Math.ceil((pagination.total || 0) / limit) : 1;

    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page,
      limit,
      totalPages,
    };
  }

  const data = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.processes)
      ? result.processes
      : Array.isArray(result)
        ? result
        : [];
  const total = result.total || data.length;
  const limit = result.limit || params.limit || 10;
  return {
    data,
    total,
    page: result.page || params.page || 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const fetchProcessesRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', skip);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}process/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logProcessModuleError('fetchProcessesRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logProcessModuleError('fetchProcessesRequest failed', {
      status: response.status,
      params,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  return parsePaginatedResponse(result, params);
};

export const createProcessRequest = async (processData = {}) => {
  const url = `${BASE_URL}process/create`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(processData),
    });
  } catch (err) {
    logProcessModuleError('createProcessRequest network error', { url, processData, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logProcessModuleError('createProcessRequest failed', {
      status: response.status,
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

export const createSyncCategoryProcessRequest = async (integrationId) =>
  createProcessRequest({
    integration_id: integrationId,
    action: 'sync_category',
    priority: 1000,
  });

export const bulkCreateProcessRequest = async (processData = {}) => {
  const url = `${BASE_URL}process/bulk-create`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(processData),
    });
  } catch (err) {
    logProcessModuleError('bulkCreateProcessRequest network error', { url, processData, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logProcessModuleError('bulkCreateProcessRequest failed', {
      status: response.status,
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

export const createBulkSyncCategoryProcessRequest = async (integrationId, categoryIds = []) =>
  bulkCreateProcessRequest({
    integration_id: integrationId,
    action: 'sync_category',
    status: 'active',
    priority: 100,
    category_ids: categoryIds,
  });

export const createSyncBrandProcessRequest = async (integrationId) =>
  createProcessRequest({
    integration_id: integrationId,
    action: 'sync_brand',
    priority: 1000,
  });

export const createBulkSyncBrandProcessRequest = async (integrationId, brandIds = []) =>
  bulkCreateProcessRequest({
    integration_id: integrationId,
    action: 'sync_brand',
    status: 'active',
    priority: 100,
    brand_ids: brandIds,
  });

export const executeProcessRequest = async (processId) => {
  const id = String(processId || '').trim();
  if (!id) throw new Error('Process id is required');

  const url = `${BASE_URL}process/execute-process/${encodeURIComponent(id)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
    });
  } catch (err) {
    logProcessModuleError('executeProcessRequest network error', { url, processId: id, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logProcessModuleError('executeProcessRequest failed', {
      status: response.status,
      processId: id,
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
