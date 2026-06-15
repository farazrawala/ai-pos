import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logBrandModuleError = (operation, details) => {
  console.error(`[Brand module] ${operation}`, details);
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
    const data = result.data || result.brands || [];
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
    : Array.isArray(result.brands)
      ? result.brands
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
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const fetchBrandsRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.populate) queryParams.append('populate', params.populate);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}brands/get-all${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logBrandModuleError('fetchBrandsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logBrandModuleError('fetchBrandsRequest failed', {
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

export const fetchBrandByIdRequest = async (brandId) => {
  const url = `${BASE_URL}brands/get/${encodeURIComponent(brandId)}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logBrandModuleError('fetchBrandByIdRequest network error', { brandId, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logBrandModuleError('fetchBrandByIdRequest failed', { brandId, status: response.status, errorData, message });
    throw new Error(message);
  }

  return response.json();
};

export const createBrandRequest = async (brandData = {}) => {
  const url = `${BASE_URL}brands/create`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(brandData),
    });
  } catch (err) {
    logBrandModuleError('createBrandRequest network error', { url, brandData, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logBrandModuleError('createBrandRequest failed', { status: response.status, errorData, message });
    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
};

export const updateBrandRequest = async (brandId, brandData = {}) => {
  const url = `${BASE_URL}brands/update/${encodeURIComponent(brandId)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(brandData),
    });
  } catch (err) {
    logBrandModuleError('updateBrandRequest network error', { brandId, url, brandData, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logBrandModuleError('updateBrandRequest failed', { brandId, status: response.status, errorData, message });
    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
};

export const deleteBrandRequest = async (brandId) => {
  const url = `${BASE_URL}brands/delete/${encodeURIComponent(brandId)}`;

  let response;
  try {
    response = await fetch(url, { method: 'DELETE', headers: getHeaders() });
  } catch (err) {
    logBrandModuleError('deleteBrandRequest network error', { brandId, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logBrandModuleError('deleteBrandRequest failed', { brandId, status: response.status, errorData, message });
    throw new Error(message);
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
};
