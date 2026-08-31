import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;
const LIST_PATH = 'warehouse_inventory/get-all-active';
export const WAREHOUSE_INVENTORY_LIST_POPULATE = 'product_id,warehouse_id';

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

const logWarehouseInventoryError = (operation, details) => {
  console.error(`[Warehouse inventory module] ${operation}`, details);
};

const getErrorMessageFromResponse = async (response) => {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json.message === 'string' && json.message) return json.message;
      if (typeof json.error === 'string' && json.error) return json.error;
    } catch {
      /* ignore */
    }
  }
  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
};

const normalizeListPayload = (result) => {
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.warehouse_inventory)) return result.warehouse_inventory;
  if (Array.isArray(result)) return result;

  const nested = result.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.warehouse_inventory)) return nested.warehouse_inventory;
    if (Array.isArray(nested.rows)) return nested.rows;
    if (Array.isArray(nested.items)) return nested.items;
  }

  return [];
};

const isPopulatedRef = (ref) => ref && typeof ref === 'object' && !Array.isArray(ref);

const getWarehouseRefLabel = (ref) => {
  if (!ref) return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    return ref.name || ref.warehouse_name || ref.code || ref.warehouse_code || '';
  }
  if (typeof ref === 'string' && ref.trim()) return ref;
  return '';
};

/** Populated `product_id` display name. */
export const getProductLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id ?? row.product;
  if (isPopulatedRef(p)) {
    return p.product_name || p.name || p.product_slug || p.sku || '—';
  }
  return '—';
};

/** Populated `product_id` barcode / SKU. */
export const getProductBarcode = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id ?? row.product;
  if (isPopulatedRef(p)) {
    return p.barcode || p.sku || p.product_code || '—';
  }
  return '—';
};

export const getProductUnit = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const p = row.product_id ?? row.product;
  if (isPopulatedRef(p) && p.unit) return String(p.unit);
  return '—';
};

/** Category id(s) from populated product `category_id` (single or array). */
export const getProductCategoryIds = (product) => {
  if (!isPopulatedRef(product)) return [];
  const raw = product.category_id ?? product.categoryId ?? product.category;
  if (raw == null || raw === '') return [];
  const refs = Array.isArray(raw) ? raw : [raw];
  return refs
    .map((ref) => {
      if (isPopulatedRef(ref)) return String(ref._id ?? ref.id ?? '').trim();
      return String(ref ?? '').trim();
    })
    .filter(Boolean);
};

export const DEFAULT_WAREHOUSE_INVENTORY_FILTERS = {
  categoryId: '',
  minPrice: '',
  maxPrice: '',
  unit: '',
  minStock: '',
  maxStock: '',
};

/** Populated product retail / selling price. */
export const getProductRetailPrice = (row) => {
  if (!row || typeof row !== 'object') return null;
  const p = row.product_id ?? row.product;
  if (!isPopulatedRef(p)) return null;
  const raw = p.price ?? p.product_price ?? p.retail_price ?? p.retailPrice;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Populated product wholesale / cost price. */
export const getProductWholesalePrice = (row) => {
  if (!row || typeof row !== 'object') return null;
  const p = row.product_id ?? row.product;
  if (!isPopulatedRef(p)) return null;
  const raw = p.wholesale_price ?? p.wholesalePrice;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const getWarehouseLabel = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const w = row.warehouse_id ?? row.warehouse;
  const label = getWarehouseRefLabel(w);
  return label || '—';
};

export const getInventoryQuantity = (row) => {
  if (!row || typeof row !== 'object') return null;
  if (row.quantity != null && row.quantity !== '') return Number(row.quantity);
  if (row.qty != null && row.qty !== '') return Number(row.qty);
  return null;
};

const productIdFromRow = (row) => {
  const p = row?.product_id ?? row?.product;
  if (isPopulatedRef(p)) return String(p._id ?? p.id ?? '').trim();
  if (p != null && typeof p !== 'object') return String(p).trim();
  return '';
};

const warehouseIdFromRow = (row) => {
  const w = row?.warehouse_id ?? row?.warehouse;
  if (isPopulatedRef(w)) return String(w._id ?? w.id ?? '').trim();
  if (w != null && typeof w !== 'object') return String(w).trim();
  return '';
};

/**
 * Group flat warehouse-inventory rows by product for product-centric listing.
 * @param {Array} rows
 */
export function groupInventoryByProduct(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const map = new Map();

  for (const row of rows) {
    const productId = productIdFromRow(row);
    if (!productId) continue;

    if (!map.has(productId)) {
      const p = row.product_id ?? row.product;
      map.set(productId, {
        productId,
        product: isPopulatedRef(p) ? p : null,
        productName: getProductLabel(row),
        barcode: getProductBarcode(row),
        unit: getProductUnit(row),
        categoryIds: isPopulatedRef(p) ? getProductCategoryIds(p) : [],
        retailPrice: getProductRetailPrice(row),
        wholesalePrice: getProductWholesalePrice(row),
        warehouseLines: [],
        totalQuantity: 0,
        latestUpdatedAt: null,
      });
    }

    const group = map.get(productId);
    const qty = Number(getInventoryQuantity(row)) || 0;
    group.totalQuantity += qty;

    group.warehouseLines.push({
      key: String(row._id ?? row.id ?? `${warehouseIdFromRow(row)}-${group.warehouseLines.length}`),
      inventoryId: row._id ?? row.id,
      warehouseId: warehouseIdFromRow(row),
      warehouseName: getWarehouseLabel(row),
      quantity: qty,
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
    });

    const updatedAt = row.updatedAt ?? row.updated_at;
    if (updatedAt && (!group.latestUpdatedAt || updatedAt > group.latestUpdatedAt)) {
      group.latestUpdatedAt = updatedAt;
    }
  }

  return Array.from(map.values());
}

/**
 * Client-side filter: barcode lives on populated product, not warehouse_inventory.
 * Server `?search=` only matches WI string/number fields (status / quantity).
 */
export function filterGroupedProducts(groups, searchTerm = '') {
  const q = String(searchTerm || '').trim().toLowerCase();
  if (!q || !Array.isArray(groups)) return groups;

  return groups.filter((group) => {
    const name = String(group.productName ?? '').toLowerCase();
    const barcode = String(group.barcode ?? '').toLowerCase();
    const unit = String(group.unit ?? '').toLowerCase();
    const product = group.product && typeof group.product === 'object' ? group.product : null;
    const sku = String(product?.sku ?? product?.product_code ?? '').toLowerCase();
    const id = String(group.productId ?? '').toLowerCase();
    return (
      name.includes(q) ||
      barcode.includes(q) ||
      sku.includes(q) ||
      unit.includes(q) ||
      id.includes(q)
    );
  });
}

const parseOptionalNumber = (raw) =>
  raw !== '' && raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;

/**
 * Client-side filters for grouped warehouse inventory (price, category, unit, stock).
 */
export function filterGroupedProductsByFilters(
  groups,
  filters = DEFAULT_WAREHOUSE_INVENTORY_FILTERS
) {
  if (!Array.isArray(groups)) return [];

  const categoryId = String(filters.categoryId ?? '').trim();
  const unitFilter = String(filters.unit ?? '').trim().toLowerCase();
  const minPrice = parseOptionalNumber(filters.minPrice);
  const maxPrice = parseOptionalNumber(filters.maxPrice);
  const minStock = parseOptionalNumber(filters.minStock);
  const maxStock = parseOptionalNumber(filters.maxStock);

  if (
    !categoryId &&
    !unitFilter &&
    minPrice == null &&
    maxPrice == null &&
    minStock == null &&
    maxStock == null
  ) {
    return groups;
  }

  return groups.filter((group) => {
    if (categoryId) {
      const ids = Array.isArray(group.categoryIds) ? group.categoryIds : [];
      if (!ids.includes(categoryId)) return false;
    }

    if (unitFilter) {
      const unit = String(group.unit ?? '').trim().toLowerCase();
      if (unit !== unitFilter) return false;
    }

    const price = group.retailPrice;
    if (minPrice != null) {
      if (price == null || !Number.isFinite(Number(price)) || Number(price) < minPrice) {
        return false;
      }
    }
    if (maxPrice != null) {
      if (price == null || !Number.isFinite(Number(price)) || Number(price) > maxPrice) {
        return false;
      }
    }

    const qty = Number(group.totalQuantity) || 0;
    if (minStock != null && qty < minStock) return false;
    if (maxStock != null && qty > maxStock) return false;

    return true;
  });
}

export function applyGroupedProductFilters(
  groups,
  { search = '', ...filters } = DEFAULT_WAREHOUSE_INVENTORY_FILTERS
) {
  const searched = filterGroupedProducts(groups, search);
  return filterGroupedProductsByFilters(searched, filters);
}

/** Distinct unit labels for filter dropdown (sorted). */
export function collectGroupedProductUnits(groups) {
  if (!Array.isArray(groups)) return [];
  const units = new Set();
  for (const group of groups) {
    const unit = String(group.unit ?? '').trim();
    if (unit && unit !== '—') units.add(unit);
  }
  return Array.from(units).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export const sortGroupedProducts = (groups, sortBy, sortOrder) => {
  if (!sortBy || !Array.isArray(groups)) return groups;

  const dir = sortOrder === 'desc' ? -1 : 1;
  const sorted = [...groups];

  sorted.sort((a, b) => {
    let av;
    let bv;

    switch (sortBy) {
      case 'product_name':
      case 'name':
        av = String(a.productName ?? '').toLowerCase();
        bv = String(b.productName ?? '').toLowerCase();
        break;
      case 'barcode':
        av = String(a.barcode ?? '').toLowerCase();
        bv = String(b.barcode ?? '').toLowerCase();
        break;
      case 'quantity':
      case 'totalQuantity':
        av = Number(a.totalQuantity) || 0;
        bv = Number(b.totalQuantity) || 0;
        break;
      case 'unit':
        av = String(a.unit ?? '').toLowerCase();
        bv = String(b.unit ?? '').toLowerCase();
        break;
      case 'price':
      case 'retail_price':
      case 'retailPrice':
        av = a.retailPrice == null ? Number.NEGATIVE_INFINITY : Number(a.retailPrice);
        bv = b.retailPrice == null ? Number.NEGATIVE_INFINITY : Number(b.retailPrice);
        break;
      case 'wholesale_price':
      case 'wholesalePrice':
        av = a.wholesalePrice == null ? Number.NEGATIVE_INFINITY : Number(a.wholesalePrice);
        bv = b.wholesalePrice == null ? Number.NEGATIVE_INFINITY : Number(b.wholesalePrice);
        break;
      case 'updatedAt':
        av = a.latestUpdatedAt ? new Date(a.latestUpdatedAt).getTime() : 0;
        bv = b.latestUpdatedAt ? new Date(b.latestUpdatedAt).getTime() : 0;
        break;
      default:
        av = String(a.productName ?? '').toLowerCase();
        bv = String(b.productName ?? '').toLowerCase();
    }

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  return sorted;
};

export const paginateGroupedProducts = (groups, page = 1, limit = 10) => {
  const total = Array.isArray(groups) ? groups.length : 0;
  const safeLimit = Math.max(1, Number(limit) || 10);
  const totalPages = total > 0 ? Math.ceil(total / safeLimit) : 0;
  const safePage = Math.min(Math.max(1, Number(page) || 1), Math.max(totalPages, 1));
  const start = (safePage - 1) * safeLimit;
  const data = Array.isArray(groups) ? groups.slice(start, start + safeLimit) : [];

  return {
    data,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
};

/**
 * GET /warehouse_inventory/get-all-active?populate=product_id,warehouse_id&search=&product_id=&sortBy=&sortOrder=
 */
export async function fetchWarehouseInventoryRequest(params = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set(
    'populate',
    params.populate != null && String(params.populate).trim() !== ''
      ? String(params.populate)
      : WAREHOUSE_INVENTORY_LIST_POPULATE
  );

  if (params.search) queryParams.append('search', String(params.search));
  if (params.product_id) queryParams.append('product_id', String(params.product_id));
  if (params.sortBy) queryParams.append('sortBy', String(params.sortBy));
  if (params.sortOrder) queryParams.append('sortOrder', String(params.sortOrder));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${LIST_PATH}?${queryString}`;

  let response;
  try {
    response = await fetch(url, { method: 'GET', headers: getHeaders() });
  } catch (err) {
    logWarehouseInventoryError('fetchWarehouseInventoryRequest network error', { url, params, error: err });
    throw err;
  }

  if (!response.ok) {
    const message = await getErrorMessageFromResponse(response);
    logWarehouseInventoryError('fetchWarehouseInventoryRequest failed', {
      status: response.status,
      params,
      message,
    });
    throw new Error(message);
  }

  const result = await response.json();
  const rawData = normalizeListPayload(result);

  return {
    rawData: Array.isArray(rawData) ? rawData : [],
  };
}
