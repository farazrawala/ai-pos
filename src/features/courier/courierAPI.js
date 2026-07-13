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

export const pickCourierId = (item) =>
  item?._id || item?.id || item?.courier_id || '';

/** Map saved courier integration `type` → shipment API `provider` key. */
export const courierTypeToProvider = (type) => {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  if (key === 'tcs') return 'TCS';
  if (key === 'leopard' || key === 'leopards' || key === 'lcs') return 'Leopard';
  if (key === 'blueex' || key === 'blue-ex') return 'BlueEX';
  if (key === 'm&p' || key === 'mnp' || key === 'mp') return 'M&P';
  if (key === 'call courier' || key === 'callcourier') return 'Call Courier';
  if (key === 'trax') return 'Trax';
  return String(type).trim();
};

/**
 * Create a courier shipment for an order.
 * POST /courier/create/:orderId
 * body: { provider?: string, courier_id?: string }
 */
export const createCourierShipmentRequest = async (orderId, options = {}) => {
  if (!orderId) throw new Error('Order id is required');

  const provider =
    typeof options === 'string' ? options : options?.provider || '';
  const courierId = typeof options === 'object' ? options?.courierId || options?.courier_id || '' : '';

  const body = {
    // Book immediately — do not accept a queue ack without a tracking number.
    queueOnUnavailable: false,
    async: false,
  };
  const trimmed = typeof provider === 'string' ? provider.trim() : '';
  if (trimmed) body.provider = trimmed;
  if (courierId) body.courier_id = String(courierId);

  const response = await fetch(`${BASE_URL}courier/create/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || payload.message || `HTTP error! status: ${response.status}`
    );
  }

  return normalizeCreateShipmentResult(payload, trimmed);
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
  if (key === 'blueex') {
    return `https://www.blue-ex.com/tracking?cn=${encodeURIComponent(id)}`;
  }
  if (key === 'm&p' || key === 'mnp' || key === 'mp') {
    return `https://www.mulphilog.com/tracking/${encodeURIComponent(id)}`;
  }
  if (key === 'callcourier') {
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
