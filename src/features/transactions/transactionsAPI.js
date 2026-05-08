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
 * User ledger: `populate=account_id,ref_id,reference_user_id&reference_user_id=<userId>`
 */
export async function fetchTransactionsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('populate', params.populate != null ? String(params.populate) : 'account_id');

  if (params.referenceUserId != null && String(params.referenceUserId).trim() !== '') {
    queryParams.set('reference_user_id', String(params.referenceUserId).trim());
  }

  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  } else if (params.skip != null) {
    queryParams.append('skip', String(params.skip));
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

/** Numeric amount for summing debits/credits (0 if invalid). */
export const parseTransactionAmount = (value) => {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Stable key to group ledger lines into one double-entry journal on the client.
 * Prefer explicit parent/journal ids from the API when present.
 */
export const getJournalGroupKey = (row) => {
  if (!row || typeof row !== 'object') return '';
  const candidates = [
    row.journal_id,
    row.journalId,
    row.parent_transaction_id,
    row.parentTransactionId,
    row.transaction_header_id,
    row.transactionHeaderId,
    row.group_id,
    row.groupId,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return `id:${String(c)}`;
  }
  const num = row.transaction_number ?? row.transactionNumber;
  if (num != null && String(num).trim() !== '') return `no:${String(num)}`;
  if (row._id != null && String(row._id).trim() !== '') return `row:${String(row._id)}`;
  if (row.id != null && String(row.id).trim() !== '') return `row:${String(row.id)}`;
  return '';
};

/**
 * Group flat transaction lines into journals (arrays of lines), preserving API order within each group.
 */
export const groupTransactionsIntoJournals = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const order = [];
  const map = new Map();
  let anon = 0;
  for (const row of rows) {
    let key = getJournalGroupKey(row);
    if (!key) {
      anon += 1;
      key = `anon:${anon}`;
    }
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(row);
  }
  return order.map((key) => map.get(key));
};

export const sumDebitCreditForLines = (lines) => {
  let debit = 0;
  let credit = 0;
  if (!Array.isArray(lines)) return { debit, credit, balanced: true };
  for (const row of lines) {
    const t = String(row?.type || '').toLowerCase().trim();
    const amt = parseTransactionAmount(row?.amount);
    if (t === 'debit') debit += amt;
    else if (t === 'credit') credit += amt;
  }
  const diff = Math.abs(debit - credit);
  const balanced = diff < 0.005;
  return { debit, credit, balanced };
};
