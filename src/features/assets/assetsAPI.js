import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const logAssetModuleError = (operation, details) => {
  console.error(`[Asset module] ${operation}`, details);
};

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
    parsedJson && (parsedJson.message || parsedJson.error || parsedJson.msg || parsedJson.detail);
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

export const ASSET_TYPE_OPTIONS = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

export const ASSET_LIST_POPULATE = 'account_id,user_id';

/** Extract asset rows from various API response shapes. */
export function normalizeAssetsListRows(result) {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) return result;

  const candidates = [
    result.data,
    result.assets,
    result.items,
    result.records,
    result.data?.data,
    result.data?.assets,
    result.data?.items,
    result.data?.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export async function fetchAssetsRequest(params = {}) {
  const token = params.token || getAuthToken();
  if (!token) {
    throw new Error('You are not signed in. Please sign in again to load assets.');
  }

  const headers = { 'Content-Type': 'application/json' };
  headers.Authorization = `Bearer ${token}`;

  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', skip);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : ASSET_LIST_POPULATE
  );

  const queryString = queryParams.toString();
  const url = `${BASE_URL}assets/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logAssetModuleError('fetchAssetsRequest network error', { url, params, error: err });
    const msg = err?.message || String(err);
    if (msg === 'Failed to fetch' || msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET')) {
      throw new Error(
        'Cannot reach the API server. Ensure the backend is running and VITE_API_PROXY_TARGET in .env points to it (default http://localhost:8000).'
      );
    }
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAssetModuleError('fetchAssetsRequest failed', { url, params, ...details });
    throw new Error(details.message);
  }

  const result = await response.json();

  if (result.success === false) {
    const message =
      result.message || result.error || result.msg || 'Failed to fetch assets';
    logAssetModuleError('fetchAssetsRequest API success=false', { url, params, result });
    throw new Error(typeof message === 'string' ? message : String(message));
  }

  const data = normalizeAssetsListRows(result);

  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const total = Number(pagination.total ?? data.length ?? 0);
    const skip = Number(pagination.skip ?? 0);
    const apiLimit = pagination.limit;

    const limit =
      apiLimit != null && Number(apiLimit) > 0
        ? Number(apiLimit)
        : Number(params.limit || 10);
    const page =
      limit > 0
        ? Math.max(1, Math.floor(skip / limit) + 1)
        : Number(params.page || 1);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  if (data.length > 0 || result.data != null || result.assets != null) {
    const total = Number(result.total ?? data.length ?? 0);
    const limit = Number(result.limit || result.per_page || params.limit || 10);
    return {
      data,
      total,
      page: Number(result.page || params.page || 1),
      limit,
      totalPages:
        result.total_pages ??
        result.totalPages ??
        (limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0),
    };
  }

  return {
    data: [],
    total: 0,
    page: params.page || 1,
    limit: params.limit || 10,
    totalPages: 0,
  };
}

/** Normalize payload for POST /assets/save */
export function buildAssetSaveBody(assetData = {}) {
  const body = {
    name: String(assetData.name ?? '').trim(),
    user_id: String(assetData.user_id ?? '').trim(),
    description: String(assetData.description ?? '').trim(),
    asset_type: String(assetData.asset_type ?? 'buy').trim() || 'buy',
    account_id: String(assetData.account_id ?? '').trim(),
  };
  if (assetData.amount != null && assetData.amount !== '') {
    const n = Number(assetData.amount);
    if (!Number.isNaN(n)) body.amount = n;
  }
  return body;
}

export async function saveAssetRequest(assetData = {}) {
  const token = getAuthToken();
  const url = `${BASE_URL}assets/save`;
  const body = buildAssetSaveBody(assetData);

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logAssetModuleError('saveAssetRequest network error', {
      url,
      hasToken: Boolean(token),
      payloadKeys: Object.keys(body),
      errorMessage: err?.message || String(err),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAssetModuleError('saveAssetRequest failed', {
      url,
      hasToken: Boolean(token),
      payloadKeys: Object.keys(body),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logAssetModuleError('saveAssetRequest invalid JSON body on success', {
      url,
      errorMessage: parseErr?.message || String(parseErr),
      error: parseErr,
    });
    throw parseErr;
  }
}

const normalizeSingleAssetPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.asset != null && typeof result.asset === 'object' && !Array.isArray(result.asset)) {
    return result.asset;
  }
  if (result._id || result.id) return result;
  return null;
};

export async function fetchAssetByIdRequest(assetId, params = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const id = String(assetId ?? '').trim();
  if (!id) throw new Error('Missing asset id');

  const queryParams = new URLSearchParams();
  queryParams.append(
    'populate',
    params.populate != null ? String(params.populate) : ASSET_LIST_POPULATE
  );
  const url = `${BASE_URL}assets/get/${encodeURIComponent(id)}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logAssetModuleError('fetchAssetByIdRequest network error', { assetId: id, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAssetModuleError('fetchAssetByIdRequest failed', { assetId: id, ...details });
    throw new Error(details.message);
  }

  const result = await response.json();
  const asset = normalizeSingleAssetPayload(result);
  if (!asset) throw new Error('Asset not found');
  return asset;
}

/** PATCH /assets/update/:id */
export async function updateAssetRequest(assetId, assetData = {}) {
  const token = getAuthToken();
  const id = String(assetId ?? '').trim();
  if (!id) throw new Error('Missing asset id');

  const url = `${BASE_URL}assets/update/${encodeURIComponent(id)}`;
  const body = buildAssetSaveBody(assetData);

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logAssetModuleError('updateAssetRequest network error', {
      assetId: id,
      url,
      payloadKeys: Object.keys(body),
      errorMessage: err?.message || String(err),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAssetModuleError('updateAssetRequest failed', {
      assetId: id,
      url,
      payloadKeys: Object.keys(body),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logAssetModuleError('updateAssetRequest invalid JSON body on success', {
      assetId: id,
      errorMessage: parseErr?.message || String(parseErr),
      error: parseErr,
    });
    throw parseErr;
  }
}
