/**
 * Support Ticket API — matches backend contract (Bearer JWT on every call).
 *
 * Base: `{API_BASE_URL}/support-ticket/...`
 * (API_BASE_URL already includes `/api`, e.g. `/api` or `https://host/pos_admin/api`)
 *
 * Endpoints:
 * - GET    /support-ticket/get-all
 * - GET    /support-ticket/get/:id
 * - POST   /support-ticket/create
 * - POST   /support-ticket/reply/:id
 * - PUT    /support-ticket/change-status/:id
 * - PUT    /support-ticket/change-priority/:id
 * - PUT    /support-ticket/assign/:id
 * - POST   /support-ticket/upload-attachment
 * - DELETE /support-ticket/delete-attachment/:id
 */
import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${String(API_BASE_URL || '/api').replace(/\/+$/, '')}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const jsonHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

/** Multipart: do not set Content-Type (browser sets boundary). */
const authOnlyHeaders = () => {
  const token = getAuthToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const readError = async (response) => {
  const errorData = await response.json().catch(() => ({}));
  return errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
};

const appendFormValue = (formData, key, value) => {
  if (value === undefined || value === null || value === '') return;
  if (typeof value === 'boolean' || typeof value === 'number') {
    formData.append(key, String(value));
    return;
  }
  if (typeof value === 'object') {
    formData.append(key, JSON.stringify(value));
    return;
  }
  formData.append(key, String(value));
};

const appendListParams = (queryParams, params = {}) => {
  if (params.skip != null && params.skip !== '') {
    queryParams.append('skip', String(params.skip));
  } else if (params.page && params.limit) {
    queryParams.append('skip', String((params.page - 1) * params.limit));
  }
  if (params.limit != null && params.limit !== '') queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.priority) queryParams.append('priority', params.priority);
  if (params.category) queryParams.append('category', params.category);
  if (params.assigned_to) queryParams.append('assigned_to', params.assigned_to);
  if (params.date_from) queryParams.append('date_from', params.date_from);
  if (params.date_to) queryParams.append('date_to', params.date_to);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.scope) queryParams.append('scope', params.scope);
};

const appendDetailParams = (queryParams, params = {}) => {
  if (params.scope) queryParams.append('scope', params.scope);
  if (params.before) queryParams.append('before', params.before);
  if (params.after) queryParams.append('after', params.after);
  if (params.limit != null && params.limit !== '') queryParams.append('limit', String(params.limit));
};

/**
 * Normalize list response:
 * `{ data: [...], pagination: { skip, limit, total } }`
 */
const normalizeListResponse = (result, params = {}) => {
  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.tickets)
      ? result.tickets
      : Array.isArray(result)
        ? result
        : [];

  if (result?.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const limit = Number(pagination.limit || params.limit || 10) || 10;
    const skip = Number(pagination.skip || 0);
    const total = Number(pagination.total || 0);
    const page = limit > 0 ? Math.floor(skip / limit) + 1 : params.page || 1;
    return {
      data,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  const limit = result?.limit || result?.per_page || params.limit || 10;
  const total = result?.total ?? data.length;
  return {
    data,
    total,
    page: result?.page || params.page || 1,
    limit,
    totalPages: result?.total_pages || (limit > 0 ? Math.ceil(total / limit) : 0),
  };
};

/** Prefer `{ data: ticket }` from detail / mutate endpoints. */
const normalizeTicket = (result) => {
  if (!result || typeof result !== 'object') return result;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.ticket && typeof result.ticket === 'object') return result.ticket;
  return result;
};

/**
 * 1) GET /support-ticket/get-all
 * scope=user|admin, skip, limit, search, status, priority, category,
 * assigned_to, date_from, date_to, sortBy, sortOrder
 */
export async function getTickets(params = {}) {
  const queryParams = new URLSearchParams();
  appendListParams(queryParams, params);
  const qs = queryParams.toString();
  const url = `${BASE_URL}support-ticket/get-all${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: jsonHeaders() });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeListResponse(await response.json(), params);
}

/**
 * 2) GET /support-ticket/get/:id
 * Query: scope, before, limit (default 50 on server)
 * Marks ticket read. Non-admin: internal notes hidden server-side.
 */
export async function getTicket(id, params = {}) {
  const ticketId = String(id || '').trim();
  if (!ticketId) throw new Error('Ticket id is required');

  const queryParams = new URLSearchParams();
  appendDetailParams(queryParams, params);
  const qs = queryParams.toString();
  const url = `${BASE_URL}support-ticket/get/${encodeURIComponent(ticketId)}${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: jsonHeaders() });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeTicket(await response.json());
}

/**
 * 3) POST /support-ticket/create
 * JSON or multipart. Fields: subject, category, priority, description|message, attachments[]
 */
export async function createTicket(payload = {}) {
  const { attachments, ...fields } = payload;
  const hasFiles = Array.isArray(attachments) && attachments.some((f) => f instanceof File || f instanceof Blob);

  let body;
  let headers = authOnlyHeaders();

  if (hasFiles) {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => appendFormValue(formData, key, value));
    attachments.forEach((file) => {
      if (file instanceof File || file instanceof Blob) {
        formData.append('attachments', file, file.name || 'attachment');
      }
    });
    body = formData;
  } else {
    headers = jsonHeaders();
    body = JSON.stringify(fields);
  }

  const response = await fetch(`${BASE_URL}support-ticket/create`, {
    method: 'POST',
    headers,
    body,
  });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeTicket(await response.json());
}

/**
 * 4) POST /support-ticket/reply/:id
 * Fields: message, attachments[], is_internal (admin), role (optional)
 */
export async function replyTicket(id, payload = {}) {
  const ticketId = String(id || '').trim();
  if (!ticketId) throw new Error('Ticket id is required');

  const { attachments, ...fields } = payload;
  const hasFiles = Array.isArray(attachments) && attachments.some((f) => f instanceof File || f instanceof Blob);

  let body;
  let headers = authOnlyHeaders();

  if (hasFiles) {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => appendFormValue(formData, key, value));
    attachments.forEach((file) => {
      if (file instanceof File || file instanceof Blob) {
        formData.append('attachments', file, file.name || 'attachment');
      }
    });
    body = formData;
  } else {
    headers = jsonHeaders();
    body = JSON.stringify(fields);
  }

  const response = await fetch(`${BASE_URL}support-ticket/reply/${encodeURIComponent(ticketId)}`, {
    method: 'POST',
    headers,
    body,
  });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeTicket(await response.json());
}

/**
 * 5) PUT /support-ticket/change-status/:id
 * Body: { status }
 */
export async function changeStatus(id, status) {
  const ticketId = String(id || '').trim();
  if (!ticketId) throw new Error('Ticket id is required');
  if (!status) throw new Error('Status is required');

  const response = await fetch(`${BASE_URL}support-ticket/change-status/${encodeURIComponent(ticketId)}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeTicket(await response.json());
}

/**
 * 6) PUT /support-ticket/change-priority/:id (admin)
 * Body: { priority }
 */
export async function changePriority(id, priority) {
  const ticketId = String(id || '').trim();
  if (!ticketId) throw new Error('Ticket id is required');
  if (!priority) throw new Error('Priority is required');

  const response = await fetch(`${BASE_URL}support-ticket/change-priority/${encodeURIComponent(ticketId)}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ priority }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeTicket(await response.json());
}

/**
 * 7) PUT /support-ticket/assign/:id (admin)
 * Body: { assigned_to: userId | null } — null/empty unassigns
 */
export async function assignTicket(id, assignedTo) {
  const ticketId = String(id || '').trim();
  if (!ticketId) throw new Error('Ticket id is required');

  const value =
    assignedTo == null || assignedTo === ''
      ? null
      : String(assignedTo);

  const response = await fetch(`${BASE_URL}support-ticket/assign/${encodeURIComponent(ticketId)}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ assigned_to: value }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return normalizeTicket(await response.json());
}

/**
 * 8) POST /support-ticket/upload-attachment
 * multipart field: `file`; optional ticket_id, message_id
 */
export async function uploadAttachment(file, meta = {}) {
  if (!(file instanceof File || file instanceof Blob)) {
    throw new Error('A file is required');
  }
  const formData = new FormData();
  formData.append('file', file, file.name || 'attachment');
  Object.entries(meta).forEach(([key, value]) => appendFormValue(formData, key, value));

  const response = await fetch(`${BASE_URL}support-ticket/upload-attachment`, {
    method: 'POST',
    headers: authOnlyHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json();
  return result?.data ?? result;
}

/**
 * 9) DELETE /support-ticket/delete-attachment/:id
 */
export async function deleteAttachment(attachmentId) {
  const id = String(attachmentId || '').trim();
  if (!id) throw new Error('Attachment id is required');

  const response = await fetch(`${BASE_URL}support-ticket/delete-attachment/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json().catch(() => ({ success: true }));
}

const supportAPI = {
  getTickets,
  getTicket,
  createTicket,
  replyTicket,
  changeStatus,
  changePriority,
  assignTicket,
  uploadAttachment,
  deleteAttachment,
};

export default supportAPI;
