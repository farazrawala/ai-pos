import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

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

/** Build JSON body for POST /expense/create — omits blank optional id fields. */
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
