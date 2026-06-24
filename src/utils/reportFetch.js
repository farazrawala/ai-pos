import { API_BASE_URL } from '../config/apiConfig.js';
import { getErrorMessageFromResponse } from '../features/orders/ordersAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getReportHeaders = () => {
  const token = getAuthToken();
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export function parseReportNumber(raw, fallback = 0) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function buildReportPeriodQuery(params = {}, defaultPeriod = 'last_30_days') {
  const query = new URLSearchParams();
  if (params.from && params.to) {
    query.set('from', String(params.from));
    query.set('to', String(params.to));
    if (params.timezone) query.set('timezone', String(params.timezone));
  } else {
    query.set('period', String(params.period || defaultPeriod));
  }
  return query;
}

/** @param {string} path @param {URLSearchParams} [query] @param {string} [failMessage] */
export async function fetchReportJson(path, query = new URLSearchParams(), failMessage = 'Request failed') {
  const qs = query.toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getReportHeaders() });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : failMessage;
    throw new Error(msg);
  }

  return result;
}

export function firstArray(result, ...keys) {
  for (const key of keys) {
    const v = result?.[key];
    if (Array.isArray(v)) return v;
  }
  if (Array.isArray(result)) return result;
  return [];
}

export function pickPeriod(result) {
  return result?.period && typeof result.period === 'object' ? result.period : null;
}

export function pickDataObject(result) {
  const d = result?.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) return d;
  if (result?.summary && typeof result.summary === 'object' && !Array.isArray(result.summary)) {
    return result.summary;
  }
  return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
}

export function partyDisplayName(row) {
  if (!row || typeof row !== 'object') return '';
  const user = row.user_id && typeof row.user_id === 'object' ? row.user_id : row.user;
  const customer = row.customer_id && typeof row.customer_id === 'object' ? row.customer_id : row.customer;
  const fromUser =
    user?.name ?? user?.fullName ?? user?.username ?? user?.email ?? '';
  const fromCustomer =
    customer?.name ?? customer?.fullName ?? customer?.username ?? customer?.email ?? '';
  return String(
    row.name ??
      row.user_name ??
      row.userName ??
      row.customer_name ??
      row.customerName ??
      fromUser ??
      fromCustomer ??
      ''
  ).trim();
}

export function accountDisplayName(row) {
  if (!row || typeof row !== 'object') return '';
  const account =
    row.account_id && typeof row.account_id === 'object'
      ? row.account_id
      : row.account && typeof row.account === 'object'
        ? row.account
        : null;
  return String(
    row.account_name ??
      row.accountName ??
      account?.name ??
      account?.account_name ??
      row.name ??
      ''
  ).trim();
}
