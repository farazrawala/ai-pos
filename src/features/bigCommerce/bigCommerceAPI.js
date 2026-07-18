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
 * Marketplace products list for a store company.
 * Uses `GET /big-commerce/products/:companyId` (public listing or approved connection).
 * Falls back to POS product list only when browsing the signed-in company's own store.
 */
export async function fetchMarketplaceProductsRequest(params = {}) {
  const sort = resolveSortParams(params.sortBy || 'latest');
  const categoryIds = Array.isArray(params.categoryIds) ? params.categoryIds.filter(Boolean) : [];
  const brandIds = Array.isArray(params.brandIds) ? params.brandIds.filter(Boolean) : [];

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);
  const companyId = params.companyId ? String(params.companyId).trim() : '';

  let listResult = null;
  let useOwnCatalogFallback = !companyId;

  if (companyId) {
    const queryParams = new URLSearchParams();
    queryParams.set('skip', String((page - 1) * limit));
    queryParams.set('limit', String(limit));

    if (params.search) {
      queryParams.set('search', String(params.search).trim());
    }

    if (categoryIds.length === 1) {
      queryParams.set('category_id', String(categoryIds[0]));
    }
    if (brandIds.length === 1) {
      queryParams.set('brand_id', String(brandIds[0]));
    }

    const storeUrl = `${BASE_URL}big-commerce/products/${encodeURIComponent(companyId)}?${queryParams}`;

    try {
      const response = await fetch(storeUrl, { method: 'GET', headers: getHeaders() });
      const raw = await response.json().catch(() => null);

      if (response.ok && raw && typeof raw === 'object' && Array.isArray(raw.data)) {
        const total = Number(raw.total ?? raw.pagination?.total ?? raw.data.length) || 0;
        listResult = {
          data: raw.data,
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
        };
      } else {
        const message = String(raw?.message || raw?.error || '');
        // Own company store → use tenant POS catalog.
        if (
          response.status === 400 &&
          /own catalog|your own/i.test(message)
        ) {
          useOwnCatalogFallback = true;
        } else if (!response.ok) {
          throw new Error(message || `Failed to load store products (${response.status})`);
        }
      }
    } catch (err) {
      if (!useOwnCatalogFallback) {
        throw err instanceof Error ? err : new Error('Failed to load store products');
      }
    }
  }

  if (!listResult && useOwnCatalogFallback) {
    listResult = await fetchProductsRequest({
      page,
      limit,
      search: params.search || undefined,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      category_id: categoryIds.length === 1 ? categoryIds[0] : undefined,
    });
  }

  if (!listResult) {
    return { data: [], total: 0, page, limit, totalPages: 0 };
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
