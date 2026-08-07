import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getHeaders = () => {
  const token = typeof window === 'undefined' ? '' : localStorage.getItem('authToken') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const normalizeResponse = (result, params = {}) => {
  const rawList = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.chats)
      ? result.chats
      : Array.isArray(result?.whatsapp_messages)
        ? result.whatsapp_messages
        : Array.isArray(result)
          ? result
          : [];

  const data = rawList.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const populated =
      row.whatsapp_message_id && typeof row.whatsapp_message_id === 'object'
        ? row.whatsapp_message_id
        : null;
    const fromUserId = String(row.from_user_id ?? row.from ?? '').trim();
    const toUserId = String(row.to_user_id ?? row.to ?? '').trim();
    const number = fromUserId || row.number || populated?.number || '';
    const status = row.status ?? populated?.status ?? '';
    return {
      ...row,
      from_user_id: fromUserId || number,
      to_user_id: toUserId,
      number,
      status,
      message: row.message ?? populated?.message ?? '',
    };
  });

  if (result?.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const limit = pagination.limit || params.limit || 25;
    const page =
      pagination.skip != null && limit > 0
        ? Math.floor(pagination.skip / limit) + 1
        : params.page || 1;
    const total = pagination.total || 0;
    return {
      data,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  const limit = result?.limit || result?.per_page || params.limit || 25;
  const total = result?.total || data.length;
  return {
    data,
    total,
    page: result?.page || params.page || 1,
    limit,
    totalPages: result?.total_pages || (limit > 0 ? Math.ceil(total / limit) : 0),
  };
};

export const fetchWhatsappMessagesRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  queryParams.append('type', params.type || 'sent');
  if (params.page && params.limit) {
    queryParams.append('skip', (params.page - 1) * params.limit);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.status) queryParams.append('status', params.status);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}chat/get-all${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return normalizeResponse(await response.json(), params);
};

export const deleteWhatsappMessageRequest = async (messageId) => {
  const id = String(messageId || '').trim();
  if (!id) throw new Error('Message id is required');

  const url = `${BASE_URL}chat/delete/${encodeURIComponent(id)}`;
  const response = await fetch(url, { method: 'DELETE', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    return { success: true };
  }
};

/**
 * POST /chat/create/:pos_auth_token/swap — insert a chat message (swap direction).
 * Auth token is in the URL path (also sent as Bearer for compatibility).
 * Body: from_user_id (customer), to_user_id (company.whatsapp_number), message, whatsapp_time.
 */
export const createWhatsappMessageRequest = async ({
  number,
  message,
  toUserId,
  whatsappTime,
} = {}) => {
  const fromUserId = String(number || '').replace(/\D/g, '');
  const toDigits = String(toUserId || '').replace(/\D/g, '');
  const text = String(message || '').trim();
  if (!fromUserId) throw new Error('Number is required');
  if (!toDigits) throw new Error('Company WhatsApp number is required');
  if (!text) throw new Error('Message is required');

  const token =
    typeof window === 'undefined' ? '' : String(localStorage.getItem('authToken') || '').trim();
  if (!token) throw new Error('Auth token is required');

  const url = `${BASE_URL}chat/create/${encodeURIComponent(token)}/swap`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      from_user_id: fromUserId,
      to_user_id: toDigits,
      message: text,
      whatsapp_time: whatsappTime || new Date().toISOString(),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message || data.error || `HTTP error! status: ${response.status}`
    );
  }
  if (data && data.success === false) {
    throw new Error(data.message || data.error || 'Failed to create chat message');
  }
  return data;
};

/**
 * GET /chat/reset-unknown-usage-only?company_id=… — reset unknown WhatsApp usage counter.
 */
export const resetUnknownUsageOnlyRequest = async (companyId) => {
  const id = String(companyId || '').trim();
  if (!id) throw new Error('Company id is required');

  const query = new URLSearchParams({ company_id: id });
  const url = `${BASE_URL}chat/reset-unknown-usage-only?${query.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message || data.error || `HTTP error! status: ${response.status}`
    );
  }
  if (data && data.success === false) {
    throw new Error(data.message || data.error || 'Failed to reset usage');
  }
  return data;
};

/**
 * POST /whatsapp_message/create — queue an outbound WhatsApp message (Bearer auth).
 */
export const createOutboundWhatsappMessageRequest = async ({ number, message } = {}) => {
  const digits = String(number || '').replace(/\D/g, '');
  const text = String(message || '').trim();
  if (!digits) throw new Error('Number is required');
  if (!text) throw new Error('Message is required');

  const url = `${BASE_URL}whatsapp_message/create`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ number: digits, message: text }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message || data.error || `HTTP error! status: ${response.status}`
    );
  }
  if (data && data.success === false) {
    throw new Error(data.message || data.error || 'Failed to send message');
  }
  return data;
};
