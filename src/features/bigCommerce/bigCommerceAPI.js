import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  fetchCompanyById,
  getCompanyFromApiBody,
  pickCompanyLogoUrl,
} from '../company/companyAPI.js';
import { fetchProductsRequest, fetchProductByIdRequest } from '../products/productsAPI.js';
import { fetchCategoriesRequest } from '../categories/categoriesAPI.js';
import { fetchBrandsRequest } from '../brands/brandsAPI.js';
import {
  normalizeCompanyProfile,
  resolveSortParams,
  filterProductsClientSide,
  sortProductsClientSide,
  excludeChildProducts,
  getProductVariations,
} from './marketplaceUtils.js';
import { fetchProductVariationRequest } from '../products/productsAPI.js';

const BASE_URL = `${API_BASE_URL}/`;

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

/**
 * Marketplace products list.
 * Sends supported server params today; future backend can honor brand_ids, min_price, etc.
 * Client-side filters refine results for multi-select / price / stock / rating.
 */
export async function fetchMarketplaceProductsRequest(params = {}) {
  const sort = resolveSortParams(params.sortBy || 'latest');
  const categoryIds = Array.isArray(params.categoryIds) ? params.categoryIds.filter(Boolean) : [];
  const brandIds = Array.isArray(params.brandIds) ? params.brandIds.filter(Boolean) : [];

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);

  // Prefer dedicated marketplace endpoint when backend adds it; fall back to POS list.
  let listResult = null;
  const queryParams = new URLSearchParams();
  queryParams.set('skip', String((page - 1) * limit));
  queryParams.set('limit', String(limit));

  if (params.search) {
    queryParams.set('search', String(params.search).trim());
    queryParams.set('searchFields', 'product_name,product_code,sku,barcode');
  }

  queryParams.set('sortBy', sort.sortBy);
  queryParams.set('sortOrder', sort.sortOrder);

  if (categoryIds.length === 1) {
    queryParams.set('category_id', String(categoryIds[0]));
  } else if (categoryIds.length > 1) {
    queryParams.set('category_ids', categoryIds.join(','));
  }

  if (brandIds.length === 1) {
    queryParams.set('brand_id', String(brandIds[0]));
  } else if (brandIds.length > 1) {
    queryParams.set('brand_ids', brandIds.join(','));
  }

  if (params.minPrice !== '' && params.minPrice != null) {
    queryParams.set('min_price', String(params.minPrice));
  }
  if (params.maxPrice !== '' && params.maxPrice != null) {
    queryParams.set('max_price', String(params.maxPrice));
  }
  if (params.stock) queryParams.set('stock', String(params.stock));
  if (params.minRating) queryParams.set('min_rating', String(params.minRating));
  if (params.companyId) queryParams.set('company_id', String(params.companyId));

  const marketplaceUrl = `${BASE_URL}product/marketplace?${queryParams}`;

  try {
    const response = await fetch(marketplaceUrl, { method: 'GET', headers: getHeaders() });
    if (response.ok) {
      const raw = await response.json();
      if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
        listResult = {
          data: raw.data,
          total: raw.total ?? raw.pagination?.total ?? raw.data.length,
          page,
          limit,
          totalPages:
            raw.totalPages ??
            raw.total_pages ??
            (limit > 0
              ? Math.ceil((raw.total ?? raw.pagination?.total ?? raw.data.length) / limit)
              : 0),
        };
      }
    }
  } catch {
    // fall through to POS list
  }

  if (!listResult) {
    listResult = await fetchProductsRequest({
      page,
      limit,
      search: params.search || undefined,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      category_id: categoryIds.length === 1 ? categoryIds[0] : undefined,
    });
  }

  let data = Array.isArray(listResult.data) ? listResult.data : [];
  data = excludeChildProducts(data);
  let total = listResult.total ?? data.length;
  let totalPages =
    listResult.totalPages ?? (limit > 0 ? Math.ceil(total / limit) : 0);

  // Refine with client-side filters (multi-category/brand, price, stock, rating).
  const needsClientRefine =
    categoryIds.length > 1 ||
    brandIds.length > 0 ||
    params.minPrice !== '' ||
    params.maxPrice !== '' ||
    Boolean(params.stock) ||
    Number(params.minRating) > 0;

  if (needsClientRefine) {
    const refined = filterProductsClientSide(data, {
      search: '',
      categoryIds: categoryIds.length > 1 ? categoryIds : [],
      brandIds,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      stock: params.stock,
      minRating: params.minRating,
    });
    data = excludeChildProducts(sortProductsClientSide(refined, params.sortBy || 'latest'));
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages: totalPages || (limit > 0 ? Math.ceil(total / limit) : 0),
  };
}

export async function fetchMarketplaceProductByIdRequest(productId) {
  const result = await fetchProductByIdRequest(productId);
  if (result && typeof result === 'object') {
    if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      return result.data;
    }
    if (result.product && typeof result.product === 'object') {
      return result.product;
    }
  }
  return result;
}

/** Load parent product + variations (childproducts) for the detail modal. */
export async function fetchMarketplaceProductDetailRequest(productId) {
  const product = await fetchMarketplaceProductByIdRequest(productId);
  let variations = getProductVariations(product);

  if (variations.length === 0 && productId) {
    try {
      const variationBody = await fetchProductVariationRequest(productId);
      const record =
        variationBody?.data && typeof variationBody.data === 'object'
          ? variationBody.data
          : variationBody?.product && typeof variationBody.product === 'object'
            ? variationBody.product
            : variationBody;
      if (record && typeof record === 'object') {
        variations = getProductVariations(record);
        if (variations.length === 0 && Array.isArray(record)) {
          variations = record;
        }
        // Merge any richer parent fields from variation endpoint.
        if (record.childproducts || record.child_products || record.variations) {
          return {
            product: { ...product, ...record, childproducts: variations },
            variations,
          };
        }
      }
    } catch {
      // Parent detail without a variation endpoint is fine.
    }
  }

  return {
    product: {
      ...product,
      childproducts: variations.length ? variations : getProductVariations(product),
    },
    variations: variations.length ? variations : getProductVariations(product),
  };
}

export async function fetchMarketplaceCompanyProfileRequest(companyId, stats = {}) {
  if (!companyId) {
    return normalizeCompanyProfile(null, stats);
  }
  const body = await fetchCompanyById(companyId);
  const company = getCompanyFromApiBody(body) || body?.data || body;
  const profile = normalizeCompanyProfile(company, stats);
  if (!profile.logoUrl && company) {
    profile.logoUrl = pickCompanyLogoUrl(company);
  }
  return profile;
}

export async function fetchMarketplaceCategoriesRequest() {
  const result = await fetchCategoriesRequest({ page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' });
  return Array.isArray(result?.data) ? result.data : [];
}

export async function fetchMarketplaceBrandsRequest() {
  const result = await fetchBrandsRequest({ page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' });
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
    const total = pagination.total || 0;
    const pageFromSkip =
      pagination.limit > 0 && pagination.skip != null
        ? Math.floor(pagination.skip / pagination.limit) + 1
        : page;
    return {
      data: Array.isArray(data) ? data : [],
      total,
      page: pageFromSkip,
      limit: pagination.limit || limit,
      totalPages: pagination.limit > 0 ? Math.ceil(total / pagination.limit) : 0,
    };
  }

  const data = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result?.companies)
      ? result.companies
      : Array.isArray(result)
        ? result
        : [];
  const total = result?.total ?? data.length;
  return {
    data,
    total,
    page: result?.page || page,
    limit: result?.limit || limit,
    totalPages: Math.ceil(total / (result?.limit || limit)) || 0,
  };
}

/**
 * List companies for Big Commerce directory.
 * Prefers marketplace endpoint; falls back to dynamic company CRUD lists.
 */
export async function fetchMarketplaceCompaniesRequest(params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);
  const queryParams = new URLSearchParams();
  queryParams.set('skip', String((page - 1) * limit));
  queryParams.set('limit', String(limit));
  if (params.search) queryParams.set('search', String(params.search).trim());
  if (params.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  const candidates = [
    `company/marketplace${queryParams.toString() ? `?${queryParams}` : ''}`,
    `bigcommerce/companies${queryParams.toString() ? `?${queryParams}` : ''}`,
    `company/get-all-active${queryParams.toString() ? `?${queryParams}` : ''}`,
    `company/get-all${queryParams.toString() ? `?${queryParams}` : ''}`,
  ];

  let lastError = null;
  for (const path of candidates) {
    const url = `${BASE_URL}${path}`;
    try {
      const response = await fetch(url, { method: 'GET', headers: getHeaders() });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const result = await response.json();
      return normalizeCompaniesListResponse(result, { page, limit });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to load companies');
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
