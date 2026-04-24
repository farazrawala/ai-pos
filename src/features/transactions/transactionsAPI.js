import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const TRANSACTION_LIST_PATH = 'transaction/get-all-active';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = (options = {}) => {
  const useJsonContentType = options.json !== false;
  const token = getAuthToken();
  const headers = {};
  if (useJsonContentType) {
    headers['Content-Type'] = 'application/json';
  } else {
    headers.Accept = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const stringifyValidationErrors = (errors) => {
  if (errors == null) return '';
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) {
    return errors
      .map((e) => (e && typeof e === 'object' ? e.message || e.msg : String(e)))
      .join('; ');
  }
  if (typeof errors !== 'object') return String(errors);
  const parts = [];
  for (const [k, v] of Object.entries(errors)) {
    if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
    else if (v != null && typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
    else if (v != null) parts.push(`${k}: ${v}`);
  }
  return parts.join('; ') || '';
};

const getErrorMessageFromResponse = async (response) => {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();

  if (!trimmed) return `HTTP ${status}`;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        if (typeof json.message === 'string' && json.message) return json.message;
        if (typeof json.error === 'string' && json.error) return json.error;
        if (typeof json.msg === 'string' && json.msg) return json.msg;
        if (typeof json.detail === 'string' && json.detail) return json.detail;
        const fromErrors = stringifyValidationErrors(json.errors);
        if (fromErrors) return fromErrors;
      }
    } catch {
      /* fall through */
    }
  }

  if (trimmed.startsWith('<')) {
    return `HTTP ${status} (HTML response)`;
  }

  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
};

const normalizeTransactionsPayload = (result) => {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.transactions)) return result.transactions;
  if (Array.isArray(result)) return result;
  return [];
};

/**
 * GET /transaction/get-all-active?populate=account_id&skip=&limit=&search=&sortBy=&sortOrder=&startDate=&endDate=
 */
export async function fetchTransactionsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('populate', 'account_id');

  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));
  if (params.startDate) queryParams.append('startDate', String(params.startDate));
  if (params.endDate) queryParams.append('endDate', String(params.endDate));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${TRANSACTION_LIST_PATH}?${queryString}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json();
  const data = normalizeTransactionsPayload(result);

  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const total = Number(pagination.total ?? data.length ?? 0);
    const skip = Number(pagination.skip ?? 0);
    const apiLimit = pagination.limit;

    if (apiLimit != null && Number(apiLimit) > 0) {
      const limit = Number(apiLimit);
      const page = limit > 0 ? Math.floor(skip / limit) + 1 : 1;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      return {
        data: Array.isArray(data) ? data : [],
        total,
        page,
        limit,
        totalPages,
      };
    }

    const limit = Number(params.limit || Math.max(data.length, 10) || 10);
    const page = 1;
    const totalPages = total > 0 ? 1 : 0;
    return {
      data: Array.isArray(data) ? data : [],
      total,
      page,
      limit,
      totalPages,
    };
  }

  const total = Number(result.total ?? data.length ?? 0);
  const limit = Number(params.limit || result.limit || 10);
  return {
    data: Array.isArray(data) ? data : [],
    total,
    page: Number(params.page || result.page || 1),
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export const getAccountName = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const acc = row.account_id;
  if (acc && typeof acc === 'object' && !Array.isArray(acc)) return acc.name || acc.accountName || '—';
  if (typeof acc === 'string' && acc.trim()) return acc;
  return '—';
};

export const formatTransactionAmount = (value) => {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
