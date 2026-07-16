import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const TRANSACTION_LIST_PATH = 'transaction/get-all-active';
const TRANSACTION_DELETED_LIST_PATH = 'transaction/get-deleted';
const MY_LEDGER_TRANSACTION_LIST_PATH = 'transaction/get-my-ledger-transaction';

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
 * GET /transaction/get-all-active?populate=account_id,ref_id&amount_gt=0&skip=&limit=&search=&sortBy=&sortOrder=&startDate=&endDate=
 * User ledger: `populate=account_id,ref_id,reference_user_id&reference_user_id=<userId>`
 */
const DEFAULT_TRANSACTION_POPULATE = 'account_id,ref_id';

const parseTransactionListResult = (result, params = {}) => {
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
};

const buildTransactionListQuery = (params = {}) => {
  const queryParams = new URLSearchParams();
  queryParams.set(
    'populate',
    params.populate != null ? String(params.populate) : DEFAULT_TRANSACTION_POPULATE
  );
  queryParams.set('amount_gt', '0');

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

  return queryParams.toString();
};

export async function fetchTransactionsRequest(params = {}) {
  const queryString = buildTransactionListQuery(params);
  const url = `${BASE_URL}${TRANSACTION_LIST_PATH}?${queryString}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json();
  return parseTransactionListResult(result, params);
}

/**
 * GET /transaction/get-deleted (fallback: /transactions/get-deleted)
 */
export async function fetchDeletedTransactionsRequest(params = {}) {
  const queryString = buildTransactionListQuery(params);
  const primaryUrl = `${BASE_URL}${TRANSACTION_DELETED_LIST_PATH}?${queryString}`;
  const fallbackUrl = `${BASE_URL}transactions/get-deleted?${queryString}`;

  let response = await fetch(primaryUrl, {
    method: 'GET',
    headers: getHeaders({ json: false }),
  });

  if (response.status === 404) {
    response = await fetch(fallbackUrl, {
      method: 'GET',
      headers: getHeaders({ json: false }),
    });
  }

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json();
  return parseTransactionListResult(result, params);
}

/**
 * GET /transaction/get-my-ledger-transaction?populate=...&amount_gt=0&reference_user_id=<userId>&...
 */
export async function fetchMyLedgerTransactionsRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('populate', params.populate != null ? String(params.populate) : 'account_id');
  queryParams.set('amount_gt', '0');

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
  const url = `${BASE_URL}${MY_LEDGER_TRANSACTION_LIST_PATH}?${queryString}`;
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

const TRANSACTION_CREATE_PATH = 'transaction/create';
const TRANSACTION_UPDATE_PATH = 'transaction/update';
const TRANSACTION_GET_PATH = 'transaction/get';

/**
 * Build the request body for creating/updating a single transaction (ledger line).
 * Centralized so the payload keys can be adjusted in one place if the backend differs.
 */
export function buildTransactionSaveBody(data = {}) {
  const body = {
    account_id: String(data.account_id ?? '').trim(),
    type: String(data.type ?? '').trim().toLowerCase(),
    description: String(data.description ?? '').trim(),
  };

  const amount = Number(String(data.amount ?? '').toString().replace(/,/g, ''));
  if (!Number.isNaN(amount)) body.amount = amount;

  const status = String(data.status ?? '').trim();
  if (status) body.status = status;

  const refNo = String(data.transaction_number ?? '').trim();
  if (refNo) body.transaction_number = refNo;

  return body;
}

/** POST /transaction/create */
export async function createTransactionRequest(data = {}) {
  const url = `${BASE_URL}${TRANSACTION_CREATE_PATH}`;
  const body = buildTransactionSaveBody(data);

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}

/** PATCH /transaction/update/:id */
export async function updateTransactionRequest(transactionId, data = {}) {
  const id = String(transactionId ?? '').trim();
  if (!id) throw new Error('Missing transaction id');

  const url = `${BASE_URL}${TRANSACTION_UPDATE_PATH}/${encodeURIComponent(id)}`;
  const body = buildTransactionSaveBody(data);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}

/** GET /transaction/get/:id?populate=account_id — single transaction for the edit form. */
export async function fetchTransactionByIdRequest(transactionId, params = {}) {
  const id = String(transactionId ?? '').trim();
  if (!id) throw new Error('Missing transaction id');

  const queryParams = new URLSearchParams();
  queryParams.set('populate', params.populate != null ? String(params.populate) : 'account_id');

  const url = `${BASE_URL}${TRANSACTION_GET_PATH}/${encodeURIComponent(id)}?${queryParams.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders({ json: false }) });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json();
  if (result && typeof result === 'object') {
    if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      return result.data;
    }
    if (result.transaction && typeof result.transaction === 'object') return result.transaction;
    if (result._id || result.id) return result;
  }
  throw new Error('Transaction not found');
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

const DOCUMENT_REF_IN_TEXT_RE = /(?:POR|ORD|PO|PR|SR)-[A-Z0-9-]+/i;
const GENERIC_DOC_LABEL_RE =
  /^(Purchase Order|Sale Order|Sales Order|Sales Return|Purchase Return|Purchase Order Return)$/i;

const pickRefNoFromObj = (refObj) => {
  if (!refObj || typeof refObj !== 'object' || Array.isArray(refObj)) return '';
  const candidates = [
    refObj.purchase_order_no,
    refObj.purchaseOrderNo,
    refObj.po_no,
    refObj.purchase_return_no,
    refObj.purchaseReturnNo,
    refObj.sales_return_no,
    refObj.salesReturnNo,
    refObj.sales_order_no,
    refObj.salesOrderNo,
    refObj.order_no,
    refObj.orderNo,
    refObj.ref_no,
    refObj.refNo,
    refObj.invoice_no,
    refObj.invoiceNo,
  ];
  const found = candidates.find((v) => v != null && String(v).trim() !== '');
  return found != null ? String(found).trim() : '';
};

/** Document number from populated `reference_id` / `ref_id` on a transaction line. */
export const extractDocumentRefNo = (row) => {
  if (!row || typeof row !== 'object') return '';

  for (const key of ['ref_no', 'refNo', 'order_no', 'orderNo']) {
    const direct = row[key];
    if (direct != null && String(direct).trim() !== '') return String(direct).trim();
  }

  const rid = row.reference_id ?? row.referenceId;
  if (rid && typeof rid === 'object' && !Array.isArray(rid)) {
    for (const key of ['ref_no', 'refNo', 'order_no', 'orderNo']) {
      const v = rid[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    const nested = pickRefNoFromObj(rid.ref_id ?? rid.refId);
    if (nested) return nested;
  }

  const directRef = row.ref_id ?? row.refId;
  const fromDirect = pickRefNoFromObj(directRef);
  if (fromDirect) return fromDirect;

  return '';
};

const extractDocumentRefObject = (row) => {
  if (!row || typeof row !== 'object') return null;

  const directRef = row.ref_id ?? row.refId;
  if (directRef && typeof directRef === 'object' && !Array.isArray(directRef)) {
    if (
      directRef._id ||
      directRef.id ||
      directRef.order_no ||
      directRef.purchase_order_no ||
      directRef.purchase_return_no ||
      directRef.sales_return_no
    ) {
      return directRef;
    }
  }

  const rid = row.reference_id ?? row.referenceId;
  if (rid && typeof rid === 'object' && !Array.isArray(rid)) {
    const nested = rid.ref_id ?? rid.refId;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  }

  return null;
};

/** Mongo `_id` of the linked document on a transaction line (order, PO, return, …). */
export const extractDocumentRouteId = (row) => {
  const refObj = extractDocumentRefObject(row);
  if (!refObj) return '';
  const id = refObj._id ?? refObj.id;
  return id != null ? String(id).trim() : '';
};

/** Map human-readable ref (e.g. ORD-0084) → `{ refNo, routeId }` from journal lines. */
export const buildDocumentRefLinkMap = (rows) => {
  const map = new Map();
  if (!Array.isArray(rows)) return map;

  for (const row of rows) {
    const refNo = extractDocumentRefNo(row);
    const routeId = extractDocumentRouteId(row);
    if (!refNo || !routeId) continue;
    const key = refNo.toUpperCase();
    if (!map.has(key)) {
      map.set(key, { refNo, routeId });
    }
  }

  return map;
};

/** Append linked document no when API description is generic, e.g. "Purchase Order" → "Purchase Order (PO-0042)". */
export const enrichTransactionDescription = (row) => {
  const raw = row?.description != null ? String(row.description).trim() : '';
  if (!raw || raw.includes('Mode of Payment')) return raw;
  if (DOCUMENT_REF_IN_TEXT_RE.test(raw)) return raw;

  const docNo = extractDocumentRefNo(row);
  if (!docNo) return raw;

  if (GENERIC_DOC_LABEL_RE.test(raw)) {
    return `${raw} (${docNo})`;
  }

  return raw;
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

/** Sort journal lines: all debits first, then credits (stable within each group). */
export const sortJournalLinesDebitFirst = (lines) => {
  if (!Array.isArray(lines) || lines.length <= 1) return Array.isArray(lines) ? lines : [];

  const typeRank = (row) => {
    const t = String(row?.type || '').toLowerCase().trim();
    if (t === 'debit') return 0;
    if (t === 'credit') return 1;
    return 2;
  };

  return lines
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const byType = typeRank(a.row) - typeRank(b.row);
      return byType !== 0 ? byType : a.index - b.index;
    })
    .map(({ row }) => row);
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
