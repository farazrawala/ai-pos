import { API_BASE_URL, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { isUserUploadFilePart } from '../users/usersAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

export const INTEGRATION_IMAGE_FIELD = 'image';

const logIntegrationModuleError = (operation, details) => {
  console.error(`[Integration module] ${operation}`, details);
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

const appendIntegrationFieldsToFormData = (formData, data = {}) => {
  Object.entries(data).forEach(([key, value]) => {
    if (key === INTEGRATION_IMAGE_FIELD) return;
    if (value === undefined) return;
    if (value === null) {
      formData.append(key, '');
      return;
    }
    formData.append(key, typeof value === 'string' ? value : String(value));
  });
};

const authHeadersForMultipart = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const postIntegrationRequest = async (url, integrationData) => {
  const { image, ...rest } = integrationData || {};
  const useMultipart = isUserUploadFilePart(image);

  if (useMultipart) {
    const formData = new FormData();
    appendIntegrationFieldsToFormData(formData, rest);
    const fileName = image.name || 'upload';
    formData.append(INTEGRATION_IMAGE_FIELD, image, fileName);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: authHeadersForMultipart(),
        body: formData,
      });
    } catch (err) {
      logIntegrationModuleError('postIntegrationRequest network error (multipart)', {
        url,
        error: err,
      });
      throw err;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP error! status: ${response.status}`;
      logIntegrationModuleError('postIntegrationRequest failed (multipart)', {
        status: response.status,
        errorData,
        message,
      });
      throw new Error(message);
    }

    return response.json();
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(rest),
    });
  } catch (err) {
    logIntegrationModuleError('postIntegrationRequest network error', {
      url,
      payloadKeys: Object.keys(rest || {}),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('postIntegrationRequest failed', {
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  return response.json();
};

const patchIntegrationRequest = async (url, integrationData) => {
  const { image, ...rest } = integrationData || {};
  const useMultipart = isUserUploadFilePart(image);

  if (useMultipart) {
    const formData = new FormData();
    appendIntegrationFieldsToFormData(formData, rest);
    const fileName = image.name || 'upload';
    formData.append(INTEGRATION_IMAGE_FIELD, image, fileName);

    let response;
    try {
      response = await fetch(url, {
        method: 'PATCH',
        headers: authHeadersForMultipart(),
        body: formData,
      });
    } catch (err) {
      logIntegrationModuleError('patchIntegrationRequest network error (multipart)', {
        url,
        error: err,
      });
      throw err;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP error! status: ${response.status}`;
      logIntegrationModuleError('patchIntegrationRequest failed (multipart)', {
        status: response.status,
        errorData,
        message,
      });
      throw new Error(message);
    }

    return response.json();
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(rest),
    });
  } catch (err) {
    logIntegrationModuleError('patchIntegrationRequest network error', { url, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('patchIntegrationRequest failed', {
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  return response.json();
};

export const pickIntegrationStoreLogoUrl = (record) => {
  if (!record || typeof record !== 'object') return '';
  const raw =
    record.image ?? record.store_logo ?? record.storeLogo ?? record.logo ?? '';
  return resolveCategoryMediaUrl(raw);
};

const parsePaginatedResponse = (result, params = {}) => {
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.integrations || [];
    const page = pagination.limit > 0 ? Math.floor(pagination.skip / pagination.limit) + 1 : 1;
    const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;
    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page,
      limit: pagination.limit || params.limit || 10,
      totalPages,
    };
  }

  const data = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.integrations)
      ? result.integrations
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

export const fetchIntegrationsRequest = async (params = {}) => {
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
  const url = `${BASE_URL}integration/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logIntegrationModuleError('fetchIntegrationsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('fetchIntegrationsRequest failed', {
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

export const fetchIntegrationByIdRequest = async (integrationId) => {
  const url = `${BASE_URL}integration/get/${integrationId}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logIntegrationModuleError('fetchIntegrationByIdRequest network error', {
      integrationId,
      url,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('fetchIntegrationByIdRequest failed', {
      integrationId,
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  return response.json();
};

export const createIntegrationRequest = async (integrationData) => {
  const url = `${BASE_URL}integration/create`;
  return postIntegrationRequest(url, integrationData);
};

export const updateIntegrationRequest = async (integrationId, integrationData) => {
  const url = `${BASE_URL}integration/update/${integrationId}`;
  return patchIntegrationRequest(url, integrationData);
};

export const deleteIntegrationRequest = async (integrationId) => {
  const url = `${BASE_URL}integration/delete/${integrationId}`;

  let response;
  try {
    response = await fetch(url, { method: 'DELETE', headers: getHeaders() });
  } catch (err) {
    logIntegrationModuleError('deleteIntegrationRequest network error', { integrationId, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('deleteIntegrationRequest failed', {
      integrationId,
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
