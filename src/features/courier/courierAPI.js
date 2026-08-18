import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const COURIER_LIST_PATH = 'courier/get-all-active';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

/** Generic courier wrappers like "PostEx booking failed" — prefer nested detail when present. */
const isGenericCourierBookingMessage = (value) => {
  const msg = String(value ?? '').trim();
  if (!msg) return true;
  return /^(?:[a-z0-9 &+_-]+\s+)?booking failed\.?$/i.test(msg) || /^failed to create shipment\.?$/i.test(msg);
};

const pushUniqueMessage = (bucket, value) => {
  const text = String(value ?? '').trim();
  if (!text || text === '[object Object]') return;
  if (!bucket.includes(text)) bucket.push(text);
};

const collectCourierErrorMessages = (node, depth = 0, out = []) => {
  if (node == null || depth > 6) return out;

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    pushUniqueMessage(out, node);
    return out;
  }

  if (Array.isArray(node)) {
    for (const item of node) collectCourierErrorMessages(item, depth + 1, out);
    return out;
  }

  if (typeof node !== 'object') return out;

  const messageKeys = [
    'statusMessage',
    'status_message',
    'StatusMessage',
    'errorMessage',
    'error_message',
    'ErrorMessage',
    'detail',
    'details',
    'description',
    'reason',
    'msg',
    'message',
    'Message',
    'error',
    'Error',
  ];

  for (const key of messageKeys) {
    if (!(key in node)) continue;
    const value = node[key];
    if (typeof value === 'string' || typeof value === 'number') {
      pushUniqueMessage(out, value);
    } else if (value && typeof value === 'object') {
      collectCourierErrorMessages(value, depth + 1, out);
    }
  }

  if (node.errors != null) {
    if (typeof node.errors === 'string') {
      pushUniqueMessage(out, node.errors);
    } else if (Array.isArray(node.errors)) {
      for (const item of node.errors) {
        if (typeof item === 'string') pushUniqueMessage(out, item);
        else if (item && typeof item === 'object') {
          pushUniqueMessage(out, item.message || item.msg || item.detail || item.statusMessage);
          collectCourierErrorMessages(item, depth + 1, out);
        }
      }
    } else if (typeof node.errors === 'object') {
      for (const [field, value] of Object.entries(node.errors)) {
        if (Array.isArray(value)) pushUniqueMessage(out, `${field}: ${value.join(', ')}`);
        else if (value != null && typeof value === 'object') {
          collectCourierErrorMessages(value, depth + 1, out);
        } else if (value != null) {
          pushUniqueMessage(out, `${field}: ${value}`);
        }
      }
    }
  }

  const nests = [
    'data',
    'response',
    'api_response',
    'apiResponse',
    'result',
    'shipment',
    'raw',
    'payload',
    'body',
  ];
  for (const key of nests) {
    if (node[key] && typeof node[key] === 'object') {
      collectCourierErrorMessages(node[key], depth + 1, out);
    }
  }

  return out;
};

/**
 * Prefer the most specific courier/provider error (nested statusMessage, details, validation)
 * over a generic wrapper like "PostEx booking failed".
 */
export const extractCourierShipmentErrorMessage = (payload, fallback = 'Failed to create shipment') => {
  if (payload == null) return fallback;
  if (typeof payload === 'string') {
    const text = payload.trim();
    return text || fallback;
  }
  if (typeof payload !== 'object') return fallback;

  const collected = collectCourierErrorMessages(payload);
  if (!collected.length) return fallback;

  const specific = collected.filter((msg) => !isGenericCourierBookingMessage(msg));
  if (specific.length) {
    // Longest specific message usually carries the real provider reason.
    return [...specific].sort((a, b) => b.length - a.length)[0];
  }

  return collected[0] || fallback;
};

const normalizeListPayload = (result) => {
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.couriers)) return result.couriers;
  if (Array.isArray(result)) return result;
  return [];
};

export const fetchCouriersRequest = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page && params.limit) {
    const skip = (params.page - 1) * params.limit;
    queryParams.append('skip', String(skip));
  }
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.search) queryParams.append('search', String(params.search));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${COURIER_LIST_PATH}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = normalizeListPayload(result);
    const page = pagination.limit > 0 ? Math.floor(pagination.skip / pagination.limit) + 1 : 1;
    const totalPages = pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;
    return {
      data: Array.isArray(data) ? data : [],
      total: pagination.total || 0,
      page,
      limit: pagination.limit || params.limit || 10,
      totalPages,
    };
  }

  const data = normalizeListPayload(result);
  const total = result.total || data.length;
  const limit = result.limit || params.limit || 10;
  return {
    data,
    total,
    page: result.page || params.page || 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const fetchCourierByIdRequest = async (courierId) => {
  const response = await fetch(`${BASE_URL}courier/get/${courierId}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const createCourierRequest = async (courierData) => {
  const response = await fetch(`${BASE_URL}courier/create`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(courierData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const updateCourierRequest = async (courierId, courierData) => {
  const response = await fetch(`${BASE_URL}courier/update/${courierId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(courierData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const deleteCourierRequest = async (courierId) => {
  const response = await fetch(`${BASE_URL}courier/delete/${courierId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
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
 * Verify courier API credentials via backend healthCheck.
 * POST /courier/test/:courierId (or /courier/test without id for unsaved form values)
 * Blank password/token keep stored secrets on edit.
 */
export const testCourierCredentialsRequest = async (courierId, overrides = {}) => {
  const body = {};
  for (const key of ['type', 'url', 'login', 'password', 'token', 'account_no', 'provider']) {
    if (overrides[key] != null && String(overrides[key]).trim() !== '') {
      body[key] = typeof overrides[key] === 'string' ? overrides[key].trim() : overrides[key];
    }
  }

  const path = courierId
    ? `courier/test/${encodeURIComponent(courierId)}`
    : 'courier/test';
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  const ok = Boolean(payload.ok ?? payload.success);
  const message =
    payload.message ||
    payload.error ||
    (ok ? 'Credentials OK' : `Credential check failed (HTTP ${response.status})`);

  if (!ok) {
    const err = new Error(message);
    err.payload = payload;
    err.status = response.status;
    throw err;
  }

  return {
    ok: true,
    success: true,
    message,
    provider: payload.provider || null,
    raw: payload,
  };
};

export const pickCourierId = (item) =>
  item?._id || item?.id || item?.courier_id || '';

/** Backend `type` enum for courier integrations (`field_name: Courier`). */
export const COURIER_TYPES = [
  { value: 'tcs', label: 'TCS' },
  { value: 'leopard', label: 'Leopard' },
  { value: 'blueex', label: 'BlueEx' },
  { value: 'mnp', label: 'M&P' },
  { value: 'call_courier', label: 'Call Courier' },
  { value: 'trax', label: 'Trax' },
  { value: 'postex', label: 'PostEx' },
];

/** Suggested API base URLs for the courier integration `url` field. */
export const COURIER_DEFAULT_API_URLS = {
  tcs: 'https://devconnect.tcscourier.com',
  leopard: 'https://merchantapi.leopardscourier.com',
  /** Production Merchant API */
  postex: 'https://api.postex.pk/services/integration/api',
  /** Staging Merchant API (stg-merchant.postex.pk tokens) */
  postex_staging: 'https://stg-api.postex.pk/services/integration/api',
};

export const courierApiUrlPlaceholder = (type) => {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  return COURIER_DEFAULT_API_URLS[key] || 'https://…';
};

/** True when URL looks like PostEx merchant portal (causes HTTP 405 on booking). */
export const isPostexMerchantPortalUrl = (url) => {
  const value = String(url || '')
    .trim()
    .toLowerCase();
  if (!value) return false;
  return (
    /(?:^https?:\/\/)?(?:stg-)?merchant\.postex\.pk/i.test(value) ||
    (/postex\.pk/i.test(value) && /\/login\/?$/i.test(value)) ||
    /(?:^https?:\/\/)?stg-merchant\.postex\.pk\/?$/i.test(value)
  );
};

export const validateCourierApiUrl = (type, url) => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return 'API URL is required';
  const key = String(type || '')
    .trim()
    .toLowerCase();
  if (key === 'postex' && isPostexMerchantPortalUrl(trimmed)) {
    return (
      'This is the PostEx merchant portal, not the API. Use ' +
      `${COURIER_DEFAULT_API_URLS.postex} (token goes in the Token field).`
    );
  }
  return '';
};

export const courierTypeLabel = (type) => {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  const match = COURIER_TYPES.find((opt) => opt.value === key);
  if (match) return match.label;
  return type || '—';
};

/** Map saved courier integration `type` → shipment API `provider` key. */
export const courierTypeToProvider = (type) => {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  if (key === 'tcs') return 'TCS';
  if (key === 'leopard' || key === 'leopards' || key === 'lcs') return 'Leopard';
  if (key === 'postex' || key === 'post-ex') return 'PostEx';
  if (key === 'blueex' || key === 'blue-ex') return 'BlueEX';
  if (key === 'm&p' || key === 'mnp' || key === 'mp') return 'M&P';
  if (key === 'call_courier' || key === 'call courier' || key === 'callcourier') {
    return 'Call Courier';
  }
  if (key === 'trax') return 'Trax';
  return String(type).trim();
};

/**
 * Create a courier shipment for an order.
 * POST /courier/create/:orderId
 * body: { provider?, courier_id?, account_no?, pickupAddressCode?, storeAddressCode? }
 */
export const createCourierShipmentRequest = async (orderId, options = {}) => {
  if (!orderId) throw new Error('Order id is required');

  const provider =
    typeof options === 'string' ? options : options?.provider || '';
  const courierId =
    typeof options === 'object' ? options?.courierId || options?.courier_id || '' : '';
  const accountNo =
    typeof options === 'object'
      ? options?.account_no || options?.accountNo || options?.pickupAddressCode || ''
      : '';
  const pickupAddressCode =
    typeof options === 'object'
      ? options?.pickupAddressCode || options?.pickup_address_code || accountNo || ''
      : '';
  const storeAddressCode =
    typeof options === 'object'
      ? options?.storeAddressCode || options?.store_address_code || ''
      : '';

  const body = {
    // Book immediately — do not accept a queue ack without a tracking number.
    queueOnUnavailable: false,
    async: false,
  };
  const trimmed = typeof provider === 'string' ? provider.trim() : '';
  if (trimmed) body.provider = trimmed;
  if (courierId) body.courier_id = String(courierId);
  if (accountNo) {
    body.account_no = String(accountNo).trim();
  }
  if (pickupAddressCode) {
    const code = String(pickupAddressCode).trim();
    body.pickupAddressCode = code;
    body.pickup_address_code = code;
    // Common backend aliases
    body.pickup_code = code;
    body.address_code = code;
    body.addressCode = code;
  }
  if (storeAddressCode) {
    const code = String(storeAddressCode).trim();
    body.storeAddressCode = code;
    body.store_address_code = code;
    body.store_code = code;
  } else if (pickupAddressCode) {
    // PostEx requires at least one of pickup/store — mirror pickup when store omitted.
    const code = String(pickupAddressCode).trim();
    body.storeAddressCode = code;
    body.store_address_code = code;
  }

  const response = await fetch(`${BASE_URL}courier/create/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  const throwShipmentError = (fallback) => {
    let message = extractCourierShipmentErrorMessage(payload, fallback);
    const status = response.status;
    if (status === 405 || /405|not allowed|method not allowed/i.test(message)) {
      message =
        `${message || 'HTTP 405 Not Allowed'}. ` +
        'The courier API URL is likely wrong — use the PostEx API base ' +
        '(e.g. https://api.postex.pk/services/integration/api), not the merchant login page.';
    }
    const err = new Error(message);
    err.payload = payload;
    err.status = status;
    throw err;
  };

  if (!response.ok) {
    throwShipmentError(`HTTP error! status: ${response.status}`);
  }

  const normalized = normalizeCreateShipmentResult(payload, trimmed);
  const explicitFailure =
    payload?.success === false ||
    payload?.ok === false ||
    String(payload?.status || '').toLowerCase() === 'error' ||
    String(payload?.status || '').toLowerCase() === 'failed';

  if (explicitFailure && !normalized.tracking_id && !normalized.queued) {
    throwShipmentError('Failed to create shipment');
  }

  return normalized;
};

/**
 * TCS CNPrint label types (Swagger printtype on /ecom/api/print/label).
 * @see https://devconnect.tcscourier.com/ecom/index.html
 */
export const TCS_LABEL_PRINT_TYPES = [
  { value: 6, label: 'Shipment Label' },
  { value: 7, label: 'Shipment Label 6×4' },
  { value: 3, label: '6×4 Label' },
  { value: 2, label: 'Single copy per page' },
  { value: 1, label: '3 copies per page' },
  { value: 4, label: '3 labels per page' },
  { value: 5, label: "Shipper's Copy" },
];

/**
 * Fetch official courier label PDF (TCS CNPrint via backend).
 * GET /courier/label/:orderId?printtype=&shipperDetails=&accounttype=
 */
export const fetchCourierLabelRequest = async (orderId, options = {}) => {
  if (!orderId) throw new Error('Order id is required');

  const query = new URLSearchParams();
  if (options.printtype != null && options.printtype !== '') {
    query.set('printtype', String(options.printtype));
  }
  if (options.shipperDetails != null) {
    query.set('shipperDetails', options.shipperDetails ? 'true' : 'false');
  }
  if (options.accounttype != null && options.accounttype !== '') {
    query.set('accounttype', String(options.accounttype));
  }

  const qs = query.toString();
  const url = `${BASE_URL}courier/label/${encodeURIComponent(orderId)}${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || payload.message || `HTTP error! status: ${response.status}`
    );
  }

  return {
    success: payload.success !== false,
    label_url: payload.label_url || payload.labelUrl || null,
    label_base64: payload.label_base64 || payload.labelBase64 || null,
    content_type: payload.content_type || payload.contentType || 'application/pdf',
    tracking_number: payload.tracking_number || payload.trackingNumber || null,
    printtype: payload.printtype ?? options.printtype ?? null,
    raw: payload,
  };
};

/** Open a label URL or base64 PDF in a new tab / print dialog. */
export const openCourierLabelForPrint = (label = {}) => {
  const url = label.label_url || label.labelUrl || '';
  const b64 = label.label_base64 || label.labelBase64 || '';
  const contentType = label.content_type || label.contentType || 'application/pdf';

  if (url && /^https?:\/\//i.test(String(url))) {
    const win = window.open(String(url), '_blank', 'noopener,noreferrer');
    if (!win) throw new Error('Popup blocked — allow popups to open the TCS label.');
    return { mode: 'url', url: String(url) };
  }

  if (b64) {
    const clean = String(b64).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    if (!clean || clean.length < 32) {
      throw new Error('TCS returned an empty label PDF. Try another print layout (e.g. 6×4).');
    }

    let bytes;
    try {
      const binary = atob(clean);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    } catch {
      throw new Error('TCS label PDF could not be decoded. Try again or use another printtype.');
    }

    // PDF magic header — reject blank/corrupt blobs that render as empty pages
    const head = String.fromCharCode(...bytes.slice(0, 5));
    if (head !== '%PDF-') {
      throw new Error(
        'TCS label response was not a valid PDF (blank page). Try Shipment Label 6×4 or Single copy.'
      );
    }

    const blob = new Blob([bytes], { type: contentType || 'application/pdf' });
    if (blob.size < 100) {
      throw new Error('TCS label PDF is empty. Check the consignment number and try again.');
    }

    const objectUrl = URL.createObjectURL(blob);
    const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('Popup blocked — allow popups to open the TCS label.');
    }
    // Give the PDF viewer time to load before revoking
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    return { mode: 'blob', url: objectUrl, bytes: bytes.length };
  }

  throw new Error('No TCS label PDF returned from the courier API.');
};

/** Pull tracking id / url / courier from create-shipment API payloads. */
export const normalizeCreateShipmentResult = (payload = {}, fallbackProvider = '') => {
  const shipment =
    payload?.shipment && typeof payload.shipment === 'object' ? payload.shipment : {};
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const nestedShipment =
    data.shipment && typeof data.shipment === 'object' ? data.shipment : {};
  const apiResponse =
    (shipment.api_response && typeof shipment.api_response === 'object'
      ? shipment.api_response
      : null) ||
    (nestedShipment.api_response && typeof nestedShipment.api_response === 'object'
      ? nestedShipment.api_response
      : null) ||
    (payload.response && typeof payload.response === 'object' ? payload.response : null) ||
    {};
  const apiResult =
    apiResponse.result && typeof apiResponse.result === 'object' ? apiResponse.result : {};

  const trackingId = firstNonEmpty(
    payload.tracking_id,
    payload.trackingId,
    payload.tracking_number,
    payload.trackingNumber,
    shipment.tracking_id,
    shipment.tracking_number,
    shipment.trackingNumber,
    nestedShipment.tracking_id,
    nestedShipment.tracking_number,
    data.tracking_id,
    data.tracking_number,
    // TCS / Leopard raw booking payloads
    apiResponse.consignmentno,
    apiResponse.ConsignmentNo,
    apiResponse.track_number,
    apiResponse.tracking_number,
    apiResponse.cn,
    apiResponse.packet_cn,
    apiResult.consignmentno,
    apiResult.ConsignmentNo,
    apiResult.track_number,
    apiResponse.order?.track_number
  );

  const provider = firstNonEmpty(
    payload.courier,
    payload.provider,
    shipment.courier,
    nestedShipment.courier,
    data.courier,
    fallbackProvider
  );

  const trackingUrl = firstNonEmpty(
    payload.tracking_url,
    payload.trackingUrl,
    shipment.tracking_url,
    shipment.label_url,
    shipment.labelUrl,
    nestedShipment.tracking_url,
    nestedShipment.label_url,
    data.tracking_url,
    buildPublicTrackingUrl(provider, trackingId)
  );

  return {
    ...payload,
    queued: Boolean(payload.queued),
    tracking_id: trackingId || null,
    tracking_number: trackingId || null,
    tracking_url: trackingUrl || null,
    courier: provider || null,
    shipment: Object.keys(shipment).length ? shipment : nestedShipment || shipment,
  };
};

const firstNonEmpty = (...candidates) => {
  for (const value of candidates) {
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
};

const shipmentFromRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const nested =
    row.courier_shipment ||
    row.courierShipment ||
    row.shipment ||
    row.tracking_info ||
    row.trackingInfo ||
    null;
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested : null;
};

/** Best-effort tracking id / CN from an order list row or shipment payload. */
export const pickOrderTrackingId = (row) => {
  if (!row || typeof row !== 'object') return '';
  const shipment = shipmentFromRow(row);
  return firstNonEmpty(
    row.tracking_id,
    row.trackingId,
    row.tracking_number,
    row.trackingNumber,
    row.cn_number,
    row.cnNumber,
    row.consignment_no,
    row.consignmentNo,
    row.consignment_number,
    row.tracking,
    shipment?.tracking_id,
    shipment?.trackingId,
    shipment?.tracking_number,
    shipment?.trackingNumber,
    shipment?.cn_number
  );
};

/** @deprecated Prefer pickOrderTrackingId */
export const pickOrderTrackingNumber = pickOrderTrackingId;

/** Best-effort courier provider label from an order list row. */
export const pickOrderCourierProvider = (row) => {
  if (!row || typeof row !== 'object') return '';
  const shipment = shipmentFromRow(row);
  return firstNonEmpty(
    row.courier_provider,
    row.courierProvider,
    row.provider,
    row.courier,
    row.preferred_courier,
    shipment?.courier,
    shipment?.provider,
    shipment?.courier_provider
  );
};

/**
 * Public courier tracking page URL for a provider + tracking id.
 * Used when the API does not return tracking_url.
 */
export const buildPublicTrackingUrl = (provider, trackingId) => {
  const id = trackingId != null ? String(trackingId).trim() : '';
  if (!id) return '';
  const key = String(provider || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (key === 'tcs') {
    return `https://www.tcsexpress.com/track/?consignmentNo=${encodeURIComponent(id)}`;
  }
  if (key === 'leopard' || key === 'leopards' || key === 'lcs') {
    return `https://www.leopardscourier.com/tracking/?cn=${encodeURIComponent(id)}`;
  }
  if (key === 'postex' || key === 'post-ex') {
    return `https://postex.pk/track?trackingNumber=${encodeURIComponent(id)}`;
  }
  if (key === 'blueex') {
    return `https://www.blue-ex.com/tracking?cn=${encodeURIComponent(id)}`;
  }
  if (key === 'm&p' || key === 'mnp' || key === 'mp') {
    return `https://www.mulphilog.com/tracking/${encodeURIComponent(id)}`;
  }
  if (key === 'callcourier' || key === 'call_courier') {
    return `https://callcourier.com.pk/tracking/?tc=${encodeURIComponent(id)}`;
  }
  if (key === 'trax') {
    return `https://sonic.pk/tracking?tracking_number=${encodeURIComponent(id)}`;
  }
  return '';
};

/** Best-effort tracking URL from an order/shipment row (or built from provider + id). */
export const pickOrderTrackingUrl = (row, trackingId = '', provider = '') => {
  if (!row || typeof row !== 'object') {
    return buildPublicTrackingUrl(provider, trackingId);
  }
  const shipment = shipmentFromRow(row);
  const explicit = firstNonEmpty(
    row.tracking_url,
    row.trackingUrl,
    row.track_url,
    row.trackUrl,
    shipment?.tracking_url,
    shipment?.trackingUrl,
    shipment?.label_url,
    shipment?.labelUrl,
    row.label_url,
    row.labelUrl
  );
  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) return explicit;
    if (explicit.startsWith('/')) return explicit;
    return `https://${explicit.replace(/^\/\//, '')}`;
  }
  const id = trackingId || pickOrderTrackingId(row);
  const courier = provider || pickOrderCourierProvider(row);
  return buildPublicTrackingUrl(courier, id);
};

/** Resolve tracking display fields from an order row and/or create-shipment API result. */
export const resolveOrderTrackingInfo = (row, override = null) => {
  const source = override && typeof override === 'object' ? { ...row, ...override } : row;
  const trackingId = firstNonEmpty(
    override?.tracking_id,
    override?.trackingId,
    override?.tracking_number,
    override?.trackingNumber,
    pickOrderTrackingId(source)
  );
  const provider = firstNonEmpty(
    override?.courier,
    override?.provider,
    override?.courier_provider,
    pickOrderCourierProvider(source)
  );
  const trackingUrl = firstNonEmpty(
    override?.tracking_url,
    override?.trackingUrl,
    pickOrderTrackingUrl(source, trackingId, provider)
  );
  return {
    trackingId,
    trackingUrl,
    provider,
    hasTracking: Boolean(trackingId || trackingUrl),
  };
};

/**
 * Live tracking status — TCS GetDynamicTrackDetail (sandbox) for now.
 * GET https://devconnect.tcscourier.com/tracking/api/Tracking/GetDynamicTrackDetail?consignee={CN}
 * Requires Bearer token (sandbox token via VITE_TCS_TRACKING_BEARER_TOKEN).
 * @see https://devconnect.tcscourier.com/ecom/index.html
 */
export const TCS_TRACKING_DETAIL_URL =
  'https://devconnect.tcscourier.com/tracking/api/Tracking/GetDynamicTrackDetail';

/** Dev proxy path (vite → TCS) to avoid browser CORS on localhost. */
const TCS_TRACKING_DEV_PROXY_PATH = '/tcs-tracking/tracking/api/Tracking/GetDynamicTrackDetail';

/** Absolute TCS status API URL (dev shows proxied path → upstream host). */
export const resolveTcsTrackingStatusApiUrl = (consignee = '') => {
  const query = new URLSearchParams({
    consignee: String(consignee || '').trim(),
  });
  const qs = query.toString();
  const useDevProxy = Boolean(import.meta.env.DEV);
  if (useDevProxy) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    return {
      requestUrl: `${origin}${TCS_TRACKING_DEV_PROXY_PATH}?${qs}`,
      upstreamUrl: `${TCS_TRACKING_DETAIL_URL}?${qs}`,
      viaProxy: true,
    };
  }
  const url = `${TCS_TRACKING_DETAIL_URL}?${qs}`;
  return { requestUrl: url, upstreamUrl: url, viaProxy: false };
};

const DEFAULT_TCS_SANDBOX_BEARER =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjpbIlRyYWNrIiwiRWNvbSJdLCJjbGllbnRpZCI6IjIxNTYxMDA1OSIsInNlcnZpY2VzIjoiIiwiZXhjbHVkZWQtc2VydmljZXMiOiIiLCJpc3MiOiJ1YXQtbWlkZGxld2FyZS50cmFuenVtcGsuY29tIiwianRpIjoiMWZhNDg0ZTYtMTk3OS00ZTVhLThkZDAtM2Q2NjE2Yjk5NjgzIiwibmJmIjoxNzA5NTUzOTE2LCJleHAiOjE3OTU5NTM5MTYsImlhdCI6MTcwOTU1MzkxNn0.DVkL4xAWMaq5tepDfG9_Qevk8iX05RP7fBGGHRtZA4c';

export const resolveTcsTrackingBearerToken = (options = {}) => {
  const fromOptions = String(
    options.token || options.bearer || options.accessToken || options.access_token || ''
  ).trim();
  if (fromOptions) return fromOptions;
  const fromEnv = String(import.meta.env.VITE_TCS_TRACKING_BEARER_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_TCS_SANDBOX_BEARER;
};

/**
 * Fetch tracking status via backend (works for all couriers — PostEx, TCS, Leopard, etc.).
 * Backend routes:
 *   GET /courier/tracking/:trackingNo
 *   GET /courier/order/:orderId/tracking
 */
export const fetchCourierTrackingStatusRequest = async (orderId, options = {}) => {
  const consignee = String(
    options.consignee ||
      options.trackingId ||
      options.tracking_id ||
      options.cn ||
      ''
  ).trim();

  if (!consignee && !orderId) {
    throw new Error('Consignment / tracking number is required');
  }

  // Try tracking by tracking number first (more reliable), then by orderId
  const attempts = [];
  if (consignee) {
    attempts.push({
      url: `${BASE_URL}courier/tracking/${encodeURIComponent(consignee)}`,
      label: 'by tracking number',
    });
  }
  if (orderId) {
    attempts.push({
      url: `${BASE_URL}courier/order/${encodeURIComponent(orderId)}/tracking`,
      label: 'by order ID',
    });
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, { method: 'GET', headers: getHeaders() });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        lastError = new Error(
          payload.error || payload.message || `Tracking failed (HTTP ${response.status})`
        );
        continue;
      }

      const normalized = normalizeBackendTrackingResponse(payload, consignee);
      return {
        ...normalized,
        requestUrl: attempt.url,
        upstreamUrl: '',
        viaProxy: false,
        viaBackend: true,
      };
    } catch (err) {
      lastError = err;
    }
  }

  // All backend attempts failed — fall back to direct TCS for TCS CNs
  if (consignee) {
    try {
      return await fetchTcsTrackingStatusDirect(consignee, options);
    } catch {
      // ignore, throw original backend error
    }
  }

  throw lastError || new Error('Failed to fetch tracking status');
};

/** Normalize the backend tracking response into the UI shape. */
const normalizeBackendTrackingResponse = (payload = {}, fallbackCn = '') => {
  const history = Array.isArray(payload.history) ? payload.history : [];
  const latestEvent = history[0] || {};

  const status = firstNonEmpty(
    payload.status,
    latestEvent.status,
    payload.shipment_status
  );

  const deliveryInfo = history.map((e) => ({
    status: e.status || '',
    datetime: e.event_time || e.eventTime || e.created_at || '',
    station: e.location || '',
    code: e.status_code || '',
    recievedby: '',
  }));

  return {
    success: Boolean(payload.success),
    consignee: payload.tracking_number || fallbackCn,
    status,
    statusCode: payload.status_code || '',
    summary: '',
    message: status ? `Current status: ${status}` : 'No tracking events found.',
    receivedBy: '',
    station: latestEvent.location || '',
    datetime: latestEvent.event_time || latestEvent.eventTime || '',
    shipmentInfo: [],
    deliveryInfo,
    checkpoints: [],
    raw: payload,
  };
};

/** Direct TCS GetDynamicTrackDetail call (sandbox/production). */
const fetchTcsTrackingStatusDirect = async (consignee, options = {}) => {
  const urlInfo = resolveTcsTrackingStatusApiUrl(consignee);
  const useDevProxy = Boolean(import.meta.env.DEV);
  const baseUrl = useDevProxy ? TCS_TRACKING_DEV_PROXY_PATH : TCS_TRACKING_DETAIL_URL;
  const url = `${baseUrl}?${new URLSearchParams({ consignee }).toString()}`;

  const bearer = resolveTcsTrackingBearerToken(options);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${bearer}`,
  };

  const response = await fetch(url, { method: 'GET', headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      payload.error ||
        payload.message ||
        payload.Message ||
        `TCS tracking failed (HTTP ${response.status})`
    );
    err.requestUrl = urlInfo.requestUrl;
    err.upstreamUrl = urlInfo.upstreamUrl;
    throw err;
  }

  const normalized = normalizeCourierTrackingStatus(payload, consignee);
  const withUrls = {
    ...normalized,
    requestUrl: urlInfo.requestUrl,
    upstreamUrl: urlInfo.upstreamUrl,
    viaProxy: urlInfo.viaProxy,
    rawEmpty:
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      Object.keys(payload).length === 0,
  };

  const hasEvents =
    Boolean(normalized.status) ||
    (Array.isArray(normalized.deliveryInfo) && normalized.deliveryInfo.length > 0) ||
    (Array.isArray(normalized.checkpoints) && normalized.checkpoints.length > 0) ||
    (Array.isArray(normalized.shipmentInfo) && normalized.shipmentInfo.length > 0) ||
    Boolean(normalized.summary);

  if (!hasEvents) {
    return {
      ...withUrls,
      message: withUrls.rawEmpty
        ? `TCS sandbox returned {} for CN ${consignee}. Booking succeeded, but GetDynamicTrackDetail often has no scan events in sandbox (same empty body for TCS sample CNs). Use production tracking (ociconnect) with a production token for live statuses.`
        : normalized.message && String(normalized.message).toUpperCase() !== 'SUCCESS'
          ? normalized.message
          : `No tracking events found for CN ${consignee} on TCS sandbox.`,
    };
  }

  return withUrls;
};

/** Normalize TCS GetDynamicTrackDetail (and similar) payloads for the UI. */
export const normalizeCourierTrackingStatus = (payload = {}, fallbackCn = '') => {
  const root =
    (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : null) ||
    (payload?.result && typeof payload.result === 'object' && !Array.isArray(payload.result)
      ? payload.result
      : null) ||
    (payload?.tracking && typeof payload.tracking === 'object' ? payload.tracking : null) ||
    payload;

  const asArray = (value) => (Array.isArray(value) ? value : []);

  const shipmentInfo = asArray(
    root.shipmentinfo || root.shipmentInfo || root.shipment_info || root.ShipmentInfo
  );
  const deliveryInfo = asArray(
    root.deliveryinfo || root.deliveryInfo || root.delivery_info || root.DeliveryInfo
  );
  const checkpoints = asArray(
    root.checkpoints || root.Checkpoints || root.tracking_history || root.history
  );

  const firstShipment = shipmentInfo[0] || {};
  const firstDelivery = deliveryInfo[0] || {};
  const firstCheckpoint = checkpoints[0] || {};

  const consignee = firstNonEmpty(
    firstShipment.consignmentno,
    firstShipment.consignmentNo,
    firstShipment.consignment_no,
    firstDelivery.consignmentno,
    payload.consignee,
    payload.consignment_no,
    fallbackCn
  );

  const status = firstNonEmpty(
    firstDelivery.status,
    firstCheckpoint.status,
    root.status,
    root.current_status,
    root.currentStatus,
    root.transactionStatus,
    root.transaction_status,
    root.orderStatus,
    root.order_status,
    payload.status,
    payload.transactionStatus,
    payload.orderStatus
  );

  const statusCode = firstNonEmpty(
    firstDelivery.code,
    firstDelivery.status_code,
    firstDelivery.statusCode,
    root.code,
    payload.code
  );

  const summary = firstNonEmpty(
    root.shipmentsummary,
    root.shipmentSummary,
    root.shipment_summary,
    root.summary,
    payload.shipmentsummary
  );

  const message = firstNonEmpty(
    root.message,
    payload.message,
    status ? `Current status: ${status}` : ''
  );

  return {
    success: payload.success !== false && String(message).toUpperCase() !== 'FAILED',
    consignee,
    status,
    statusCode,
    summary,
    message: message || 'SUCCESS',
    receivedBy: firstNonEmpty(firstDelivery.recievedby, firstDelivery.receivedby, firstDelivery.received_by),
    station: firstNonEmpty(firstDelivery.station, firstShipment.destination),
    datetime: firstNonEmpty(firstDelivery.datetime, firstCheckpoint.datetime),
    shipmentInfo,
    deliveryInfo,
    checkpoints,
    raw: payload,
  };
};
