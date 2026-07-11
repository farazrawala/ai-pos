import { API_BASE_URL, resolveCategoryMediaUrl } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

export const INTEGRATION_IMAGE_FIELD = 'image';

/** True for values from `<input type="file">`. */
export const isIntegrationUploadFilePart = (value) => {
  if (value == null || typeof value !== 'object') return false;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob === 'undefined' || !(value instanceof Blob)) return false;
  if (typeof value.name === 'string') return true;
  return typeof value.lastModified === 'number';
};

export const extractIntegrationRecord = (body) => {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body)) return body[0] ?? null;

  const candidates = [body.data, body.integration, body];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    if (candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) {
      const nested = candidate.data;
      if (nested._id || nested.id || nested.integration_id || nested.name != null) return nested;
    }
    if (candidate._id || candidate.id || candidate.integration_id || candidate.name != null) {
      return candidate;
    }
  }

  return null;
};

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
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, typeof value === 'string' ? value : String(value));
  });
};

/** Build multipart body for integration create/update (`image` file field when provided). */
export const buildIntegrationFormData = (fields = {}, image = null) => {
  const formData = new FormData();
  appendIntegrationFieldsToFormData(formData, fields);
  if (isIntegrationUploadFilePart(image)) {
    formData.append(INTEGRATION_IMAGE_FIELD, image, image.name || 'upload');
  }
  return formData;
};

/** Prefer React file state; fall back to `<input name="image">` on the form. */
export const pickIntegrationImageFromSubmit = (fileState, formElement) => {
  if (isIntegrationUploadFilePart(fileState)) return fileState;
  if (!formElement) return undefined;
  const raw = new FormData(formElement).get(INTEGRATION_IMAGE_FIELD);
  return isIntegrationUploadFilePart(raw) ? raw : undefined;
};

const authHeadersForMultipart = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const sendIntegrationMultipart = async (url, method, formData) => {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: authHeadersForMultipart(),
      body: formData,
    });
  } catch (err) {
    logIntegrationModuleError('sendIntegrationMultipart network error', {
      url,
      method,
      formFieldKeys: [...formData.keys()],
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('sendIntegrationMultipart failed', {
      url,
      method,
      formFieldKeys: [...formData.keys()],
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  try {
    const result = await response.json();
    return extractIntegrationRecord(result) ?? result;
  } catch {
    return { success: true };
  }
};

const postIntegrationRequest = async (url, integrationData) => {
  const { image, ...rest } = integrationData || {};
  const formData = buildIntegrationFormData(rest, image);
  return sendIntegrationMultipart(url, 'POST', formData);
};

const patchIntegrationRequest = async (url, integrationData) => {
  const { image, ...rest } = integrationData || {};
  const useMultipart = isIntegrationUploadFilePart(image);

  if (useMultipart) {
    const formData = buildIntegrationFormData(rest, image);
    return sendIntegrationMultipart(url, 'PATCH', formData);
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

  const result = await response.json();
  return extractIntegrationRecord(result) ?? result;
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

  const result = await response.json();
  return extractIntegrationRecord(result) ?? result;
};

/** List remote store variations for a parent product (WooCommerce / Shopify). */
export const fetchStoreProductVariationsRequest = async (
  integrationId,
  remoteProductId
) => {
  const id = String(integrationId || '').trim();
  const remoteId = String(remoteProductId || '').trim();
  if (!id) throw new Error('Integration id is required');
  if (!remoteId) throw new Error('Remote product id is required');

  const url = `${BASE_URL}integration/store-product-variations/${encodeURIComponent(id)}/${encodeURIComponent(remoteId)}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logIntegrationModuleError('fetchStoreProductVariationsRequest network error', {
      url,
      integrationId: id,
      remoteProductId: remoteId,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logIntegrationModuleError('fetchStoreProductVariationsRequest failed', {
      status: response.status,
      integrationId: id,
      remoteProductId: remoteId,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  const data = Array.isArray(result?.data) ? result.data : [];
  return {
    data,
    parent: result?.parent || null,
    store_type: result?.store_type || '',
    message: result?.message || '',
  };
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
