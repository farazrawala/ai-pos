import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  ensureCompanyFromCache,
  pickAccountRefId,
} from '../company/companyAPI.js';
import { resolveDefaultExpenseListFilterIds } from '../expenses/expensesAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

const logAmountTransferModuleError = (operation, details) => {
  console.error(`[Amount transfer module] ${operation}`, details);
};

const readResponseErrorDetails = async (response) => {
  const status = response.status;
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (readErr) {
    return {
      status,
      message: `HTTP error! status: ${status}`,
      readBodyError: readErr?.message || String(readErr),
    };
  }
  let parsedJson = null;
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      /* ignore */
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
    message: typeof message === 'string' ? message : String(message),
    parsedJson,
    rawTextPreview: rawText.slice(0, 1200),
  };
};

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const AMOUNT_TRANSFER_LIST_POPULATE = 'from_account_id,to_account_id';
export const AMOUNT_TRANSFER_ACCOUNT_TYPE = 'current_asset';

/**
 * Query params for from/to account dropdowns: `exclude_id` = company `default_account_receivable_account`.
 */
export async function buildAmountTransferAccountFilterParams(user = null, companyFromStore = null) {
  const company = await ensureCompanyFromCache(user, companyFromStore, {
    requiredKeys: ['default_account_receivable_account'],
  });

  const { excludeId } = resolveDefaultExpenseListFilterIds(user, company);
  const params = { account_type: AMOUNT_TRANSFER_ACCOUNT_TYPE };
  if (excludeId) params.exclude_id = excludeId;
  return params;
}

/** Company `default_withdraw_account` id for the to-account dropdown `include_id`. */
export function resolveDefaultWithdrawAccountId(user, company) {
  const sources = [
    company,
    user,
    user?.company && typeof user.company === 'object' ? user.company : null,
  ].filter(Boolean);

  for (const src of sources) {
    const id = pickAccountRefId(src.default_withdraw_account ?? src.defaultWithdrawAccount);
    if (id) return id;
  }
  return '';
}

/**
 * To-account dropdown: same filters as from-account, plus `include_id` = `default_withdraw_account`.
 */
export async function buildAmountTransferToAccountFilterParams(user = null, companyFromStore = null) {
  const base = await buildAmountTransferAccountFilterParams(user, companyFromStore);
  const company = await ensureCompanyFromCache(user, companyFromStore, {
    requiredKeys: ['default_withdraw_account'],
  });

  const includeId = resolveDefaultWithdrawAccountId(user, company);
  const params = { ...base };
  if (includeId) params.include_id = includeId;
  return params;
}

export function normalizeAmountTransfersListRows(result) {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result)) return result;

  const candidates = [
    result.data,
    result.amount_transfers,
    result.amountTransfers,
    result.items,
    result.records,
    result.data?.data,
    result.data?.amount_transfers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export const accountIdFromRef = (ref) => {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    return String(ref._id ?? ref.id ?? '').trim();
  }
  return String(ref).trim();
};

export const accountDisplayName = (accountRef) => {
  if (accountRef == null || accountRef === '') return '—';
  if (typeof accountRef === 'object' && !Array.isArray(accountRef)) {
    const name = String(accountRef.name ?? accountRef.account_name ?? '').trim();
    if (name) return name;
    const code = String(accountRef.code ?? accountRef.account_code ?? '').trim();
    if (code) return code;
    return '—';
  }
  return '—';
};

/** Body for POST /amount_transfer/save and PATCH /amount_transfer/update_record/:id */
export function buildAmountTransferSaveBody(transferData = {}) {
  const body = {
    from_account_id: String(transferData.from_account_id ?? '').trim(),
    to_account_id: String(transferData.to_account_id ?? '').trim(),
    description: String(transferData.description ?? '').trim(),
  };
  const amount = Number(transferData.amount);
  if (!Number.isNaN(amount)) body.amount = amount;
  return body;
}

export async function fetchAmountTransfersRequest(params = {}) {
  const token = params.token || getAuthToken();
  if (!token) {
    throw new Error('You are not signed in. Please sign in again to load amount transfers.');
  }

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  headers.Authorization = `Bearer ${token}`;

  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : AMOUNT_TRANSFER_LIST_POPULATE
  );

  const queryString = queryParams.toString();
  const url = `${BASE_URL}amount_transfer/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logAmountTransferModuleError('fetchAmountTransfersRequest network error', {
      url,
      params,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAmountTransferModuleError('fetchAmountTransfersRequest failed', { url, params, ...details });
    throw new Error(details.message);
  }

  const result = await response.json();

  if (result.success === false) {
    const message =
      result.message || result.error || result.msg || 'Failed to fetch amount transfers';
    logAmountTransferModuleError('fetchAmountTransfersRequest API success=false', {
      url,
      params,
      result,
    });
    throw new Error(typeof message === 'string' ? message : String(message));
  }

  const data = normalizeAmountTransfersListRows(result);

  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const total = Number(pagination.total ?? data.length ?? 0);
    const skip = Number(pagination.skip ?? 0);
    const apiLimit = pagination.limit;
    const limit =
      apiLimit != null && Number(apiLimit) > 0 ? Number(apiLimit) : Number(params.limit || 10);
    const page = limit > 0 ? Math.max(1, Math.floor(skip / limit) + 1) : Number(params.page || 1);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : total > 0 ? 1 : 0;
    return { data, total, page, limit, totalPages };
  }

  if (Array.isArray(data)) {
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

const normalizeSingleAmountTransferPayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (
    result.amount_transfer != null &&
    typeof result.amount_transfer === 'object' &&
    !Array.isArray(result.amount_transfer)
  ) {
    return result.amount_transfer;
  }
  if (result._id || result.id) return result;
  return null;
};

export async function fetchAmountTransferByIdRequest(transferId, params = {}) {
  const token = getAuthToken();
  const id = String(transferId ?? '').trim();
  if (!id) throw new Error('Missing amount transfer id');

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const queryParams = new URLSearchParams();
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : AMOUNT_TRANSFER_LIST_POPULATE
  );
  const url = `${BASE_URL}amount_transfer/get/${encodeURIComponent(id)}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logAmountTransferModuleError('fetchAmountTransferByIdRequest network error', {
      transferId: id,
      url,
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAmountTransferModuleError('fetchAmountTransferByIdRequest failed', {
      transferId: id,
      ...details,
    });
    throw new Error(details.message);
  }

  const result = await response.json();
  if (result.success === false) {
    const message =
      result.message || result.error || result.msg || 'Failed to fetch amount transfer';
    throw new Error(typeof message === 'string' ? message : String(message));
  }

  const transfer = normalizeSingleAmountTransferPayload(result);
  if (!transfer) throw new Error('Amount transfer not found');
  return transfer;
}

/** POST /amount_transfer/save */
export async function saveAmountTransferRequest(transferData = {}) {
  const token = getAuthToken();
  const url = `${BASE_URL}amount_transfer/save`;
  const body = buildAmountTransferSaveBody(transferData);

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logAmountTransferModuleError('saveAmountTransferRequest network error', {
      url,
      payloadKeys: Object.keys(body),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAmountTransferModuleError('saveAmountTransferRequest failed', {
      url,
      payloadKeys: Object.keys(body),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logAmountTransferModuleError('saveAmountTransferRequest invalid JSON on success', {
      url,
      error: parseErr,
    });
    return { success: true };
  }
}

/** PATCH /amount_transfer/update_record/:id */
export async function updateAmountTransferRequest(transferId, transferData = {}) {
  const token = getAuthToken();
  const id = String(transferId ?? '').trim();
  if (!id) throw new Error('Missing amount transfer id');

  const url = `${BASE_URL}amount_transfer/update_record/${encodeURIComponent(id)}`;
  const body = buildAmountTransferSaveBody(transferData);

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logAmountTransferModuleError('updateAmountTransferRequest network error', {
      transferId: id,
      url,
      payloadKeys: Object.keys(body),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logAmountTransferModuleError('updateAmountTransferRequest failed', {
      transferId: id,
      payloadKeys: Object.keys(body),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logAmountTransferModuleError('updateAmountTransferRequest invalid JSON on success', {
      transferId: id,
      error: parseErr,
    });
    return { success: true };
  }
}
