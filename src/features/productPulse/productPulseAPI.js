import { API_BASE_URL, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import {
  fetchProductActiveRequest,
  fetchProductByIdRequest,
  fetchProductVariationRequest,
} from '../products/productsAPI.js';
import {
  fetchProfitByOrderItemRequest,
  parseProfitNumber,
} from '../profitReport/profitReportAPI.js';
import { fetchOrdersRequest, getOrderLineItems, pickOrderDocumentId, pickOrderInvoiceNo } from '../orders/ordersAPI.js';
import { fetchWarehousesRequest } from '../warehouse/warehouseAPI.js';
import { fetchSalesReturnsListRequest } from '../salesReturns/salesReturnsAPI.js';
import {
  addDaysYmd,
  aggregateMetrics,
  aggregateVariants,
  aggregateWarehouses,
  attachTrend,
  buildInsights,
  buildTimelineBuckets,
  classifyProductHealth,
  fillTimeline,
  formatYmd,
  hasVariants,
  identifyVariantHighlights,
  inclusiveDayCount,
  isDateInRange,
  matchesProductScope,
  metricsFromProfitTotals,
  normalizeSaleLine,
  normalizeTimelinePoints,
  parsePulseNumber,
  timelineHasChartableData,
  previousEquivalentRange,
  refId,
  resolveDateRange,
  roundMoney,
  skipLimitFromPage,
  toSalesHistoryRow,
  variantDisplayName,
} from './productPulseEngine.js';

const BASE_URL = `${API_BASE_URL}/`;

/** Dedicated ProductPulse paths (tried first; 404 falls back to existing APIs). */
export const PRODUCT_PULSE_OVERVIEW_PATH = 'product/pulse';
export const PRODUCT_PULSE_ALT_OVERVIEW_PATH = 'product-pulse';
export const ORDER_ITEM_LIST_PATHS = [
  'order_item/get-all-active',
  'order_items/get-all-active',
];

const SALE_LINE_POPULATE = 'product_id,order_id,warehouse_id,customer_id';
const LINE_PAGE_LIMIT = 100;
const MAX_LINE_PAGES = 50;
const VARIANT_CONCURRENCY = 8;

function emitPulseProgress(onProgress, payload) {
  if (typeof onProgress === 'function' && payload && typeof payload === 'object') {
    onProgress(payload);
  }
}

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function parseApiError(response, fallback) {
  const text = await response.text().catch(() => '');
  let message = fallback || `Request failed (${response.status})`;
  if (text) {
    try {
      const j = JSON.parse(text);
      if (j?.message) message = j.message;
      else if (typeof j?.error === 'string' && j.error) message = j.error;
    } catch {
      const one = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
      if (one) message = one;
    }
  }
  const err = new Error(message);
  err.status = response.status;
  throw err;
}

function unwrapEntity(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data.product && typeof result.data.product === 'object'
      ? result.data.product
      : result.data;
  }
  if (result.product && typeof result.product === 'object') return result.product;
  return result;
}

function unwrapList(result) {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.products)) return result.products;
  if (Array.isArray(result.variations)) return result.variations;
  if (Array.isArray(result.childproducts)) return result.childproducts;
  if (Array.isArray(result.order_items)) return result.order_items;
  if (Array.isArray(result.sales)) return result.sales;
  if (Array.isArray(result)) return result;
  return [];
}

export function isMongoObjectId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}

export function buildPulseQuery(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) {
    query.set('from', String(params.startDate));
    query.set('startDate', String(params.startDate));
  }
  if (params.endDate) {
    query.set('to', addDaysYmd(String(params.endDate), 1));
    query.set('endDate', addDaysYmd(String(params.endDate), 1));
  }
  if (params.variantId) query.set('variant_id', String(params.variantId));
  if (params.warehouseId) query.set('warehouse_id', String(params.warehouseId));
  if (params.granularity) query.set('granularity', String(params.granularity));
  if (params.page && params.limit) {
    const { skip, limit } = skipLimitFromPage(params.page, params.limit);
    query.set('skip', String(skip));
    query.set('limit', String(limit));
  } else if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.sortBy) query.set('sortBy', String(params.sortBy));
  if (params.sortOrder) query.set('sortOrder', String(params.sortOrder));
  if (params.cursor) query.set('cursor', String(params.cursor));
  return query;
}

export function buildProductPulseOverviewUrl(productId, params = {}) {
  const id = encodeURIComponent(String(productId || '').trim());
  const qs = buildPulseQuery(params).toString();
  return `${BASE_URL}${PRODUCT_PULSE_OVERVIEW_PATH}/${id}${qs ? `?${qs}` : ''}`;
}

export function buildProductPulseTimelineUrl(productId, params = {}) {
  const id = encodeURIComponent(String(productId || '').trim());
  const qs = buildPulseQuery(params).toString();
  return `${BASE_URL}${PRODUCT_PULSE_OVERVIEW_PATH}/${id}/timeline${qs ? `?${qs}` : ''}`;
}

export function buildProductPulseVariantsUrl(productId, params = {}) {
  const id = encodeURIComponent(String(productId || '').trim());
  const qs = buildPulseQuery(params).toString();
  return `${BASE_URL}${PRODUCT_PULSE_OVERVIEW_PATH}/${id}/variants${qs ? `?${qs}` : ''}`;
}

export function buildProductPulseWarehousesUrl(productId, params = {}) {
  const id = encodeURIComponent(String(productId || '').trim());
  const qs = buildPulseQuery(params).toString();
  return `${BASE_URL}${PRODUCT_PULSE_OVERVIEW_PATH}/${id}/warehouses${qs ? `?${qs}` : ''}`;
}

export function buildProductPulseSalesUrl(productId, params = {}) {
  const id = encodeURIComponent(String(productId || '').trim());
  const qs = buildPulseQuery({ ...params, sortBy: params.sortBy || 'createdAt', sortOrder: params.sortOrder || 'desc' }).toString();
  return `${BASE_URL}${PRODUCT_PULSE_OVERVIEW_PATH}/${id}/sales${qs ? `?${qs}` : ''}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) {
    await parseApiError(response, `Request failed (${response.status})`);
  }
  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Request was not successful';
    throw new Error(msg);
  }
  return result;
}

async function fetchDedicatedOrNull(url) {
  try {
    const response = await fetch(url, { method: 'GET', headers: getHeaders() });
    if (response.status === 404 || response.status === 405) return null;
    if (response.status === 401 || response.status === 403) {
      await parseApiError(response, 'You do not have access to this product.');
    }
    if (!response.ok) {
      await parseApiError(response, `Request failed (${response.status})`);
    }
    const result = await response.json().catch(() => ({}));
    if (result && result.success === false) return null;
    return result;
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) throw err;
    if (err?.status === 404 || err?.status === 405) return null;
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) || 0 }, async () => {
    while (next < list.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(list[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function categoryLabel(product) {
  const cats = product?.category_id ?? product?.categoryId ?? product?.category;
  const first = Array.isArray(cats) ? cats[0] : cats;
  if (first && typeof first === 'object') {
    return String(first.name ?? first.category_name ?? '').trim();
  }
  return String(product?.category_name ?? '').trim();
}

function brandLabel(product) {
  const brand = product?.brand_id ?? product?.brandId ?? product?.brand;
  if (brand && typeof brand === 'object') {
    return String(brand.name ?? brand.brand_name ?? '').trim();
  }
  return String(product?.brand_name ?? '').trim();
}

function productImage(product) {
  const raw = product?.product_image ?? product?.image ?? product?.thumbnail;
  return raw ? resolveCategoryMediaUrl(raw) : '';
}

export function normalizeProductCard(product, selectedVariant = null) {
  if (!product || typeof product !== 'object') {
    return {
      product: null,
      selectedVariant: null,
    };
  }
  const id = refId(product._id ?? product.id);
  const variantsExist = hasVariants(product);
  return {
    product: {
      id,
      name: String(product.product_name ?? product.name ?? 'Product').trim() || 'Product',
      sku: String(product.sku ?? product.product_code ?? '').trim(),
      barcode: String(product.barcode ?? '').trim(),
      category: categoryLabel(product),
      brand: brandLabel(product),
      hasVariants: variantsExist,
      image: productImage(product),
      type: String(product.product_type ?? 'Single'),
    },
    selectedVariant: selectedVariant
      ? {
          id: refId(selectedVariant._id ?? selectedVariant.id),
          name: variantDisplayName(selectedVariant) || String(selectedVariant.product_name ?? '').trim(),
          sku: String(selectedVariant.sku ?? selectedVariant.product_code ?? '').trim(),
        }
      : null,
  };
}

function nestedVariationRows(source) {
  if (!source || typeof source !== 'object') return [];
  if (Array.isArray(source)) return source;
  const kids =
    source.childproducts ??
    source.child_products ??
    source.variations ??
    source.children ??
    source.data;
  return Array.isArray(kids) ? kids : [];
}

export function normalizeVariationList(result, parentProduct = null) {
  let rows = unwrapList(result);
  if (rows.length === 0) rows = nestedVariationRows(unwrapEntity(result) || result);
  if (rows.length === 0 && parentProduct) rows = nestedVariationRows(parentProduct);
  const parentId = refId(parentProduct?._id ?? parentProduct?.id);
  const seen = new Set();
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const id = refId(row._id ?? row.id ?? row.product_id);
      if (!id || (parentId && id === parentId) || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        _id: id,
        name: variantDisplayName(row) || String(row.product_name ?? row.name ?? '').trim() || 'Variant',
        product_name: row.product_name ?? row.name,
        sku: String(row.sku ?? row.product_code ?? '').trim(),
        barcode: String(row.barcode ?? '').trim(),
        product_image: row.product_image,
      };
    })
    .filter(Boolean);
}

export function sellableProductIds(product, variations, variantId) {
  const parentId = refId(product?._id ?? product?.id);
  const kids = Array.isArray(variations) ? variations : [];
  if (variantId) {
    const id = String(variantId).trim();
    return id ? [id] : parentId ? [parentId] : [];
  }
  if (kids.length) return kids.map((v) => v.id).filter(Boolean);
  return parentId ? [parentId] : [];
}

function parseListPagination(result, params = {}) {
  const data = unwrapList(result);
  if (result?.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const limit = Number(pagination.limit) || params.limit || LINE_PAGE_LIMIT;
    const skip = Number(pagination.skip) || 0;
    const total = Number(pagination.total) || data.length;
    const page = limit > 0 ? Math.floor(skip / limit) + 1 : params.page || 1;
    return {
      data,
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      cursor: pagination.cursor ?? pagination.next_cursor ?? result.next_cursor ?? null,
    };
  }
  const limit = Number(result?.limit ?? params.limit) || data.length || LINE_PAGE_LIMIT;
  const total = Number(result?.total) || data.length;
  const page = Number(result?.page ?? params.page) || 1;
  return {
    data,
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    cursor: result?.cursor ?? result?.next_cursor ?? null,
  };
}

let orderItemListPathCache = null;

async function fetchOrderItemPage(params = {}) {
  const paths = orderItemListPathCache ? [orderItemListPathCache] : ORDER_ITEM_LIST_PATHS;
  let lastErr = null;

  for (const path of paths) {
    const query = new URLSearchParams();
    query.set('populate', SALE_LINE_POPULATE);
    const { skip, limit } = skipLimitFromPage(params.page || 1, params.limit || LINE_PAGE_LIMIT);
    query.set('skip', String(skip));
    query.set('limit', String(limit));
    query.set('sortBy', String(params.sortBy || 'createdAt'));
    query.set('sortOrder', String(params.sortOrder || 'desc'));
    if (params.startDate) {
      query.set('from', String(params.startDate));
      query.set('startDate', String(params.startDate));
    }
    if (params.endDate) {
      query.set('to', addDaysYmd(String(params.endDate), 1));
      query.set('endDate', addDaysYmd(String(params.endDate), 1));
    }
    if (params.productId) query.set('product_id', String(params.productId));
    if (params.parentProductId) query.set('parent_product_id', String(params.parentProductId));
    if (params.warehouseId) query.set('warehouse_id', String(params.warehouseId));
    if (params.search) query.set('search', String(params.search));

    const url = `${BASE_URL}${path}?${query.toString()}`;
    try {
      const response = await fetch(url, { method: 'GET', headers: getHeaders() });
      if (response.status === 404 || response.status === 405) {
        lastErr = new Error('not found');
        continue;
      }
      if (!response.ok) {
        await parseApiError(response, `Failed to load sales (${response.status})`);
      }
      const result = await response.json().catch(() => ({}));
      orderItemListPathCache = path;
      return parseListPagination(result, params);
    } catch (err) {
      lastErr = err;
      if (err?.status && err.status !== 404 && err.status !== 405) throw err;
    }
  }

  if (lastErr && lastErr.status && lastErr.status !== 404) throw lastErr;
  return null;
}

function linesFromOrderItemRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const looksLikeOrder =
      row.order_items || row.orderItems || row.order_no || row.orderNo;
    if (looksLikeOrder && !row.qty && !row.price) {
      for (const item of getOrderLineItems(row)) {
        const line = normalizeSaleLine(item, row);
        if (line) out.push(line);
      }
      continue;
    }
    const order =
      row.order_id && typeof row.order_id === 'object'
        ? row.order_id
        : {
            _id: row.order_id ?? row.orderId,
            order_no: row.order_no ?? row.orderNo,
            name: row.customer_name ?? row.name,
            customer_id: row.customer_id,
            warehouse_id: row.warehouse_id,
            createdAt: row.createdAt ?? row.created_at,
            order_status: row.order_status ?? row.status,
          };
    const line = normalizeSaleLine(row, order);
    if (line) out.push(line);
  }
  return out;
}

function scopeSaleLines(lines, { productIds, warehouseId, startDate, endDate }) {
  return (Array.isArray(lines) ? lines : []).filter((line) => {
    if (!matchesProductScope(line, { productIds, warehouseId })) return false;
    if ((startDate || endDate) && line.soldOn) return isDateInRange(line.soldOn, startDate, endDate);
    return true;
  });
}

async function fetchSaleLinesFromOrderList(params = {}) {
  const productIds = (Array.isArray(params.productIds) ? params.productIds : [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (!productIds.length) return { lines: [], truncated: false, source: 'none' };

  const warehouseId = params.warehouseId ? String(params.warehouseId).trim() : '';
  let truncated = false;

  const fetchForProduct = async (productId) => {
    let page = 1;
    let totalPages = 1;
    const pages = [];
    while (page <= totalPages && page <= MAX_LINE_PAGES) {
      let result = null;
      try {
        result = await fetchOrdersRequest({
          page,
          limit: LINE_PAGE_LIMIT,
          productId,
          warehouseId,
          startDate: params.startDate,
          endDate: params.endDate,
          sortBy: 'createdAt',
          sortOrder: 'asc',
          populate: SALE_LINE_POPULATE,
        });
      } catch {
        break;
      }
      if (!result) break;
      pages.push(...linesFromOrderItemRows(result.data));
      totalPages = Math.max(result.totalPages || 1, 1);
      if (page >= MAX_LINE_PAGES && totalPages > MAX_LINE_PAGES) truncated = true;
      if (!result.data?.length) break;
      page += 1;
    }
    return pages;
  };

  const collected = [];
  if (productIds.length === 1) {
    collected.push(...(await fetchForProduct(productIds[0])));
  } else {
    const batches = await mapWithConcurrency(productIds, VARIANT_CONCURRENCY, fetchForProduct);
    for (const batch of batches) collected.push(...(batch || []));
  }

  return {
    lines: scopeSaleLines(collected, {
      productIds,
      warehouseId,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    truncated,
    source: 'order_list',
  };
}

/**
 * Product-scoped sale lines via paginated order_item APIs, then the order list.
 * Stops at MAX_LINE_PAGES so the browser never holds an unbounded collection.
 */
export async function fetchProductSaleLines(params = {}) {
  const productIds = (Array.isArray(params.productIds) ? params.productIds : [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (!productIds.length) return { lines: [], truncated: false, source: 'none' };

  const warehouseId = params.warehouseId ? String(params.warehouseId).trim() : '';
  const startDate = params.startDate;
  const endDate = params.endDate;
  const collected = [];
  let truncated = false;
  let source = 'order_item';

  const fetchForProduct = async (productId) => {
    let page = 1;
    let totalPages = 1;
    const pages = [];
    while (page <= totalPages && page <= MAX_LINE_PAGES) {
      const result = await fetchOrderItemPage({
        page,
        limit: LINE_PAGE_LIMIT,
        productId,
        parentProductId: params.parentProductId,
        warehouseId,
        startDate,
        endDate,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });
      if (!result) {
        source = 'none';
        break;
      }
      pages.push(...linesFromOrderItemRows(result.data));
      totalPages = Math.max(result.totalPages || 1, 1);
      if (page >= MAX_LINE_PAGES && totalPages > MAX_LINE_PAGES) truncated = true;
      if (!result.data.length) break;
      page += 1;
    }
    return pages;
  };

  if (productIds.length === 1) {
    collected.push(...(await fetchForProduct(productIds[0])));
  } else {
    const batches = await mapWithConcurrency(productIds, VARIANT_CONCURRENCY, fetchForProduct);
    for (const batch of batches) collected.push(...(batch || []));
  }

  const scoped = scopeSaleLines(collected, { productIds, warehouseId, startDate, endDate });
  if (scoped.length) {
    return { lines: scoped, truncated, source };
  }

  const fromOrders = await fetchSaleLinesFromOrderList(params);
  if (fromOrders.lines.length) return fromOrders;
  return { lines: scoped, truncated, source };
}

export async function fetchProductPulseProduct(productId) {
  const id = String(productId || '').trim();
  if (!id || !isMongoObjectId(id)) {
    const err = new Error('A valid product id is required.');
    err.status = 400;
    throw err;
  }
  const raw = await fetchProductByIdRequest(id);
  const product = unwrapEntity(raw);
  if (!product || typeof product !== 'object') {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }
  let variations = [];
  if (hasVariants(product)) {
    try {
      const variationRaw = await fetchProductVariationRequest(id);
      variations = normalizeVariationList(variationRaw, product);
    } catch {
      variations = normalizeVariationList(null, product);
    }
  }
  return { product, variations };
}

async function sumProfitTotals(productIds, params) {
  const ids = (Array.isArray(productIds) ? productIds : []).filter(Boolean);
  if (!ids.length) return { profit: 0, subtotal: 0, lineCount: 0, total_qty: 0, totalCOGS: 0 };

  const reports = await mapWithConcurrency(ids, VARIANT_CONCURRENCY, async (productId) => {
    try {
      const { report, raw } = await fetchProfitByOrderItemRequest({
        startDate: params.startDate,
        endDate: params.endDate,
        productId,
        warehouseId: params.warehouseId,
      });
      return {
        profit: report?.profit,
        subtotal: report?.subtotal,
        lineCount: report?.lineCount,
        total_qty: parseProfitNumber(
          raw?.total_qty ?? raw?.totalQty ?? raw?.qty ?? raw?.unitsSold ?? report?.total_qty
        ),
        totalCOGS: parseProfitNumber(
          raw?.totalCOGS ?? raw?.cogs ?? raw?.cost_of_goods_sold ?? raw?.total_cogs
        ),
      };
    } catch {
      return { profit: 0, subtotal: 0, lineCount: 0, total_qty: 0, totalCOGS: 0 };
    }
  });

  return reports.reduce(
    (acc, report) => ({
      profit: acc.profit + parseProfitNumber(report?.profit),
      subtotal: acc.subtotal + parseProfitNumber(report?.subtotal),
      lineCount: acc.lineCount + (Number(report?.lineCount) || 0),
      total_qty: acc.total_qty + parseProfitNumber(report?.total_qty),
      totalCOGS: acc.totalCOGS + parseProfitNumber(report?.totalCOGS),
    }),
    { profit: 0, subtotal: 0, lineCount: 0, total_qty: 0, totalCOGS: 0 }
  );
}

function returnLineProductId(item, doc) {
  const ref = item?.product_id ?? item?.productId ?? doc?.product_id;
  return refId(ref);
}

function returnLineQty(item) {
  return parsePulseNumber(item?.qty ?? item?.quantity ?? item?.return_qty, 0);
}

function returnLineAmount(item) {
  const qty = returnLineQty(item);
  const price = parsePulseNumber(item?.price ?? item?.unit_price ?? item?.rate, 0);
  return Math.abs(parsePulseNumber(item?.subtotal ?? item?.total ?? qty * price, 0));
}

function salesReturnItems(doc) {
  if (!doc || typeof doc !== 'object') return [];
  const keys = [
    'sales_return_items',
    'salesReturnItems',
    'sales_order_return_items',
    'items',
    'lines',
  ];
  for (const key of keys) {
    if (Array.isArray(doc[key])) return doc[key];
  }
  return [];
}

export async function fetchReturnedUnitsForProducts(productIds, params = {}) {
  const ids = new Set((Array.isArray(productIds) ? productIds : []).map(String));
  if (!ids.size) return { returnedUnits: 0, refundAmount: 0 };

  let returnedUnits = 0;
  let refundAmount = 0;
  let page = 1;
  let totalPages = 1;
  const maxPages = 10;

  while (page <= totalPages && page <= maxPages) {
    let result;
    try {
      result = await fetchSalesReturnsListRequest({
        page,
        limit: 100,
        startDate: params.startDate,
        endDate: params.endDate,
        product_id: productIds.length === 1 ? productIds[0] : undefined,
      });
    } catch {
      break;
    }
    const rows = Array.isArray(result?.data) ? result.data : [];
    totalPages = Math.max(result?.totalPages || 1, 1);
    for (const doc of rows) {
      const items = salesReturnItems(doc);
      if (!items.length) {
        const pid = returnLineProductId(doc, doc);
        if (pid && ids.has(pid)) {
          const qty = returnLineQty(doc);
          returnedUnits += qty;
          refundAmount += returnLineAmount(doc);
        }
        continue;
      }
      for (const item of items) {
        const pid = returnLineProductId(item, doc);
        if (!pid || !ids.has(pid)) continue;
        returnedUnits += Math.abs(returnLineQty(item));
        refundAmount += returnLineAmount(item);
      }
    }
    if (!rows.length) break;
    page += 1;
  }

  return { returnedUnits: roundMoney(returnedUnits), refundAmount: roundMoney(refundAmount) };
}

function dedicatedOverviewLooksValid(result) {
  if (!result || typeof result !== 'object') return false;
  const metrics = result.metrics ?? result.data?.metrics ?? result;
  return (
    metrics &&
    typeof metrics === 'object' &&
    (metrics.unitsSold != null ||
      metrics.netRevenue != null ||
      metrics.grossRevenue != null ||
      metrics.grossProfit != null ||
      result.product != null)
  );
}

function normalizeDedicatedOverview(result, fallbackCard) {
  const root = result?.data && typeof result.data === 'object' ? result.data : result;
  const metricsIn = root.metrics && typeof root.metrics === 'object' ? root.metrics : root;
  const productIn = root.product ?? fallbackCard.product;
  const selectedVariant = root.selectedVariant ?? fallbackCard.selectedVariant;
  const periodDays = inclusiveDayCount(root.startDate, root.endDate) || 0;

  const metrics = attachTrend(
    metricsFromProfitTotals(
      {
        subtotal: metricsIn.grossRevenue ?? metricsIn.subtotal,
        profit: metricsIn.grossProfit ?? metricsIn.profit,
        totalCOGS: metricsIn.totalCOGS ?? metricsIn.cogs,
        discount: metricsIn.discount,
        refundAmount: metricsIn.refundAmount,
        unitsSold: metricsIn.unitsSold,
        returnedUnits: metricsIn.returnedUnits,
        firstSoldAt: metricsIn.firstSoldAt,
        lastSoldAt: metricsIn.lastSoldAt,
        ordersCount: metricsIn.ordersCount,
      },
      {
        discount: metricsIn.discount,
        refundAmount: metricsIn.refundAmount,
        unitsSold: metricsIn.unitsSold,
        returnedUnits: metricsIn.returnedUnits,
        ordersCount: metricsIn.ordersCount,
        firstSoldAt: metricsIn.firstSoldAt,
        lastSoldAt: metricsIn.lastSoldAt,
        daysSinceLastSale: metricsIn.daysSinceLastSale,
        periodDays,
      }
    ),
    metricsFromProfitTotals({
      subtotal: metricsIn.trend?.previousRevenue ?? metricsIn.previousRevenue,
      profit: metricsIn.trend?.previousProfit ?? metricsIn.previousProfit,
      unitsSold: metricsIn.trend?.previousUnitsSold ?? metricsIn.previousUnitsSold,
    })
  );

  return {
    product: productIn,
    selectedVariant,
    metrics: {
      ...metrics,
      firstSoldAt: metricsIn.firstSoldAt ?? metrics.firstSoldAt,
      lastSoldAt: metricsIn.lastSoldAt ?? metrics.lastSoldAt,
      ordersCount: Number(metricsIn.ordersCount ?? metrics.ordersCount) || 0,
      unitsSold: parsePulseNumber(metricsIn.unitsSold, metrics.unitsSold),
    },
    insights: Array.isArray(root.insights) ? root.insights : null,
    health: root.health ?? null,
    source: 'dedicated',
  };
}

function pulseSearchOption(row, extras = {}) {
  if (!row || typeof row !== 'object') return null;
  const id = refId(row._id ?? row.id ?? row.product_id);
  if (!id) return null;
  const parentId = extras.parentId || refId(row.parent_product_id ?? row.parentProductId);
  const isChild = Boolean(parentId && parentId !== id);
  const name = String(row.product_name ?? row.name ?? extras.parentName ?? 'Product').trim() || 'Product';
  const variantName = isChild ? variantDisplayName(row) || name : name;
  const sku = String(row.sku ?? row.product_code ?? row.barcode ?? '').trim();
  const parentName = extras.parentName || '';
  return {
    value: id,
    label: isChild && parentName && !name.includes(parentName) ? `${parentName} · ${variantName}` : isChild ? variantName : name,
    subLabel: [sku, isChild ? 'Variant' : hasVariants(row) ? 'All variants' : row.product_type]
      .filter(Boolean)
      .join(' · '),
    parentId: isChild ? parentId : '',
    isVariantChild: isChild,
    image: productImage(row) || extras.image || '',
    raw: row,
  };
}

/** Parent products plus nested child variants as selectable search rows. */
export function buildPulseSearchOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  const seen = new Set();
  const push = (option) => {
    if (!option?.value || seen.has(option.value)) return;
    seen.add(option.value);
    out.push(option);
  };

  for (const row of list) {
    const parent = pulseSearchOption(row);
    push(parent);
    const parentId = parent?.value || refId(row?._id ?? row?.id);
    const parentName = parent?.isVariantChild ? '' : parent?.label || '';
    for (const kid of nestedVariationRows(row)) {
      push(
        pulseSearchOption(kid, {
          parentId,
          parentName,
          image: parent?.image,
        })
      );
    }
  }
  return out;
}

export async function searchProductsForPulse(query) {
  const search = String(query || '').trim();
  if (!search) return [];
  const result = await fetchProductActiveRequest({
    search,
    page: 1,
    limit: 20,
    includeInactive: true,
  });
  const rows = Array.isArray(result?.data) ? result.data : [];
  const options = buildPulseSearchOptions(rows);

  const needsVariationFetch = rows.filter((row) => {
    const id = refId(row?._id ?? row?.id);
    if (!id || !hasVariants(row) || nestedVariationRows(row).length) return false;
    return !options.some((opt) => opt.parentId === id);
  }).slice(0, 6);

  if (!needsVariationFetch.length) return options;

  const extra = await mapWithConcurrency(needsVariationFetch, 3, async (row) => {
    const parentId = refId(row._id ?? row.id);
    const parentName = String(row.product_name ?? row.name ?? 'Product').trim() || 'Product';
    try {
      const raw = await fetchProductVariationRequest(parentId);
      return normalizeVariationList(raw, row).map((variant) =>
        pulseSearchOption(variant, { parentId, parentName, image: productImage(row) })
      );
    } catch {
      return [];
    }
  });

  const seen = new Set(options.map((opt) => opt.value));
  for (const list of extra) {
    for (const option of list) {
      if (!option?.value || seen.has(option.value)) continue;
      seen.add(option.value);
      options.push(option);
    }
  }
  return options;
}

export async function fetchWarehousesForPulse() {
  try {
    const result = await fetchWarehousesRequest({ page: 1, limit: 200, sortBy: 'name', sortOrder: 'asc' });
    return Array.isArray(result?.data) ? result.data : [];
  } catch {
    return [];
  }
}

async function composeOverview({ product, variations, params, productIds, selectedVariant }) {
  const periodDays = inclusiveDayCount(params.startDate, params.endDate);
  const previous = previousEquivalentRange(params.startDate, params.endDate);
  const card = normalizeProductCard(product, selectedVariant);

  const [currentTotals, previousTotals, returnsInfo, salePack] = await Promise.all([
    sumProfitTotals(productIds, params),
    sumProfitTotals(productIds, { ...params, startDate: previous.startDate, endDate: previous.endDate }),
    fetchReturnedUnitsForProducts(productIds, params),
    fetchProductSaleLines({
      productIds,
      parentProductId: card.product?.id,
      warehouseId: params.warehouseId,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
  ]);

  const lineMetrics = aggregateMetrics(salePack.lines, {
    periodDays,
    returnedUnits: returnsInfo.returnedUnits,
    refundAmount: returnsInfo.refundAmount,
  });

  const moneyMetrics = metricsFromProfitTotals(currentTotals, {
    discount: lineMetrics.discount,
    refundAmount: returnsInfo.refundAmount,
    unitsSold: lineMetrics.unitsSold || currentTotals.total_qty,
    returnedUnits: returnsInfo.returnedUnits || lineMetrics.returnedUnits,
    ordersCount: lineMetrics.ordersCount || currentTotals.lineCount,
    firstSoldAt: lineMetrics.firstSoldAt,
    lastSoldAt: lineMetrics.lastSoldAt,
    daysSinceLastSale: lineMetrics.daysSinceLastSale,
    averageDaysBetweenSales: lineMetrics.averageDaysBetweenSales,
    periodDays,
    missingHistoricalCostCount: lineMetrics.missingHistoricalCostCount,
  });

  const previousMoney = metricsFromProfitTotals(previousTotals, {
    unitsSold: parsePulseNumber(previousTotals.total_qty ?? previousTotals.unitsSold, 0),
    ordersCount: Number(previousTotals.order_count ?? previousTotals.lineCount) || 0,
    periodDays,
  });

  const metrics = attachTrend(moneyMetrics, previousMoney);
  const health = classifyProductHealth(metrics);

  return {
    ...card,
    metrics,
    health,
    insights: null,
    truncated: salePack.truncated,
    source: salePack.source === 'none' ? 'profit-totals' : 'composed',
    missingHistoricalCostCount: lineMetrics.missingHistoricalCostCount,
    lines: salePack.lines,
  };
}

export async function fetchProductPulseOverview(params = {}) {
  const { onProgress, ...queryParams } = params;
  const productId = String(queryParams.productId || '').trim();
  if (!isMongoObjectId(productId)) {
    const err = new Error('A valid product id is required.');
    err.status = 400;
    throw err;
  }
  if (queryParams.variantId && !isMongoObjectId(queryParams.variantId)) {
    const err = new Error('A valid variant id is required.');
    err.status = 400;
    throw err;
  }
  if (queryParams.warehouseId && !isMongoObjectId(queryParams.warehouseId)) {
    const err = new Error('A valid warehouse id is required.');
    err.status = 400;
    throw err;
  }

  const range = resolveDateRange(queryParams.preset, {
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  });
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    variantId: queryParams.variantId ? String(queryParams.variantId).trim() : '',
    warehouseId: queryParams.warehouseId ? String(queryParams.warehouseId).trim() : '',
  };

  emitPulseProgress(onProgress, {
    stage: 'loading',
    label: 'This section is loading',
    detail: 'Loading product details…',
    percent: 12,
  });
  const { product, variations } = await fetchProductPulseProduct(productId);
  const selectedVariant = query.variantId
    ? variations.find((v) => v.id === query.variantId) || null
    : null;
  if (query.variantId && variations.length && !selectedVariant) {
    const err = new Error('That variant does not belong to this product.');
    err.status = 400;
    throw err;
  }
  const productIds = sellableProductIds(product, variations, query.variantId);
  const card = normalizeProductCard(product, selectedVariant);

  emitPulseProgress(onProgress, {
    stage: 'loading',
    label: 'This section is loading',
    detail: 'Loading sales and cost history…',
    percent: 28,
  });
  const dedicated = await fetchDedicatedOrNull(buildProductPulseOverviewUrl(productId, query));
  if (dedicatedOverviewLooksValid(dedicated)) {
    emitPulseProgress(onProgress, {
      stage: 'initializing',
      label: 'This section is initializing',
      detail: 'Preparing product metrics…',
      percent: 48,
    });
    const normalized = normalizeDedicatedOverview(dedicated, card);
    const health = normalized.health || classifyProductHealth(normalized.metrics);
    const insights =
      normalized.insights ||
      buildInsights({
        metrics: normalized.metrics,
        productName: card.product?.name,
      });
    return {
      ...normalized,
      health,
      insights,
      variations,
      range,
      previousRange: previousEquivalentRange(range.startDate, range.endDate),
      productIds,
    };
  }

  emitPulseProgress(onProgress, {
    stage: 'initializing',
    label: 'This section is initializing',
    detail: 'Calculating profit and performance…',
    percent: 42,
  });
  const composed = await composeOverview({
    product,
    variations,
    params: query,
    productIds,
    selectedVariant,
  });
  const highlights = identifyVariantHighlights(
    aggregateVariants(composed.lines, variations)
  );
  const insights = buildInsights({
    metrics: composed.metrics,
    highlights,
    productName: card.product?.name,
  });

  return {
    product: composed.product,
    selectedVariant: composed.selectedVariant,
    metrics: composed.metrics,
    health: composed.health,
    insights,
    variations,
    range,
    previousRange: previousEquivalentRange(range.startDate, range.endDate),
    productIds,
    truncated: composed.truncated,
    source: composed.source,
    missingHistoricalCostCount: composed.missingHistoricalCostCount,
  };
}

export function pickDedicatedTimelinePoints(result) {
  if (!result || typeof result !== 'object') return null;
  const keys = ['points', 'data', 'timeline', 'days'];
  for (const key of keys) {
    if (Array.isArray(result[key]) && result[key].length) return result[key];
  }
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    for (const key of keys) {
      if (Array.isArray(result.data[key]) && result.data[key].length) return result.data[key];
    }
  }
  return null;
}

function bucketRange(bucket, granularity, range) {
  let startDate = bucket.date;
  let endDate = bucket.date;
  if (granularity === 'monthly') {
    const [y, m] = String(bucket.date).split('-');
    startDate = `${y}-${m}-01`;
    endDate = formatYmd(new Date(Number(y), Number(m), 0));
    if (endDate > range.endDate) endDate = range.endDate;
    if (startDate < range.startDate) startDate = range.startDate;
  } else if (granularity === 'weekly') {
    startDate = bucket.date;
    endDate = addDaysYmd(startDate, 6);
    if (endDate > range.endDate) endDate = range.endDate;
    if (startDate < range.startDate) startDate = range.startDate;
  }
  return { startDate, endDate };
}

async function composeTimelinePoints({ productIds, warehouseId, range, granularity, salePack }) {
  const buckets = buildTimelineBuckets(range.startDate, range.endDate, granularity);
  const lines = Array.isArray(salePack?.lines) ? salePack.lines : [];
  const datedLines = lines.filter((line) => line?.soldOn);
  const fromLines = fillTimeline(buckets, datedLines);
  if (datedLines.length && timelineHasChartableData(fromLines)) {
    return { points: fromLines, source: 'composed', truncated: salePack?.truncated };
  }

  const points = await mapWithConcurrency(buckets, 6, async (bucket) => {
    const { startDate, endDate } = bucketRange(bucket, granularity, range);
    const totals = await sumProfitTotals(productIds, {
      startDate,
      endDate,
      warehouseId,
    });
    const netRevenue = roundMoney(totals.subtotal);
    const profit = roundMoney(totals.profit);
    const explicitCogs = totals.totalCOGS;
    const cogs =
      explicitCogs > 0 ? roundMoney(explicitCogs) : roundMoney(netRevenue - profit);
    return {
      ...bucket,
      orders: totals.lineCount,
      unitsSold: roundMoney(totals.total_qty),
      grossRevenue: netRevenue,
      netRevenue,
      COGS: cogs,
      profit,
      profitMargin: netRevenue !== 0 ? Math.round((profit / netRevenue) * 10000) / 100 : null,
      returnedUnits: 0,
      discount: 0,
    };
  });

  return { points, source: 'profit-totals', truncated: salePack?.truncated };
}

export async function fetchProductPulseTimeline(params = {}) {
  const productId = String(params.productId || '').trim();
  const granularity = ['daily', 'weekly', 'monthly'].includes(params.granularity)
    ? params.granularity
    : 'daily';
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    variantId: params.variantId,
    warehouseId: params.warehouseId,
    granularity,
  };

  const dedicated = await fetchDedicatedOrNull(buildProductPulseTimelineUrl(productId, query));
  const dedicatedPoints = normalizeTimelinePoints(pickDedicatedTimelinePoints(dedicated), granularity);
  if (timelineHasChartableData(dedicatedPoints)) {
    return { granularity, points: dedicatedPoints, source: 'dedicated', range };
  }

  const { product, variations } = await fetchProductPulseProduct(productId);
  const productIds = sellableProductIds(product, variations, query.variantId);
  const salePack = await fetchProductSaleLines({
    productIds,
    warehouseId: query.warehouseId,
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const composed = await composeTimelinePoints({
    productIds,
    warehouseId: query.warehouseId,
    range,
    granularity,
    salePack,
  });

  return { granularity, points: composed.points, source: composed.source, range, truncated: composed.truncated };
}

export async function fetchProductPulseVariants(params = {}) {
  const productId = String(params.productId || '').trim();
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    warehouseId: params.warehouseId,
  };

  const dedicated = await fetchDedicatedOrNull(buildProductPulseVariantsUrl(productId, query));
  const dedicatedRows = Array.isArray(dedicated?.variants)
    ? dedicated.variants
    : Array.isArray(dedicated?.data)
      ? dedicated.data
      : null;
  if (dedicatedRows) {
    const highlights = identifyVariantHighlights(dedicatedRows);
    return { ...highlights, source: 'dedicated', range };
  }

  const { product, variations } = await fetchProductPulseProduct(productId);
  if (!variations.length) {
    return {
      rows: [],
      bestSellingVariant: null,
      mostProfitableVariant: null,
      highestMarginVariant: null,
      highestReturnVariant: null,
      source: 'composed',
      range,
    };
  }

  const salePack = await fetchProductSaleLines({
    productIds: variations.map((v) => v.id),
    warehouseId: query.warehouseId,
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const rows = aggregateVariants(salePack.lines, variations);
  return { ...identifyVariantHighlights(rows), source: 'composed', range, truncated: salePack.truncated };
}

export async function fetchProductPulseWarehouses(params = {}) {
  const productId = String(params.productId || '').trim();
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    variantId: params.variantId,
    warehouseId: params.warehouseId,
  };

  const dedicated = await fetchDedicatedOrNull(buildProductPulseWarehousesUrl(productId, query));
  const dedicatedRows = Array.isArray(dedicated?.warehouses)
    ? dedicated.warehouses
    : Array.isArray(dedicated?.data)
      ? dedicated.data
      : null;
  if (dedicatedRows) {
    return { rows: dedicatedRows, source: 'dedicated', range };
  }

  const [{ product, variations }, warehouses] = await Promise.all([
    fetchProductPulseProduct(productId),
    fetchWarehousesForPulse(),
  ]);
  const productIds = sellableProductIds(product, variations, query.variantId);
  const salePack = await fetchProductSaleLines({
    productIds,
    warehouseId: query.warehouseId,
    startDate: range.startDate,
    endDate: range.endDate,
  });
  let rows = aggregateWarehouses(salePack.lines, warehouses);
  if (query.warehouseId) {
    rows = rows.filter((row) => String(row.warehouseId) === String(query.warehouseId));
  }
  return { rows, source: 'composed', range, truncated: salePack.truncated };
}

export async function fetchProductPulseSales(params = {}) {
  const productId = String(params.productId || '').trim();
  const range = resolveDateRange(params.preset, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 25);
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    variantId: params.variantId,
    warehouseId: params.warehouseId,
    page,
    limit,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const dedicated = await fetchDedicatedOrNull(buildProductPulseSalesUrl(productId, query));
  const dedicatedRows = Array.isArray(dedicated?.data)
    ? dedicated.data
    : Array.isArray(dedicated?.sales)
      ? dedicated.sales
      : null;
  if (dedicatedRows?.length) {
    const pagination = dedicated.pagination || parseListPagination(dedicated, query);
    return {
      rows: dedicatedRows,
      pagination: {
        page: pagination.page || page,
        limit: pagination.limit || limit,
        total: pagination.total ?? dedicatedRows.length,
        totalPages: pagination.totalPages ?? 0,
        cursor: pagination.cursor || null,
      },
      source: 'dedicated',
      range,
    };
  }

  const { product, variations } = await fetchProductPulseProduct(productId);
  const productIds = sellableProductIds(product, variations, query.variantId);

  if (productIds.length === 1) {
    const result = await fetchOrderItemPage({
      page,
      limit,
      productId: productIds[0],
      warehouseId: query.warehouseId,
      startDate: range.startDate,
      endDate: range.endDate,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    if (result) {
      const lines = linesFromOrderItemRows(result.data).filter((line) =>
        matchesProductScope(line, {
          productIds,
          warehouseId: query.warehouseId,
        }) && (!line.soldOn || isDateInRange(line.soldOn, range.startDate, range.endDate))
      );
      if (lines.length) {
        return {
          rows: lines.map(toSalesHistoryRow),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            cursor: result.cursor,
          },
          source: 'order_item',
          range,
        };
      }
    }
  }

  const salePack = await fetchProductSaleLines({
    productIds,
    warehouseId: query.warehouseId,
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const sorted = [...salePack.lines].sort((a, b) => String(b.soldAt || '').localeCompare(String(a.soldAt || '')));
  const start = (page - 1) * limit;
  const slice = sorted.slice(start, start + limit);
  return {
    rows: slice.map(toSalesHistoryRow),
    pagination: {
      page,
      limit,
      total: sorted.length,
      totalPages: sorted.length > 0 ? Math.ceil(sorted.length / limit) : 0,
      cursor: null,
    },
    source: 'composed',
    range,
    truncated: salePack.truncated,
  };
}

export function invoicePathForSale(row) {
  const id = row?.orderId || row?.orderNumber;
  return id || '';
}

/**
 * Load overview + timeline + variants + warehouses + one sales page.
 * Reuses one product-scoped sale-line fetch for composed sections.
 */
export async function fetchProductPulseBundle(params = {}) {
  const { onProgress, ...rest } = params;
  emitPulseProgress(onProgress, {
    stage: 'loading',
    label: 'This section is loading',
    detail: 'Starting Product Pulse…',
    percent: 6,
  });
  const overview = await fetchProductPulseOverview({ ...rest, onProgress });
  const granularity = ['daily', 'weekly', 'monthly'].includes(rest.granularity)
    ? rest.granularity
    : 'daily';
  const range = overview.range;
  const productIds = overview.productIds || [];
  const query = {
    startDate: range.startDate,
    endDate: range.endDate,
    variantId: rest.variantId,
    warehouseId: rest.warehouseId,
  };

  emitPulseProgress(onProgress, {
    stage: 'initializing',
    label: 'This section is initializing',
    detail: 'Loading timeline, variants, and sales…',
    percent: 58,
  });
  const [timelineDedicated, variantsDedicated, warehousesDedicated, sales, warehouses, salePack] =
    await Promise.all([
      fetchDedicatedOrNull(
        buildProductPulseTimelineUrl(rest.productId, { ...query, granularity })
      ),
      fetchDedicatedOrNull(buildProductPulseVariantsUrl(rest.productId, query)),
      fetchDedicatedOrNull(buildProductPulseWarehousesUrl(rest.productId, query)),
      fetchProductPulseSales({ ...rest, page: rest.page || 1, limit: rest.limit || 25 }),
      fetchWarehousesForPulse(),
      fetchProductSaleLines({
        productIds,
        warehouseId: query.warehouseId,
        startDate: range.startDate,
        endDate: range.endDate,
      }),
    ]);

  const dedicatedPoints = normalizeTimelinePoints(
    pickDedicatedTimelinePoints(timelineDedicated),
    granularity
  );
  let timeline = timelineHasChartableData(dedicatedPoints)
    ? { granularity, points: dedicatedPoints, source: 'dedicated', range }
    : null;
  if (!timeline) {
    const composed = await composeTimelinePoints({
      productIds,
      warehouseId: query.warehouseId,
      range,
      granularity,
      salePack,
    });
    timeline = {
      granularity,
      points: composed.points,
      source: composed.source,
      range,
      truncated: composed.truncated,
    };
  }

  emitPulseProgress(onProgress, {
    stage: 'initializing',
    label: 'This section is initializing',
    detail: 'Building charts and tables…',
    percent: 82,
  });
  const lineMetrics = aggregateMetrics(salePack.lines, {
    periodDays: inclusiveDayCount(range.startDate, range.endDate),
  });
  const overviewMetrics = overview.metrics || {};
  const mergedMetrics =
    (overviewMetrics.unitsSold || 0) === 0 && lineMetrics.unitsSold
      ? {
          ...overviewMetrics,
          unitsSold: lineMetrics.unitsSold,
          firstSoldAt: lineMetrics.firstSoldAt || overviewMetrics.firstSoldAt,
          lastSoldAt: lineMetrics.lastSoldAt || overviewMetrics.lastSoldAt,
          ordersCount: lineMetrics.ordersCount || overviewMetrics.ordersCount,
          daysSinceLastSale: lineMetrics.daysSinceLastSale ?? overviewMetrics.daysSinceLastSale,
        }
      : overviewMetrics;

  const dedicatedVariantRows = Array.isArray(variantsDedicated?.variants)
    ? variantsDedicated.variants
    : Array.isArray(variantsDedicated?.data)
      ? variantsDedicated.data
      : null;
  const variants = dedicatedVariantRows
    ? { ...identifyVariantHighlights(dedicatedVariantRows), source: 'dedicated', range }
    : {
        ...identifyVariantHighlights(aggregateVariants(salePack.lines, overview.variations || [])),
        source: 'composed',
        range,
        truncated: salePack.truncated,
      };

  const dedicatedWarehouseRows = Array.isArray(warehousesDedicated?.warehouses)
    ? warehousesDedicated.warehouses
    : Array.isArray(warehousesDedicated?.data)
      ? warehousesDedicated.data
      : null;
  let warehouseRows = dedicatedWarehouseRows;
  if (!warehouseRows) {
    warehouseRows = aggregateWarehouses(salePack.lines, warehouses);
    if (query.warehouseId) {
      warehouseRows = warehouseRows.filter(
        (row) => String(row.warehouseId) === String(query.warehouseId)
      );
    }
  }

  const insights = buildInsights({
    metrics: mergedMetrics,
    highlights: variants,
    productName: overview.product?.name,
  });

  emitPulseProgress(onProgress, {
    stage: 'initializing',
    label: 'This section is initializing',
    detail: 'Finalizing Product Pulse…',
    percent: 94,
  });
  return {
    overview: {
      ...overview,
      metrics: mergedMetrics,
      insights,
      health: overview.health || classifyProductHealth(mergedMetrics),
    },
    timeline,
    variants,
    warehouses: {
      rows: warehouseRows || [],
      source: dedicatedWarehouseRows ? 'dedicated' : 'composed',
      range,
      truncated: dedicatedWarehouseRows ? undefined : salePack.truncated,
    },
    sales,
  };
}

export { pickOrderDocumentId, pickOrderInvoiceNo };
