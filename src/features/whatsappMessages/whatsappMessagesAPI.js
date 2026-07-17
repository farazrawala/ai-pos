import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

const getHeaders = () => {
  const token = typeof window === 'undefined' ? '' : localStorage.getItem('authToken') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const normalizeResponse = (result, params = {}) => {
  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.whatsapp_messages)
      ? result.whatsapp_messages
      : Array.isArray(result)
        ? result
        : [];

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
  if (params.page && params.limit) {
    queryParams.append('skip', (params.page - 1) * params.limit);
  }
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  if (params.status) queryParams.append('status', params.status);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}whatsapp_messages/get-all${queryString ? `?${queryString}` : ''}`;
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

  const url = `${BASE_URL}whatsapp_message/delete/${encodeURIComponent(id)}`;
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
