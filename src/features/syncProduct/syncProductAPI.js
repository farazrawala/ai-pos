import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logSyncProductModuleError = (operation, details) => {
  console.error(`[Sync product module] ${operation}`, details);
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

export const fetchSyncProductsRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.product_id) queryParams.append('product_id', params.product_id);
  const productIds = params.product_ids ?? params.productIds;
  if (productIds != null && String(productIds).trim() !== '') {
    const normalized = Array.isArray(productIds)
      ? productIds.map((id) => String(id || '').trim()).filter(Boolean).join(',')
      : String(productIds).trim();
    if (normalized) queryParams.append('product_ids', normalized);
  }
  if (params.populate) queryParams.append('populate', params.populate);
  if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}sync_product/get-all${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logSyncProductModuleError('fetchSyncProductsRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncProductModuleError('fetchSyncProductsRequest failed', {
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
    : Array.isArray(result.sync_products)
      ? result.sync_products
      : [];

  return {
    data,
    total: result.pagination?.total ?? data.length,
  };
};

export const productIdFromSyncRow = (row) => {
  const product = row?.product_id ?? row?.productId;
  if (product && typeof product === 'object' && !Array.isArray(product)) {
    return String(product._id || product.id || '').trim();
  }
  if (product != null && product !== '') return String(product).trim();
  return '';
};

/** Load sync rows for many products (batch API when supported, otherwise per-product fallback). */
export const fetchSyncProductsForProductIdsRequest = async (productIds = [], options = {}) => {
  const ids = [...new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const populate = options.populate || 'integration_id';
  const perProductLimit = Math.max(Number(options.limit) || 20, 1);

  try {
    const batch = await fetchSyncProductsRequest({
      product_ids: ids.join(','),
      populate,
      limit: Math.max(ids.length * perProductLimit, 100),
    });
    const rows = Array.isArray(batch?.data) ? batch.data : [];
    if (rows.length) return rows;
  } catch (err) {
    console.warn('[Sync product module] Batch fetch failed, falling back per product', err);
  }

  const results = await Promise.all(
    ids.map((id) =>
      fetchSyncProductsRequest({
        product_id: id,
        populate,
        limit: perProductLimit,
      }).catch(() => ({ data: [] }))
    )
  );

  return results.flatMap((result) => (Array.isArray(result?.data) ? result.data : []));
};

export const createSyncProductRequest = async (syncProductData = {}) => {
  const url = `${BASE_URL}sync_product/create`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(syncProductData),
    });
  } catch (err) {
    logSyncProductModuleError('createSyncProductRequest network error', {
      url,
      syncProductData,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncProductModuleError('createSyncProductRequest failed', {
      status: response.status,
      syncProductData,
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

export const updateSyncProductRequest = async (syncProductId, syncProductData = {}) => {
  const id = String(syncProductId || '').trim();
  if (!id) throw new Error('Sync product id is required');

  const url = `${BASE_URL}sync_product/update/${encodeURIComponent(id)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(syncProductData),
    });
  } catch (err) {
    logSyncProductModuleError('updateSyncProductRequest network error', {
      url,
      syncProductId: id,
      syncProductData,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logSyncProductModuleError('updateSyncProductRequest failed', {
      status: response.status,
      syncProductId: id,
      syncProductData,
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
