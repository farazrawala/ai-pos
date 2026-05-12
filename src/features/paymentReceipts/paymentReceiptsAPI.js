import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const PAYMENT_RECEIPT_SAVE_PATH = 'payment_receipt/save';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function parseErrorMessage(response) {
  const body = await response.json().catch(() => ({}));
  if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  return `HTTP ${response.status}`;
}

/** POST `api/payment_receipt/save` */
export async function savePaymentReceiptRequest(payload = {}) {
  const url = `${BASE_URL}${PAYMENT_RECEIPT_SAVE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return response.json().catch(() => ({}));
}
