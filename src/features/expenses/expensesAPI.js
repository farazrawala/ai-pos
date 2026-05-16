import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  extractCompanyFromUser,
  extractCompanyRecord,
  fetchCompanyById,
  getCompanyIdFromUser,
  pickAccountRefId,
} from '../company/companyAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

export const EXPENSE_LIST_ACCOUNT_TYPE = 'current_asset';
export const EXPENSE_LIST_POPULATE = 'account_id,user_id,payment_method_accounts_id';

/** Resolve default payable (include) and receivable (exclude) account ids for expense list filter. */
export function resolveDefaultExpenseListFilterIds(user, company) {
  const sources = [
    company,
    user,
    user?.company && typeof user.company === 'object' ? user.company : null,
  ].filter(Boolean);

  let includeId = '';
  let excludeId = '';
  for (const src of sources) {
    if (!includeId) {
      includeId = pickAccountRefId(
        src.default_account_payable_account ??
          src.defaultAccountPayableAccount ??
          src.default_payable_account
      );
    }
    if (!excludeId) {
      excludeId = pickAccountRefId(
        src.default_account_receivable_account ??
          src.defaultAccountReceivableAccount ??
          src.default_receivable_account
      );
    }
  }
  return { includeId, excludeId };
}

/** Company default payable/receivable ids for expense edit filters. */
export async function buildExpenseDefaultAccountFilterParams(user = null, companyFromStore = null) {
  let company = companyFromStore || extractCompanyFromUser(user);
  const companyId = getCompanyIdFromUser(user) || pickAccountRefId(company);

  let { includeId, excludeId } = resolveDefaultExpenseListFilterIds(user, company);
  const needsFetch = companyId && !includeId && !excludeId;

  if (needsFetch) {
    try {
      const body = await fetchCompanyById(companyId);
      company = extractCompanyRecord(body) || company;
    } catch (err) {
      console.warn('[Expense module] Could not load company for default account filters', err);
    }
  }

  ({ includeId, excludeId } = resolveDefaultExpenseListFilterIds(user, company));
  const params = { account_type: EXPENSE_LIST_ACCOUNT_TYPE };
  if (includeId) params.include_id = includeId;
  if (excludeId) params.exclude_id = excludeId;
  return params;
}

const logExpenseModuleError = (operation, details) => {
  console.error(`[Expense module] ${operation}`, details);
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

export async function fetchExpensesRequest(params = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', skip);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.account_type) queryParams.append('account_type', String(params.account_type));
  if (params.include_id) queryParams.append('include_id', String(params.include_id));
  if (params.exclude_id) queryParams.append('exclude_id', String(params.exclude_id));
  queryParams.append(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : EXPENSE_LIST_POPULATE
  );

  const queryString = queryParams.toString();
  const url = `${BASE_URL}expense/get-all-active${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logExpenseModuleError('fetchExpensesRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `HTTP error! status: ${response.status}`;
    logExpenseModuleError('fetchExpensesRequest failed', {
      status: response.status,
      params,
      errorData,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();

  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.expenses || [];
    const page =
      pagination.limit > 0 ? Math.floor(pagination.skip / pagination.limit) + 1 : 1;
    const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;
    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page,
      limit: pagination.limit || params.limit || 10,
      totalPages,
    };
  }

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
  }

  if (result.expenses && Array.isArray(result.expenses)) {
    return {
      data: result.expenses,
      total: result.total || result.expenses.length,
      page: result.page || params.page || 1,
      limit: result.limit || params.limit || 10,
      totalPages:
        result.total_pages ||
        Math.ceil(
          (result.total || result.expenses.length) / (result.limit || params.limit || 10)
        ),
    };
  }

  if (Array.isArray(result)) {
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
}

const EXPENSE_IMAGE_FIELD_NAME = 'image';

const appendExpenseFieldsToFormData = (formData, data) => {
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

/** True for values from `<input type="file">`. */
export const isExpenseUploadFilePart = (value) => {
  if (value == null || typeof value !== 'object') return false;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob === 'undefined' || !(value instanceof Blob)) return false;
  if (typeof value.name === 'string') return true;
  return typeof value.lastModified === 'number';
};

/** Build payload fields for POST /expense/save (and legacy create). */
export function buildExpenseCreateBody(raw = {}) {
  const body = {};
  if (raw.name != null && String(raw.name).trim() !== '') body.name = String(raw.name).trim();
  if (raw.user_id != null && String(raw.user_id).trim() !== '')
    body.user_id = String(raw.user_id).trim();
  if (raw.account_id != null && String(raw.account_id).trim() !== '')
    body.account_id = String(raw.account_id).trim();
  if (raw.amount != null && raw.amount !== '') {
    const n = Number(raw.amount);
    if (!Number.isNaN(n)) body.amount = n;
  }
  if (raw.payment_method_accounts_id != null && String(raw.payment_method_accounts_id).trim() !== '') {
    body.payment_method_accounts_id = String(raw.payment_method_accounts_id).trim();
  }
  if (raw.note != null) body.note = String(raw.note);
  return body;
}

/** POST /expense/save — JSON when no file; multipart/form-data with `image` when a file is attached. */
export async function saveExpenseRequest(expenseData = {}) {
  const token = getAuthToken();
  const { image, ...rest } = expenseData;
  const url = `${BASE_URL}expense/save`;
  const fields = buildExpenseCreateBody(rest);
  const useMultipart = isExpenseUploadFilePart(image);

  if (useMultipart) {
    const formData = new FormData();
    appendExpenseFieldsToFormData(formData, fields);
    const fileName = image.name || 'upload';
    formData.append(EXPENSE_IMAGE_FIELD_NAME, image, fileName);

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: formData });
    } catch (err) {
      logExpenseModuleError('saveExpenseRequest network error (multipart)', {
        url,
        hasToken: Boolean(token),
        formFieldKeys: [...formData.keys()],
        errorMessage: err?.message || String(err),
        error: err,
      });
      throw err;
    }

    if (!response.ok) {
      const details = await readResponseErrorDetails(response);
      logExpenseModuleError('saveExpenseRequest failed (multipart)', {
        url,
        hasToken: Boolean(token),
        ...details,
      });
      throw new Error(details.message);
    }

    try {
      return await response.json();
    } catch (parseErr) {
      logExpenseModuleError('saveExpenseRequest invalid JSON body (multipart)', {
        url,
        errorMessage: parseErr?.message || String(parseErr),
      });
      throw parseErr;
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(fields),
    });
  } catch (err) {
    logExpenseModuleError('saveExpenseRequest network error (JSON)', {
      url,
      hasToken: Boolean(token),
      payloadKeys: Object.keys(fields),
      errorMessage: err?.message || String(err),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logExpenseModuleError('saveExpenseRequest failed (JSON)', {
      url,
      hasToken: Boolean(token),
      payloadKeys: Object.keys(fields),
      ...details,
    });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logExpenseModuleError('saveExpenseRequest invalid JSON body (JSON)', {
      url,
      errorMessage: parseErr?.message || String(parseErr),
    });
    throw parseErr;
  }
}

export const EXPENSE_POPULATE = 'account_id,user_id,payment_method_accounts_id';

const normalizeSingleExpensePayload = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.expense != null && typeof result.expense === 'object' && !Array.isArray(result.expense)) {
    return result.expense;
  }
  if (result._id || result.id) return result;
  return null;
};

export async function fetchExpenseByIdRequest(expenseId, params = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const queryParams = new URLSearchParams();
  queryParams.append(
    'populate',
    params.populate != null ? String(params.populate) : EXPENSE_POPULATE
  );
  const url = `${BASE_URL}expense/get/${expenseId}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    logExpenseModuleError('fetchExpenseByIdRequest network error', { expenseId, url, error: err });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logExpenseModuleError('fetchExpenseByIdRequest failed', { expenseId, ...details });
    throw new Error(details.message);
  }

  const result = await response.json();
  const expense = normalizeSingleExpensePayload(result);
  if (!expense) {
    throw new Error('Expense not found');
  }
  return expense;
}

/** PATCH /expense/update/:id — JSON when no file; multipart with `image` when attached. */
export async function updateExpenseRequest(expenseId, expenseData = {}) {
  const token = getAuthToken();
  const id = String(expenseId ?? '').trim();
  if (!id) throw new Error('Missing expense id');

  const { image, ...rest } = expenseData;
  const url = `${BASE_URL}expense/update/${encodeURIComponent(id)}`;
  const fields = buildExpenseCreateBody(rest);
  const useMultipart = isExpenseUploadFilePart(image);

  if (useMultipart) {
    const formData = new FormData();
    appendExpenseFieldsToFormData(formData, fields);
    const fileName = image.name || 'upload';
    formData.append(EXPENSE_IMAGE_FIELD_NAME, image, fileName);

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { method: 'PATCH', headers, body: formData });
    } catch (err) {
      logExpenseModuleError('updateExpenseRequest network error (multipart)', {
        expenseId,
        url,
        errorMessage: err?.message || String(err),
        error: err,
      });
      throw err;
    }

    if (!response.ok) {
      const details = await readResponseErrorDetails(response);
      logExpenseModuleError('updateExpenseRequest failed (multipart)', { expenseId, ...details });
      throw new Error(details.message);
    }

    try {
      return await response.json();
    } catch (parseErr) {
      logExpenseModuleError('updateExpenseRequest invalid JSON body (multipart)', {
        expenseId,
        errorMessage: parseErr?.message || String(parseErr),
      });
      throw parseErr;
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(fields),
    });
  } catch (err) {
    logExpenseModuleError('updateExpenseRequest network error (JSON)', {
      expenseId,
      url,
      errorMessage: err?.message || String(err),
      error: err,
    });
    throw err;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    logExpenseModuleError('updateExpenseRequest failed (JSON)', { expenseId, ...details });
    throw new Error(details.message);
  }

  try {
    return await response.json();
  } catch (parseErr) {
    logExpenseModuleError('updateExpenseRequest invalid JSON body (JSON)', {
      expenseId,
      errorMessage: parseErr?.message || String(parseErr),
    });
    throw parseErr;
  }
}

export async function createExpenseRequest(expenseData = {}) {
  const token = getAuthToken();
  const url = `${BASE_URL}expense/create`;
  const body = buildExpenseCreateBody(expenseData);

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
    logExpenseModuleError('createExpenseRequest network error', {
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
    logExpenseModuleError('createExpenseRequest failed', {
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
    logExpenseModuleError('createExpenseRequest invalid JSON body on success', {
      url,
      errorMessage: parseErr?.message || String(parseErr),
      error: parseErr,
    });
    throw parseErr;
  }
}
