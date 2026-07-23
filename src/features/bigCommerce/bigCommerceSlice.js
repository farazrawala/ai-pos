import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  fetchMarketplaceProductsRequest,
  fetchMarketplaceCompanyProfileRequest,
  fetchMarketplaceCategoriesRequest,
  fetchMarketplaceBrandsRequest,
  fetchMarketplaceProductDetailRequest,
  fetchRelatedProductsRequest,
  fetchMarketplaceCompaniesRequest,
  sendCompanyStoreRequestRequest,
  duplicateMarketplaceProductRequest,
  fetchAlreadyMeTooProductIdsRequest,
  deleteFetchedMarketplaceProductWithFallback,
} from './bigCommerceAPI.js';
import {
  DEFAULT_FILTERS,
  PAGE_SIZE_OPTIONS,
  attachSiblingChildren,
  getProductCategory,
  getProductVariations,
  productIdFromRecord,
  collectAlreadyFetchedIdsFromProducts,
} from './marketplaceUtils.js';

const FILTERS_CACHE_KEY = 'bigCommerce.filters';

function loadCachedFilters() {
  try {
    const raw = sessionStorage.getItem(FILTERS_CACHE_KEY);
    if (!raw) return { ...DEFAULT_FILTERS };
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

function persistFilters(filters) {
  try {
    sessionStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(filters));
  } catch {
    // ignore quota / private mode
  }
}

export const loadMarketplaceBootstrap = createAsyncThunk(
  'bigCommerce/loadBootstrap',
  async ({ companyId } = {}, { rejectWithValue }) => {
    try {
      // Load profile independently so filter catalog failures don't blank the header.
      const [categoriesResult, brandsResult, companyResult] = await Promise.allSettled([
        fetchMarketplaceCategoriesRequest(companyId),
        fetchMarketplaceBrandsRequest(companyId),
        fetchMarketplaceCompanyProfileRequest(companyId, {}),
      ]);

      const categories =
        categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value)
          ? categoriesResult.value
          : [];
      const brands =
        brandsResult.status === 'fulfilled' && Array.isArray(brandsResult.value)
          ? brandsResult.value
          : [];
      const company =
        companyResult.status === 'fulfilled' && companyResult.value
          ? {
              ...companyResult.value,
              totalCategories: categories.length,
            }
          : null;

      if (!company && companyResult.status === 'rejected') {
        return rejectWithValue(
          companyResult.reason?.message || 'Failed to load company profile'
        );
      }

      return { company, categories, brands };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load marketplace');
    }
  }
);

export const fetchMarketplaceProducts = createAsyncThunk(
  'bigCommerce/fetchProducts',
  async (overrides = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState().bigCommerce;
      const {
        append: appendOverride,
        page: pageOverride,
        skip: skipOverride,
        limit: limitOverride,
        companyId: companyIdOverride,
        ...filterOverrides
      } = overrides;
      const filters = { ...state.filters, ...filterOverrides };
      const limit = Math.max(1, Number(limitOverride ?? state.pagination.limit) || 20);
      const companyId = companyIdOverride ?? state.companyId;
      const append = Boolean(appendOverride) || Number(skipOverride) > 0 || (pageOverride ?? 1) > 1;

      // Cursor-style skip from items already loaded — avoids gaps when a page returns
      // fewer rows than `limit` (e.g. after client filtering on older builds).
      const skip = append
        ? Math.max(0, Number(skipOverride ?? state.products.length) || 0)
        : Math.max(0, Number(skipOverride) || 0);

      const result = await fetchMarketplaceProductsRequest({
        ...filters,
        skip,
        limit,
        companyId,
      });

      const page = Math.floor(skip / limit) + 1;
      return { ...result, filters, append, page, limit, skip };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load products');
    }
  }
);

export const openMarketplaceProduct = createAsyncThunk(
  'bigCommerce/openProduct',
  async (arg, { getState, rejectWithValue }) => {
    try {
      const productId =
        typeof arg === 'object' && arg != null
          ? String(arg.productId ?? arg.id ?? '').trim()
          : String(arg || '').trim();
      const seedFromArg =
        typeof arg === 'object' && arg != null && arg.product && typeof arg.product === 'object'
          ? arg.product
          : null;

      const list = getState()?.bigCommerce?.products || [];
      const seedFromList = Array.isArray(list)
        ? list.find((item) => productIdFromRecord(item) === productId) || null
        : null;
      const seed = seedFromArg || seedFromList;

      const { product, variations } = await fetchMarketplaceProductDetailRequest(productId, {
        seed,
        catalog: list,
      });
      const cat = getProductCategory(product);
      const related = await fetchRelatedProductsRequest({
        categoryId: cat.id,
        excludeId: productIdFromRecord(product) || productId,
        limit: 6,
      });
      return { product, variations: variations || [], related };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load product');
    }
  }
);

export const fetchMarketplaceCompanies = createAsyncThunk(
  'bigCommerce/fetchCompanies',
  async (overrides = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState().bigCommerce;
      const page = overrides.page ?? state.companiesPagination.page;
      const limit = overrides.limit ?? state.companiesPagination.limit;
      const search =
        overrides.search !== undefined ? overrides.search : state.companiesSearch;
      const append = Boolean(overrides.append) || page > 1;
      const result = await fetchMarketplaceCompaniesRequest({
        page,
        limit,
        search: search || undefined,
        sortBy: 'company_name',
        sortOrder: 'asc',
      });
      return { ...result, append, page, limit };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load companies');
    }
  }
);

export const sendCompanyStoreRequest = createAsyncThunk(
  'bigCommerce/sendStoreRequest',
  async ({ companyId, message } = {}, { rejectWithValue }) => {
    try {
      const result = await sendCompanyStoreRequestRequest({ companyId, message });
      return { companyId, result };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to send request');
    }
  }
);

export const duplicateMarketplaceProduct = createAsyncThunk(
  'bigCommerce/duplicateProduct',
  async ({ productId } = {}, { rejectWithValue }) => {
    try {
      const result = await duplicateMarketplaceProductRequest(productId);
      return { productId, result };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to copy product');
    }
  }
);

export const loadAlreadyMeTooIds = createAsyncThunk(
  'bigCommerce/loadAlreadyMeTooIds',
  async ({ sourceCompanyId, ownCompanyId } = {}, { rejectWithValue }) => {
    try {
      const result = await fetchAlreadyMeTooProductIdsRequest({
        sourceCompanyId,
        ownCompanyId,
      });
      return result;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load Me too status');
    }
  }
);

export const deleteFetchedMarketplaceProduct = createAsyncThunk(
  'bigCommerce/deleteFetchedProduct',
  async ({ productId, localProductId, productName } = {}, { getState, rejectWithValue }) => {
    try {
      const sourceId = String(productId || '').trim();
      if (!sourceId) {
        return rejectWithValue('Product id is missing');
      }

      const bc = getState()?.bigCommerce || {};
      const map = bc.alreadyMeTooLocalBySource || {};
      let resolvedLocal =
        String(localProductId || '').trim() || String(map[sourceId] || '').trim();
      let refreshedLinks = null;

      // Refresh map so we soft-delete YOUR copy id (product_id), not the partner listing id.
      const sourceCompanyId = String(bc.companyId || '').trim();
      const ownCompanyId = String(getState()?.user?.companyId || '').trim();
      refreshedLinks = await fetchAlreadyMeTooProductIdsRequest({
        sourceCompanyId,
        ownCompanyId,
      });

      const fromApi = String(refreshedLinks?.bySourceId?.[sourceId] || '').trim();
      if (fromApi) resolvedLocal = fromApi;

      if (!resolvedLocal) {
        const pair = (refreshedLinks?.pairs || []).find(
          (p) => p.sourceId === sourceId || p.localId === sourceId
        );
        resolvedLocal = String(pair?.localId || '').trim();
      }

      if (!resolvedLocal) {
        return rejectWithValue(
          'Could not find your copy of this product. Refresh the page and try again.'
        );
      }

      // Backend soft-deletes by YOUR catalog _id (product_id from fetched-product-ids).
      const { result, deletedId } = await deleteFetchedMarketplaceProductWithFallback([
        resolvedLocal,
      ]);
      return {
        productId: sourceId,
        localProductId: deletedId,
        productName,
        result,
        refreshedLinks,
      };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to remove product');
    }
  }
);

function mergeAlreadyMeTooIds(state, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const set = new Set((state.alreadyMeTooIds || []).map(String));
  ids.forEach((id) => {
    const value = String(id || '').trim();
    if (value) set.add(value);
  });
  state.alreadyMeTooIds = [...set];
}

function mergeAlreadyMeTooLocalBySource(state, bySourceId) {
  if (!bySourceId || typeof bySourceId !== 'object') return;
  const next = { ...(state.alreadyMeTooLocalBySource || {}) };
  Object.entries(bySourceId).forEach(([sourceId, localId]) => {
    const source = String(sourceId || '').trim();
    const local = String(localId || '').trim();
    if (source && local) next[source] = local;
  });
  state.alreadyMeTooLocalBySource = next;
}

function removeAlreadyMeTooIds(state, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const remove = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
  state.alreadyMeTooIds = (state.alreadyMeTooIds || [])
    .map(String)
    .filter((id) => id && !remove.has(id));
  const map = { ...(state.alreadyMeTooLocalBySource || {}) };
  remove.forEach((sourceId) => {
    delete map[sourceId];
  });
  state.alreadyMeTooLocalBySource = map;

  // Listing payloads may bake in already_fetched; clear so UI returns to "Me too".
  const clearFlags = (item) => {
    if (!item || typeof item !== 'object') return item;
    const id = String(item._id ?? item.id ?? '').trim();
    if (!id || !remove.has(id)) return item;
    const next = { ...item };
    delete next.already_fetched;
    delete next.alreadyFetched;
    delete next.is_fetched;
    delete next.isFetched;
    delete next.me_too;
    delete next.meToo;
    delete next.in_my_catalog;
    delete next.inMyCatalog;
    return next;
  };
  if (Array.isArray(state.products) && state.products.length > 0) {
    state.products = state.products.map(clearFlags);
  }
  if (state.selectedProduct) {
    state.selectedProduct = clearFlags(state.selectedProduct);
  }
}

const initialState = {
  companyId: '',
  company: null,
  categories: [],
  brands: [],
  products: [],
  filters: loadCachedFilters(),
  pagination: {
    page: 1,
    limit: PAGE_SIZE_OPTIONS[1],
    total: 0,
    totalPages: 0,
  },
  viewMode: 'grid',
  bootstrapStatus: 'idle',
  productsStatus: 'idle',
  productsHasMore: true,
  detailStatus: 'idle',
  error: null,
  selectedProduct: null,
  selectedVariations: [],
  relatedProducts: [],
  detailOpen: false,

  companies: [],
  companiesSearch: '',
  companiesPagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  companiesStatus: 'idle',
  companiesError: null,
  companiesHasMore: true,
  storeRequestStatus: 'idle',
  storeRequestError: null,
  storeRequestTargetId: '',
  duplicateStatus: 'idle',
  duplicateError: null,
  duplicateProductId: '',
  duplicateProductName: '',
  duplicateAlreadyFetched: false,
  alreadyMeTooIds: [],
  alreadyMeTooLocalBySource: {},
  alreadyMeTooStatus: 'idle',
  deleteFetchedStatus: 'idle',
  deleteFetchedError: null,
  deleteFetchedProductId: '',
  deleteFetchedProductName: '',
};

const bigCommerceSlice = createSlice({
  name: 'bigCommerce',
  initialState,
  reducers: {
    setMarketplaceFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1;
      state.products = [];
      state.productsHasMore = true;
      persistFilters(state.filters);
    },
    resetMarketplaceFilters(state) {
      state.filters = { ...DEFAULT_FILTERS };
      state.pagination.page = 1;
      state.products = [];
      state.productsHasMore = true;
      persistFilters(state.filters);
    },
    setMarketplacePage(state, action) {
      state.pagination.page = Math.max(1, Number(action.payload) || 1);
    },
    setMarketplaceLimit(state, action) {
      const limit = Number(action.payload) || 20;
      state.pagination.limit = limit;
      state.pagination.page = 1;
      state.products = [];
      state.productsHasMore = true;
    },
    setMarketplaceCompanyId(state, action) {
      const nextId = String(action.payload || '').trim();
      if (nextId !== state.companyId) {
        state.company = null;
        state.categories = [];
        state.brands = [];
        state.products = [];
        state.pagination.page = 1;
        state.productsHasMore = true;
        state.alreadyMeTooIds = [];
        state.alreadyMeTooLocalBySource = {};
        state.alreadyMeTooStatus = 'idle';
        // Drop viewer-tenant category/brand filters — they do not apply to partner stores.
        state.filters = { ...DEFAULT_FILTERS };
        persistFilters(state.filters);
      }
      state.companyId = nextId;
    },
    setMarketplaceViewMode(state, action) {
      state.viewMode = action.payload === 'list' ? 'list' : 'grid';
    },
    closeMarketplaceDetail(state) {
      state.detailOpen = false;
      state.selectedProduct = null;
      state.selectedVariations = [];
      state.relatedProducts = [];
      state.detailStatus = 'idle';
    },
    setCompaniesSearch(state, action) {
      state.companiesSearch = String(action.payload || '');
      state.companiesPagination.page = 1;
      state.companies = [];
      state.companiesHasMore = true;
    },
    setCompaniesPage(state, action) {
      state.companiesPagination.page = Math.max(1, Number(action.payload) || 1);
    },
    setCompaniesLimit(state, action) {
      state.companiesPagination.limit = Number(action.payload) || 20;
      state.companiesPagination.page = 1;
      state.companies = [];
      state.companiesHasMore = true;
    },
    resetCompaniesList(state) {
      state.companies = [];
      state.companiesPagination.page = 1;
      state.companiesHasMore = true;
      state.companiesError = null;
      state.companiesStatus = 'idle';
    },
    clearStoreRequestStatus(state) {
      state.storeRequestStatus = 'idle';
      state.storeRequestError = null;
      state.storeRequestTargetId = '';
    },
    clearDuplicateStatus(state) {
      state.duplicateStatus = 'idle';
      state.duplicateError = null;
      state.duplicateProductId = '';
      state.duplicateProductName = '';
      state.duplicateAlreadyFetched = false;
    },
    clearDeleteFetchedStatus(state) {
      state.deleteFetchedStatus = 'idle';
      state.deleteFetchedError = null;
      state.deleteFetchedProductId = '';
      state.deleteFetchedProductName = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMarketplaceBootstrap.pending, (state) => {
        state.bootstrapStatus = 'loading';
        state.error = null;
        state.company = null;
      })
      .addCase(loadMarketplaceBootstrap.fulfilled, (state, action) => {
        state.bootstrapStatus = 'succeeded';
        state.company = action.payload.company;
        state.categories = action.payload.categories;
        state.brands = action.payload.brands;
      })
      .addCase(loadMarketplaceBootstrap.rejected, (state, action) => {
        state.bootstrapStatus = 'failed';
        state.company = null;
        state.error = action.payload || 'Failed to load marketplace';
      })
      .addCase(fetchMarketplaceProducts.pending, (state, action) => {
        const append =
          Boolean(action.meta?.arg?.append) || (action.meta?.arg?.page ?? 1) > 1;
        state.productsStatus = append ? 'loadingMore' : 'loading';
        state.error = null;
      })
      .addCase(fetchMarketplaceProducts.fulfilled, (state, action) => {
        state.productsStatus = 'succeeded';
        const incoming = action.payload.data || [];
        const append = Boolean(action.payload.append);
        const previousLength = state.products.length;
        if (append) {
          const seen = new Set(state.products.map((p) => String(p._id ?? p.id)));
          const merged = [...state.products];
          incoming.forEach((p) => {
            const id = String(p._id ?? p.id ?? '');
            if (!id || seen.has(id)) return;
            seen.add(id);
            merged.push(p);
          });
          // Re-nest so children loaded on later pages attach to earlier parents.
          state.products = attachSiblingChildren(merged);
        } else {
          state.products = attachSiblingChildren(incoming);
        }
        mergeAlreadyMeTooIds(state, collectAlreadyFetchedIdsFromProducts(incoming));
        state.pagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
          totalPages: action.payload.totalPages,
        };
        const loaded = state.products.length;
        const total = Number(action.payload.total) || 0;
        const listGrew = !append || loaded > previousLength;
        // Stop when the API returns an empty page, only duplicates, or we've caught up.
        // Relying on `loaded < total` alone loops forever if `total` is stale / mismatched.
        state.productsHasMore = incoming.length > 0 && listGrew && loaded < total;
        if (state.company) {
          state.company.totalProducts = total;
          state.company.totalCategories = state.categories.length;
        } else if (total > 0) {
          // Profile may still be loading/failed — still surface the catalog count.
          state.company = {
            id: state.companyId,
            name: 'Company Marketplace',
            description: '',
            location: '',
            phone: '',
            email: '',
            logoUrl: '',
            coverUrl: '',
            rating: null,
            showStoreForListing: true,
            showProducts: true,
            showStoreForRequest: false,
            totalProducts: total,
            totalCategories: state.categories.length,
            joinedAt: null,
          };
        }
      })
      .addCase(fetchMarketplaceProducts.rejected, (state, action) => {
        const append =
          Boolean(action.meta?.arg?.append) || (action.meta?.arg?.page ?? 1) > 1;
        state.productsStatus = 'failed';
        state.error = action.payload || 'Failed to load products';
        if (!append) {
          state.products = [];
          state.productsHasMore = false;
        }
      })
      .addCase(openMarketplaceProduct.pending, (state, action) => {
        state.detailStatus = 'loading';
        state.detailOpen = true;
        state.relatedProducts = [];

        const arg = action.meta?.arg;
        const productId =
          typeof arg === 'object' && arg != null
            ? String(arg.productId ?? arg.id ?? '').trim()
            : String(arg || '').trim();
        const seedFromArg =
          typeof arg === 'object' && arg != null && arg.product && typeof arg.product === 'object'
            ? arg.product
            : null;
        const seedFromList = productId
          ? state.products.find((item) => productIdFromRecord(item) === productId) || null
          : null;
        const seed = seedFromArg || seedFromList;
        if (seed) {
          const kids = getProductVariations(seed);
          state.selectedProduct = seed;
          state.selectedVariations = kids;
        }
      })
      .addCase(openMarketplaceProduct.fulfilled, (state, action) => {
        state.detailStatus = 'succeeded';
        state.selectedProduct = action.payload.product;
        state.selectedVariations = action.payload.variations || [];
        state.relatedProducts = action.payload.related || [];
      })
      .addCase(openMarketplaceProduct.rejected, (state, action) => {
        state.detailStatus = 'failed';
        state.error = action.payload || 'Failed to load product';
      })
      .addCase(fetchMarketplaceCompanies.pending, (state, action) => {
        const append = Boolean(action.meta?.arg?.append) || (action.meta?.arg?.page ?? 1) > 1;
        state.companiesStatus = append ? 'loadingMore' : 'loading';
        state.companiesError = null;
      })
      .addCase(fetchMarketplaceCompanies.fulfilled, (state, action) => {
        state.companiesStatus = 'succeeded';
        const incoming = action.payload.data || [];
        const append = Boolean(action.payload.append);
        if (append) {
          const seen = new Set(state.companies.map((c) => String(c._id ?? c.id)));
          const merged = [...state.companies];
          incoming.forEach((c) => {
            const id = String(c._id ?? c.id ?? '');
            if (!id || seen.has(id)) return;
            seen.add(id);
            merged.push(c);
          });
          state.companies = merged;
        } else {
          state.companies = incoming;
        }
        state.companiesPagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
          totalPages: action.payload.totalPages,
        };
        const page = action.payload.page || 1;
        const totalPages = action.payload.totalPages || 0;
        const loaded = state.companies.length;
        const total = action.payload.total || 0;
        state.companiesHasMore =
          incoming.length > 0 &&
          (totalPages > 0 ? page < totalPages : loaded < total);
      })
      .addCase(fetchMarketplaceCompanies.rejected, (state, action) => {
        const append = Boolean(action.meta?.arg?.append) || (action.meta?.arg?.page ?? 1) > 1;
        state.companiesStatus = 'failed';
        state.companiesError = action.payload || 'Failed to load companies';
        if (!append) {
          state.companies = [];
          state.companiesHasMore = false;
        }
      })
      .addCase(sendCompanyStoreRequest.pending, (state, action) => {
        state.storeRequestStatus = 'loading';
        state.storeRequestError = null;
        state.storeRequestTargetId = String(action.meta?.arg?.companyId || '');
      })
      .addCase(sendCompanyStoreRequest.fulfilled, (state) => {
        state.storeRequestStatus = 'succeeded';
        state.storeRequestTargetId = '';
      })
      .addCase(sendCompanyStoreRequest.rejected, (state, action) => {
        state.storeRequestStatus = 'failed';
        state.storeRequestError = action.payload || 'Failed to send request';
        state.storeRequestTargetId = '';
      })
      .addCase(duplicateMarketplaceProduct.pending, (state, action) => {
        state.duplicateStatus = 'loading';
        state.duplicateError = null;
        state.duplicateAlreadyFetched = false;
        state.duplicateProductId = String(action.meta?.arg?.productId || '');
        state.duplicateProductName = String(action.meta?.arg?.productName || '').trim();
      })
      .addCase(duplicateMarketplaceProduct.fulfilled, (state, action) => {
        state.duplicateStatus = 'succeeded';
        state.duplicateAlreadyFetched = Boolean(action.payload?.result?.already_fetched);
        state.duplicateProductId = String(action.payload?.productId || '');
        const sourceId = String(action.payload?.productId || '').trim();
        mergeAlreadyMeTooIds(state, [sourceId]);
        const result = action.payload?.result;
        const copied =
          result?.product && typeof result.product === 'object'
            ? result.product
            : result?.data && typeof result.data === 'object' && !Array.isArray(result.data)
              ? result.data
              : null;
        const localId = String(
          copied?._id ??
            copied?.id ??
            copied?.product_id ??
            result?.product_id ??
            result?.data?._id ??
            result?.data?.product_id ??
            ''
        ).trim();
        if (sourceId && localId && localId !== sourceId) {
          mergeAlreadyMeTooLocalBySource(state, { [sourceId]: localId });
        }
      })
      .addCase(duplicateMarketplaceProduct.rejected, (state, action) => {
        state.duplicateStatus = 'failed';
        state.duplicateError = action.payload || 'Failed to copy product';
        state.duplicateProductId = '';
        state.duplicateAlreadyFetched = false;
      })
      .addCase(loadAlreadyMeTooIds.pending, (state) => {
        state.alreadyMeTooStatus = 'loading';
      })
      .addCase(loadAlreadyMeTooIds.fulfilled, (state, action) => {
        state.alreadyMeTooStatus = 'succeeded';
        state.alreadyMeTooIds = [];
        state.alreadyMeTooLocalBySource = {};
        mergeAlreadyMeTooIds(state, action.payload?.sourceIds || action.payload?.ids || []);
        mergeAlreadyMeTooLocalBySource(state, action.payload?.bySourceId || {});
      })
      .addCase(loadAlreadyMeTooIds.rejected, (state) => {
        state.alreadyMeTooStatus = 'failed';
      })
      .addCase(deleteFetchedMarketplaceProduct.pending, (state, action) => {
        state.deleteFetchedStatus = 'loading';
        state.deleteFetchedError = null;
        state.deleteFetchedProductId = String(action.meta?.arg?.productId || '');
        state.deleteFetchedProductName = String(action.meta?.arg?.productName || '').trim();
      })
      .addCase(deleteFetchedMarketplaceProduct.fulfilled, (state, action) => {
        state.deleteFetchedStatus = 'succeeded';
        state.deleteFetchedProductId = String(action.payload?.productId || '');
        const refreshed = action.payload?.refreshedLinks;
        if (refreshed?.bySourceId) {
          mergeAlreadyMeTooLocalBySource(state, refreshed.bySourceId);
        }
        if (Array.isArray(refreshed?.sourceIds) && refreshed.sourceIds.length > 0) {
          mergeAlreadyMeTooIds(state, refreshed.sourceIds);
        }
        removeAlreadyMeTooIds(state, [action.payload?.productId]);
      })
      .addCase(deleteFetchedMarketplaceProduct.rejected, (state, action) => {
        state.deleteFetchedStatus = 'failed';
        state.deleteFetchedError = action.payload || 'Failed to remove product';
        state.deleteFetchedProductId = '';
      });
  },
});

export const {
  setMarketplaceCompanyId,
  setMarketplaceFilters,
  resetMarketplaceFilters,
  setMarketplacePage,
  setMarketplaceLimit,
  setMarketplaceViewMode,
  closeMarketplaceDetail,
  setCompaniesSearch,
  setCompaniesPage,
  setCompaniesLimit,
  resetCompaniesList,
  clearStoreRequestStatus,
  clearDuplicateStatus,
  clearDeleteFetchedStatus,
} = bigCommerceSlice.actions;

export const selectBigCommerce = (state) => state.bigCommerce;

export default bigCommerceSlice.reducer;
