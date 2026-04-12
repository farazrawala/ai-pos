import { API_BASE_URL } from '../../config/apiConfig.js';
import { logCategoryUploadErrorToFile } from '../../utils/categoryUploadFileLog.js';

const BASE_URL = `${API_BASE_URL}/`;

/** Multipart file field name expected by your API (default `image`). Override with VITE_CATEGORY_IMAGE_FIELD. */
const CATEGORY_IMAGE_FIELD_NAME =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_CATEGORY_IMAGE_FIELD
    ? String(import.meta.env.VITE_CATEGORY_IMAGE_FIELD).trim() || 'image'
    : 'image';

const logCategoryModuleError = (operation, details) => {
  console.error(`[Category module] ${operation}`, details);
};

/** Read failed response body once; supports JSON or plain/HTML text for debugging. */
const readResponseErrorDetails = async (response) => {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (readErr) {
    return {
      status,
      contentType,
      rawTextPreview: '',
      readBodyError: readErr?.message || String(readErr),
      message: `HTTP error! status: ${status}`,
    };
  }
  let parsedJson = null;
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      // leave parsedJson null
    }
  }
  const fromJson =
    parsedJson &&
    (parsedJson.message || parsedJson.error || parsedJson.msg || parsedJson.detail);
  const message =
    (typeof fromJson === 'string' && fromJson) ||
    (Array.isArray(fromJson) ? fromJson.join(', ') : null) ||
    (typeof rawText === 'string' && rawText.length > 0 && rawText.length < 400 ? rawText : null) ||
    `HTTP error! status: ${status}`;
  return {
    status,
    contentType,
    message: typeof message === 'string' ? message : String(message),
    parsedJson,
    rawTextPreview: rawText.slice(0, 1200),
  };
};

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const fetchCategoriesRequest = async (params = {}) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build query string with pagination, search, and sort parameters
  // API uses 'skip' instead of 'page' (skip = (page - 1) * limit)
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
  const url = `${BASE_URL}category/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });
  } catch (err) {
    logCategoryModuleError('fetchCategoriesRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logCategoryModuleError('fetchCategoriesRequest failed', {
      status: response.status,
      params,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();

  // Handle API response format with pagination object
  // Expected format: { data: [...], pagination: { total, count, skip, limit } }
  // Or: { categories: [...], pagination: { total, count, skip, limit } }
  // Or: just an array (fallback)

  // Check if response has pagination object (new format)
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.categories || [];

    // Convert skip to page (page = skip / limit + 1)
    const page = pagination.limit > 0 ? Math.floor(pagination.skip / pagination.limit) + 1 : 1;
    const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;

    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page: page,
      limit: pagination.limit || params.limit || 10,
      totalPages: totalPages,
    };
  }

  // Fallback: Check if response has data array
  if (result.data && Array.isArray(result.data)) {
    return {
      data: result.data,
      total: result.total || result.data.length,
      page: result.page || params.page || 1,
      limit: result.limit || result.per_page || params.limit || 10,
      totalPages:
        result.total_pages ||
        Math.ceil(
          (result.total || result.data.length) /
            (result.limit || result.per_page || params.limit || 10)
        ),
    };
  } else if (result.categories && Array.isArray(result.categories)) {
    return {
      data: result.categories,
      total: result.total || result.categories.length,
      page: result.page || params.page || 1,
      limit: result.limit || result.per_page || params.limit || 10,
      totalPages:
        result.total_pages ||
        Math.ceil(
          (result.total || result.categories.length) /
            (result.limit || result.per_page || params.limit || 10)
        ),
    };
  } else if (Array.isArray(result)) {
    return {
      data: result,
      total: result.length,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(result.length / (params.limit || 10)),
    };
  }

  return {
    data: [],
    total: 0,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: 0,
  };
};

export const fetchCategoryByIdRequest = async (categoryId) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}category/get/${categoryId}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });
  } catch (err) {
    logCategoryModuleError('fetchCategoryByIdRequest network error', { categoryId, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logCategoryModuleError('fetchCategoryByIdRequest failed', {
      categoryId,
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  return result;
};

const appendCategoryFieldsToFormData = (formData, data) => {
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'image') return;
    if (value === undefined) return;
    if (value === null) {
      formData.append(key, '');
      return;
    }
    formData.append(key, typeof value === 'string' ? value : String(value));
  });
};

/** True for values from <input type="file">; avoids relying only on instanceof File (iframes / multiple realms). */
export const isCategoryUploadFilePart = (value) => {
  if (value == null || typeof value !== 'object') return false;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob === 'undefined' || !(value instanceof Blob)) return false;
  if (typeof value.name === 'string') return true;
  return typeof value.lastModified === 'number';
};

export const createCategoryRequest = async (categoryData = {}) => {
  const token = getAuthToken();
  const { image, ...rest } = categoryData;
  const url = `${BASE_URL}category/create`;
  const useMultipart = isCategoryUploadFilePart(image);

  if (useMultipart) {
    const formData = new FormData();
    appendCategoryFieldsToFormData(formData, rest);
    const fileName = image.name || 'upload';
    formData.append(CATEGORY_IMAGE_FIELD_NAME, image, fileName);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err) {
      const detail = {
        url,
        multipartFileField: CATEGORY_IMAGE_FIELD_NAME,
        hasToken: Boolean(token),
        formFieldKeys: [...formData.keys()],
        filePartMeta: { name: image.name, size: image.size, type: image.type },
        errorMessage: err?.message || String(err),
        error: err,
      };
      logCategoryModuleError('createCategoryRequest network error (multipart)', detail);
      logCategoryUploadErrorToFile('createCategoryRequest.multipart.network', detail);
      throw err;
    }

    if (!response.ok) {
      const details = await readResponseErrorDetails(response);
      const detail = {
        url,
        multipartFileField: CATEGORY_IMAGE_FIELD_NAME,
        hasToken: Boolean(token),
        formFieldKeys: [...formData.keys()],
        filePartMeta: { name: image.name, size: image.size, type: image.type },
        ...details,
      };
      logCategoryModuleError('createCategoryRequest failed (multipart)', detail);
      logCategoryUploadErrorToFile('createCategoryRequest.multipart.httpError', detail);
      throw new Error(details.message);
    }

    try {
      return await response.json();
    } catch (parseErr) {
      const detail = {
        url,
        errorMessage: parseErr?.message || String(parseErr),
        error: parseErr,
      };
      logCategoryModuleError('createCategoryRequest success body is not valid JSON (multipart)', detail);
      logCategoryUploadErrorToFile('createCategoryRequest.multipart.invalidJsonBody', detail);
      throw parseErr;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(rest),
    });
  } catch (err) {
    logCategoryModuleError('createCategoryRequest network error (JSON)', {
      url,
      hasToken: Boolean(token),
      payloadKeys: Object.keys(rest),
      errorMessage: err?.message || String(err),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logCategoryModuleError('createCategoryRequest failed (JSON)', {
      url,
      hasToken: Boolean(token),
      payloadKeys: Object.keys(rest),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logCategoryModuleError('createCategoryRequest success body is not valid JSON (JSON mode)', {
      url,
      errorMessage: parseErr?.message || String(parseErr),
      error: parseErr,
    });
    throw parseErr;
  }
};

export const updateCategoryRequest = async (categoryId, categoryData = {}) => {
  const token = getAuthToken();
  const { image, ...rest } = categoryData;
  const url = `${BASE_URL}category/update/${categoryId}`;

  if (isCategoryUploadFilePart(image)) {
    const formData = new FormData();
    appendCategoryFieldsToFormData(formData, rest);
    const fileName = image.name || 'upload';
    formData.append(CATEGORY_IMAGE_FIELD_NAME, image, fileName);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: formData,
      });
    } catch (err) {
      const detail = {
        categoryId,
        url,
        multipartFileField: CATEGORY_IMAGE_FIELD_NAME,
        formFieldKeys: [...formData.keys()],
        filePartMeta: { name: image.name, size: image.size, type: image.type },
        errorMessage: err?.message || String(err),
        error: err,
      };
      logCategoryModuleError('updateCategoryRequest network error (multipart)', detail);
      logCategoryUploadErrorToFile('updateCategoryRequest.multipart.network', detail);
      throw err;
    }

    if (!response.ok) {
      const details = await readResponseErrorDetails(response);
      const detail = {
        categoryId,
        multipartFileField: CATEGORY_IMAGE_FIELD_NAME,
        formFieldKeys: [...formData.keys()],
        filePartMeta: { name: image.name, size: image.size, type: image.type },
        ...details,
      };
      logCategoryModuleError('updateCategoryRequest failed (multipart)', detail);
      logCategoryUploadErrorToFile('updateCategoryRequest.multipart.httpError', detail);
      throw new Error(details.message);
    }

    try {
      return await response.json();
    } catch (parseErr) {
      const detail = {
        categoryId,
        url,
        errorMessage: parseErr?.message || String(parseErr),
        error: parseErr,
      };
      logCategoryModuleError(
        'updateCategoryRequest success body is not valid JSON (multipart)',
        detail
      );
      logCategoryUploadErrorToFile('updateCategoryRequest.multipart.invalidJsonBody', detail);
      throw parseErr;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(rest),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logCategoryModuleError('updateCategoryRequest failed (JSON)', {
      categoryId,
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  return response.json();
};

export const deleteCategoryRequest = async (categoryId) => {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}category/delete/${categoryId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logCategoryModuleError('deleteCategoryRequest failed', {
      categoryId,
      status: response.status,
      errorData,
      message,
    });
    throw new Error(message);
  }

  // Some APIs return data, some return empty body
  try {
    const result = await response.json();
    return result;
  } catch {
    // If response is empty, return success
    return { success: true };
  }
};
