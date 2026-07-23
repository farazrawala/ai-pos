import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  fetchCompanyById,
  getCompanyFromApiBody,
  pickCompanyLogoUrl,
} from '../company/companyAPI.js';
import {
  fetchProductByIdRequest,
  fetchProductVariationRequest,
  POS_PRODUCT_SEARCH_FIELDS,
} from '../products/productsAPI.js';
import { fetchCategoriesRequest } from '../categories/categoriesAPI.js';
import { fetchBrandsRequest } from '../brands/brandsAPI.js';
import {
  normalizeCompanyProfile,
  resolveSortParams,
  filterProductsClientSide,
  sortProductsClientSide,
  getProductVariations,
  attachSiblingChildren,
  collectMarketplaceVariations,
} from './marketplaceUtils.js';

const BASE_URL = `${API_BASE_URL}/`;

/** Same search fields as POS / ecommerce products docs. */
export const ECOMMERCE_PRODUCT_SEARCH_FIELDS = POS_PRODUCT_SEARCH_FIELDS;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const STOCK_STATUS_VALUES = new Set(['in_stock', 'out_of_stock', 'low_stock']);

/** UI stock filter → API `stock_status` (`in_stock` | `out_of_stock` | `low_stock`). */
function resolveStockStatus(params = {}) {
  const raw = params.stock_status ?? params.stockStatus ?? params.stock;
  if (raw == null || raw === '') return undefined;
  const key = String(raw).trim().toLowerCase();
  return STOCK_STATUS_VALUES.has(key) ? key : undefined;
}

/**
 * Marketplace products for a store company.
 * `GET /big-commerce/get-all-active-ecommerce-products/{companyId}
 *   ?search=&searchFields=...&status=active&category_id=&stock_status=`
 */
export async function fetchMarketplaceProductsRequest(params = {}) {
  const sort = resolveSortParams(params.sortBy || 'latest');
  const categoryIds = Array.isArray(params.categoryIds) ? params.categoryIds.filter(Boolean) : [];
  const brandIds = Array.isArray(params.brandIds) ? params.brandIds.filter(Boolean) : [];

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);
  const skip =
    params.skip != null && params.skip !== ''
      ? Math.max(0, Number(params.skip) || 0)
      : (page - 1) * limit;
  const companyId = params.companyId ? String(params.companyId).trim() : '';

  if (!companyId) {
    return { data: [], total: 0, page: 1, limit, skip, totalPages: 0 };
  }

  const queryParams = new URLSearchParams();
  queryParams.set('skip', String(skip));
  queryParams.set('limit', String(limit));
  queryParams.set('status', String(params.status || 'active').trim() || 'active');
  queryParams.set(
    'searchFields',
    String(params.searchFields || ECOMMERCE_PRODUCT_SEARCH_FIELDS).trim() ||
      ECOMMERCE_PRODUCT_SEARCH_FIELDS
  );

  const search = params.search != null ? String(params.search).trim() : '';
  if (search) queryParams.set('search', search);

  if (categoryIds.length === 1) {
    queryParams.set('category_id', String(categoryIds[0]));
  } else if (params.category_id || params.categoryId) {
    queryParams.set('category_id', String(params.category_id ?? params.categoryId));
  }

  if (brandIds.length === 1) {
    queryParams.set('brand_id', String(brandIds[0]));
  } else if (params.brand_id || params.brandId) {
    queryParams.set('brand_id', String(params.brand_id ?? params.brandId));
  }

  const stockStatus = resolveStockStatus(params);
  if (stockStatus) {
    queryParams.set('stock_status', stockStatus);
  }

  if (sort.sortBy) queryParams.set('sortBy', sort.sortBy);
  if (sort.sortOrder) queryParams.set('sortOrder', sort.sortOrder);

  const storeUrl = `${BASE_URL}big-commerce/get-all-active-ecommerce-products/${encodeURIComponent(companyId)}?${queryParams}`;

  const response = await fetch(storeUrl, { method: 'GET', headers: getHeaders() });
  const raw = await response.json().catch(() => null);

  if (!response.ok || !raw || typeof raw !== 'object' || !Array.isArray(raw.data)) {
    const message = String(raw?.message || raw?.error || '');
    throw new Error(message || `Failed to load store products (${response.status})`);
  }

  const total = Number(
    raw.total ?? raw.count ?? raw.pagination?.total ?? raw.meta?.total ?? raw.data.length
  );
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : raw.data.length;

  let listResult = {
    data: raw.data,
    total: safeTotal,
    page: Math.floor(skip / limit) + 1,
    limit,
    skip,
    totalPages: limit > 0 ? Math.ceil(safeTotal / limit) : 0,
  };

  let data = Array.isArray(listResult.data) ? listResult.data : [];
  const serverTotal = Number(listResult.total);
  let totalCount =
    Number.isFinite(serverTotal) && serverTotal >= 0 ? serverTotal : data.length;
  let totalPages =
    listResult.totalPages ?? (limit > 0 ? Math.ceil(totalCount / limit) : 0);

  // Nest flat variation SKUs onto Variable parents. Keep children for scroll skip.
  data = attachSiblingChildren(data);

  // Refine with client-side filters (multi-category/brand, price). Stock status is server-side.
  const needsClientRefine =
    categoryIds.length > 1 ||
    brandIds.length > 1 ||
    params.minPrice !== '' ||
    params.maxPrice !== '';

  if (needsClientRefine) {
    const refined = filterProductsClientSide(data, {
      search: '',
      categoryIds: categoryIds.length > 1 ? categoryIds : [],
      brandIds: brandIds.length > 1 ? brandIds : [],
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      stock: '',
    });
    data = sortProductsClientSide(refined, params.sortBy || 'latest');
  }

  return {
    data,
    total: totalCount,
    page: Math.floor(skip / limit) + 1,
    limit,
    skip,
    totalPages: totalPages || (limit > 0 ? Math.ceil(totalCount / limit) : 0),
  };
}

function unwrapProductRecord(body) {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body.product && typeof body.product === 'object') return body.product;
  return body;
}

export async function fetchMarketplaceProductByIdRequest(productId) {
  const result = await fetchProductByIdRequest(productId);
  const record = unwrapProductRecord(result);
  if (record && typeof record === 'object' && !Array.isArray(record)) return record;
  return result;
}

/**
 * Load parent product + child variations for the detail modal.
 * Same source as product edit (`get-product-variation` → `childproducts`), with
 * marketplace list siblings as fallback when the tenant variation API is unavailable.
 */
export async function fetchMarketplaceProductDetailRequest(
  productId,
  { seed, catalog = [] } = {}
) {
  const id = String(productId || '').trim();
  const seedProduct =
    seed && typeof seed === 'object' && !Array.isArray(seed) ? seed : null;
  const catalogList = Array.isArray(catalog) ? catalog : [];

  let product = null;
  let variations = [];

  // Prefer variation endpoint — same as /products/edit/:id — so Variable parents include children.
  if (id) {
    try {
      const variationBody = await fetchProductVariationRequest(id);
      const record = unwrapProductRecord(variationBody);
      if (Array.isArray(record)) {
        variations = record.filter(Boolean);
      } else if (record && typeof record === 'object') {
        product = record;
        variations = getProductVariations(record);
      }
    } catch {
      // Partner-store / unauthorized — fall through to get + list siblings.
    }
  }

  if (!product) {
    try {
      product = id ? await fetchMarketplaceProductByIdRequest(id) : null;
    } catch (err) {
      if (!seedProduct) throw err;
      product = seedProduct;
    }
  }

  if (!product && seedProduct) product = seedProduct;
  if (!product) {
    throw new Error('Product not found');
  }

  variations = collectMarketplaceVariations(
    {
      ...(seedProduct || {}),
      ...product,
      childproducts: variations.length ? variations : getProductVariations(product),
    },
    catalogList
  );

  if (variations.length === 0 && seedProduct) {
    variations = collectMarketplaceVariations(seedProduct, catalogList);
  }

  return {
    product: {
      ...(seedProduct || {}),
      ...product,
      childproducts: variations,
    },
    variations,
  };
}

function profileFromCompanyRecord(company, stats = {}) {
  const profile = normalizeCompanyProfile(company, stats);
  if (!profile.logoUrl && company) {
    profile.logoUrl = pickCompanyLogoUrl(company);
  }
  return profile;
}

/**
 * Resolve a marketplace storefront company.
 * `GET company/get/:id` is tenant-scoped (own company / branches only), so other
 * stores must use the Big Commerce profile endpoint or the listing directory.
 */
export async function fetchMarketplaceCompanyProfileRequest(companyId, stats = {}) {
  const id = String(companyId || '').trim();
  if (!id) {
    return normalizeCompanyProfile(null, stats);
  }

  // 1) Dedicated marketplace profile (not tenant-filtered).
  try {
    const response = await fetch(
      `${BASE_URL}big-commerce/company/${encodeURIComponent(id)}`,
      { method: 'GET', headers: getHeaders() }
    );
    const raw = await response.json().catch(() => null);
    if (response.ok && raw) {
      const company = getCompanyFromApiBody(raw) || raw?.data || raw;
      if (
        company &&
        typeof company === 'object' &&
        (company._id || company.id || company.company_name || company.name)
      ) {
        return profileFromCompanyRecord(company, stats);
      }
    }
  } catch {
    // fall through
  }

  // 2) Listing directory (other companies with display_store_on_bigcommerce).
  try {
    const listed = await findListedCompanyById(id);
    if (listed) {
      return profileFromCompanyRecord(listed, stats);
    }
  } catch {
    // fall through
  }

  // 3) Tenant-scoped get — works for own company / branches.
  try {
    const body = await fetchCompanyById(id);
    const company = getCompanyFromApiBody(body) || body?.data || body;
    if (
      company &&
      typeof company === 'object' &&
      (company._id || company.id || company.company_name || company.name)
    ) {
      return profileFromCompanyRecord(company, stats);
    }
  } catch {
    // fall through
  }

  return normalizeCompanyProfile(null, stats);
}

/** Find one company in the Big Commerce listing (optionally via include_id). */
async function findListedCompanyById(companyId) {
  const target = String(companyId || '').trim();
  if (!target) return null;

  const match = (rows) =>
    (Array.isArray(rows) ? rows : []).find(
      (c) => String(c?._id ?? c?.id ?? '').trim() === target
    ) || null;

  try {
    const withInclude = await fetchMarketplaceCompaniesRequest({
      page: 1,
      limit: 5,
      includeId: target,
    });
    const hit = match(withInclude.data);
    if (hit) return hit;
  } catch {
    // Older backends may ignore include_id — paginate below.
  }

  let page = 1;
  let totalPages = 1;
  const limit = 50;
  do {
    const result = await fetchMarketplaceCompaniesRequest({ page, limit });
    const hit = match(result.data);
    if (hit) return hit;
    totalPages = Math.max(1, Number(result.totalPages) || 1);
    page += 1;
  } while (page <= totalPages && page <= 20);

  return null;
}

export async function fetchMarketplaceCategoriesRequest(companyId) {
  const id = String(companyId || '').trim();
  if (id) {
    try {
      const response = await fetch(
        `${BASE_URL}big-commerce/categories/${encodeURIComponent(id)}`,
        { method: 'GET', headers: getHeaders() }
      );
      const raw = await response.json().catch(() => null);
      if (response.ok && raw && Array.isArray(raw.data)) {
        return raw.data;
      }
    } catch {
      // fall through to tenant categories (own store / older API)
    }
  }

  const result = await fetchCategoriesRequest({
    page: 1,
    limit: 500,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function fetchMarketplaceBrandsRequest(companyId) {
  const id = String(companyId || '').trim();
  if (id) {
    try {
      const response = await fetch(
        `${BASE_URL}big-commerce/brands/${encodeURIComponent(id)}`,
        { method: 'GET', headers: getHeaders() }
      );
      const raw = await response.json().catch(() => null);
      if (response.ok && raw && Array.isArray(raw.data)) {
        return raw.data;
      }
    } catch {
      // fall through to tenant brands (own store / older API)
    }
  }

  const result = await fetchBrandsRequest({
    page: 1,
    limit: 500,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  return Array.isArray(result?.data) ? result.data : [];
}

/** Related products: same category, excluding current id. */
export async function fetchRelatedProductsRequest({ categoryId, excludeId, limit = 6 } = {}) {
  if (!categoryId) return [];
  const result = await fetchMarketplaceProductsRequest({
    page: 1,
    limit: Math.max(limit + 2, 8),
    categoryIds: [categoryId],
    sortBy: 'latest',
  });
  return (result.data || [])
    .filter((p) => String(p._id ?? p.id) !== String(excludeId))
    .slice(0, limit);
}

function normalizeCompaniesListResponse(result, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);

  if (result?.pagination && typeof result.pagination === 'object') {
    const pagination = result.pagination;
    const data = result.data || result.companies || [];
    const total = Number(pagination.total) || 0;
    const apiLimit = Number(pagination.limit);
    // API may return `limit: null` — fall back to the requested page size.
    const effectiveLimit =
      Number.isFinite(apiLimit) && apiLimit > 0 ? apiLimit : limit;
    const skip = Number(pagination.skip);
    const pageFromSkip =
      Number.isFinite(skip) && skip >= 0
        ? Math.floor(skip / effectiveLimit) + 1
        : page;
    return {
      data: Array.isArray(data) ? data : [],
      total,
      page: pageFromSkip,
      limit: effectiveLimit,
      totalPages: effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : total > 0 ? 1 : 0,
    };
  }

  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.companies)
      ? result.companies
      : Array.isArray(result)
        ? result
        : [];
  const total = Number(result?.total) || data.length;
  return {
    data,
    total,
    page: result?.page || page,
    limit: Number(result?.limit) > 0 ? Number(result.limit) : limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

/**
 * List companies for Big Commerce directory.
 * GET `company/get-all-for-listing?limit=20&skip=0`
 */
export async function fetchMarketplaceCompaniesRequest(params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);
  const skip = (page - 1) * limit;

  const queryParams = new URLSearchParams();
  queryParams.set('limit', String(limit));
  queryParams.set('skip', String(skip));
  if (params.search) queryParams.set('search', String(params.search).trim());
  if (params.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);
  if (params.includeId) queryParams.set('include_id', String(params.includeId).trim());

  const url = `${BASE_URL}company/get-all-for-listing?${queryParams.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.error || `Failed to load companies (${response.status})`
    );
  }

  const result = await response.json();
  return normalizeCompaniesListResponse(result, { page, limit });
}

/**
 * Send a store / connection request to another company.
 * POST `company/store-request` (also tries `bigcommerce/store-request`).
 */
export async function sendCompanyStoreRequestRequest({ companyId, message = '' } = {}) {
  const targetId = String(companyId || '').trim();
  if (!targetId) throw new Error('Company is required');

  const body = JSON.stringify({
    company_id: targetId,
    target_company_id: targetId,
    message: String(message || '').trim(),
  });

  const candidates = ['company/store-request', 'bigcommerce/store-request'];
  let lastError = null;

  for (const path of candidates) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: getHeaders(),
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        lastError = new Error(
          data?.message || data?.error || `Request failed (${response.status})`
        );
        continue;
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to send store request');
}

/**
 * Copy a partner marketplace product into the current company catalog ("Me too").
 * POST `big-commerce/products/:productId/duplicate`
 * (also tries `big-commerce/products/fetch/:productId`)
 *
 * Idempotent: if already fetched, API returns `already_fetched: true` with the existing row.
 */
export async function duplicateMarketplaceProductRequest(productId) {
  const id = String(productId || '').trim();
  if (!id) throw new Error('Product is required');

  const encoded = encodeURIComponent(id);
  const candidates = [
    `big-commerce/products/${encoded}/duplicate`,
    `big-commerce/products/fetch/${encoded}`,
  ];
  let lastError = null;

  for (const path of candidates) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        lastError = new Error(
          data?.message || data?.error || `Failed to copy product (${response.status})`
        );
        continue;
      }

      const record =
        data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
          ? data.data
          : data?.product && typeof data.product === 'object'
            ? data.product
            : data;

      return {
        ...data,
        already_fetched: Boolean(
          data?.already_fetched ?? data?.alreadyFetched ?? record?.already_fetched
        ),
        product: record,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to copy product');
}

function unwrapRecordId(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    return String(raw._id ?? raw.id ?? raw.$oid ?? raw.product_id ?? '').trim();
  }
  return String(raw).trim();
}

function collectFetchedProductRecords(payload) {
  const records = [];

  const walk = (node, depth = 0) => {
    if (node == null || depth > 4) return;
    if (Array.isArray(node)) {
      node.forEach((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          records.push(item);
        }
        if (item && typeof item === 'object') walk(item, depth + 1);
      });
      return;
    }
    if (typeof node !== 'object') return;

    const listKeys = [
      'product_ids',
      'productIds',
      'fetched_product_ids',
      'fetchedProductIds',
      'ids',
      'data',
      'products',
      'items',
      'rows',
      'result',
    ];
    let walkedList = false;
    listKeys.forEach((key) => {
      if (node[key] == null) return;
      walkedList = true;
      walk(node[key], depth + 1);
    });

    if (
      !walkedList &&
      (node._id ||
        node.id ||
        node.product_id ||
        node.productId ||
        node.fetch_from_product_id ||
        node.fetchFromProductId)
    ) {
      records.push(node);
    }
  };

  walk(payload);
  return records;
}

/**
 * Build Me too links from GET fetched-product-ids.
 * - sourceProductId: partner listing id (`fetch_from_product_id`)
 * - localProductId: your copy id (`product_id`) — preferred for soft-delete
 */
export function normalizeFetchedProductLinks(payload) {
  const bySourceId = {};
  const byLocalId = {};
  const pairs = [];
  const sourceIds = [];

  // Plain id arrays (legacy): treat each id as a source id only.
  if (Array.isArray(payload) && payload.every((x) => typeof x === 'string' || typeof x === 'number')) {
    payload.forEach((raw) => {
      const id = unwrapRecordId(raw);
      if (!id) return;
      sourceIds.push(id);
    });
    return { sourceIds: [...new Set(sourceIds)], bySourceId, byLocalId, pairs };
  }

  collectFetchedProductRecords(payload).forEach((item) => {
    // Lightweight ids API: product_id = your copy, fetch_from_product_id = partner.
    // Prefer product_id for copy when present (ids endpoint has no _id).
    const hasProductIdField =
      item.product_id != null ||
      item.productId != null ||
      item.fetch_from_product_id != null ||
      item.fetchFromProductId != null;
    const localId = unwrapRecordId(
      hasProductIdField
        ? (item.product_id ?? item.productId ?? item._id ?? item.id)
        : (item._id ?? item.id ?? item.product_id ?? item.productId)
    );
    const sourceId = unwrapRecordId(
      item.fetch_from_product_id ??
        item.fetchFromProductId ??
        item.source_product_id ??
        item.sourceProductId ??
        item.original_product_id ??
        item.originalProductId
    );

    // Your copy: has fetch_from_* → map partner id → local copy id.
    if (sourceId && localId && sourceId !== localId) {
      bySourceId[sourceId] = localId;
      byLocalId[localId] = sourceId;
      pairs.push({ sourceId, localId });
      sourceIds.push(sourceId);
      return;
    }

    // Fallback: only one id present (cannot soft-delete without a copy mapping).
    const only = sourceId || localId;
    if (only) sourceIds.push(only);
  });

  return {
    sourceIds: [...new Set(sourceIds)],
    bySourceId,
    byLocalId,
    pairs,
  };
}

/**
 * Partner product ids + local copy ids the current company already Me-too'd.
 * GET `big-commerce/fetched-product-ids/:sourceCompanyId`
 * (Company 2 token → your copies fetched from company 1.)
 *
 * Response shape:
 * `{ data: [{ product_id, fetch_from_product_id }], total, fetch_from_company_id }`
 */
export async function fetchAlreadyMeTooProductIdsRequest({
  sourceCompanyId,
  ownCompanyId,
} = {}) {
  const sourceId = String(sourceCompanyId || '').trim();
  const ownId = String(ownCompanyId || '').trim();
  if (!sourceId) return { sourceIds: [], bySourceId: {}, byLocalId: {}, pairs: [] };
  if (ownId && sourceId === ownId) {
    return { sourceIds: [], bySourceId: {}, byLocalId: {}, pairs: [] };
  }

  const response = await fetch(
    `${BASE_URL}big-commerce/fetched-product-ids/${encodeURIComponent(sourceId)}`,
    { method: 'GET', headers: getHeaders() }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Failed to load fetched product ids (${response.status})`
    );
  }

  return normalizeFetchedProductLinks(data);
}

/**
 * Soft-delete your Me too copy (deletedAt + status inactive).
 * DELETE `big-commerce/fetched-products/:productId/delete`
 * Tries each candidate id (copy id first, then partner id) until one succeeds.
 */
export async function deleteFetchedMarketplaceProductRequest(productId) {
  const id = String(productId || '').trim();
  if (!id) throw new Error('Product is required');

  const response = await fetch(
    `${BASE_URL}big-commerce/fetched-products/${encodeURIComponent(id)}/delete`,
    { method: 'DELETE', headers: getHeaders() }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.message || data?.error || `Failed to remove product (${response.status})`
    );
  }

  return data;
}

/** Try soft-delete with multiple ids (copy + partner) until one works. */
export async function deleteFetchedMarketplaceProductWithFallback(candidateIds) {
  const unique = [
    ...new Set(
      (Array.isArray(candidateIds) ? candidateIds : [candidateIds])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];
  if (unique.length === 0) throw new Error('Product is required');

  let lastError = null;
  for (const id of unique) {
    try {
      const result = await deleteFetchedMarketplaceProductRequest(id);
      return { result, deletedId: id };
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || '').toLowerCase();
      // Try next candidate when this id is not the fetched copy.
      if (
        msg.includes('not found') ||
        msg.includes('404') ||
        msg.includes('does not exist') ||
        msg.includes('no longer')
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to remove product');
}
