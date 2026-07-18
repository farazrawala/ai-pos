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
} from './bigCommerceAPI.js';
import { DEFAULT_FILTERS, PAGE_SIZE_OPTIONS } from './marketplaceUtils.js';
import { getProductCategory, productIdFromRecord } from './marketplaceUtils.js';

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
        fetchMarketplaceCategoriesRequest(),
        fetchMarketplaceBrandsRequest(),
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
      const { append: appendOverride, page: pageOverride, limit: limitOverride, companyId: companyIdOverride, ...filterOverrides } =
        overrides;
      const filters = { ...state.filters, ...filterOverrides };
      const page = pageOverride ?? state.pagination.page;
      const limit = limitOverride ?? state.pagination.limit;
      const companyId = companyIdOverride ?? state.companyId;
      const append = Boolean(appendOverride) || page > 1;

      const result = await fetchMarketplaceProductsRequest({
        ...filters,
        page,
        limit,
        companyId,
      });

      return { ...result, filters, append, page, limit };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to load products');
    }
  }
);

export const openMarketplaceProduct = createAsyncThunk(
  'bigCommerce/openProduct',
  async (productId, { rejectWithValue }) => {
    try {
      const { product, variations } = await fetchMarketplaceProductDetailRequest(productId);
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
        state.products = [];
        state.pagination.page = 1;
        state.productsHasMore = true;
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
        if (append) {
          const seen = new Set(state.products.map((p) => String(p._id ?? p.id)));
          const merged = [...state.products];
          incoming.forEach((p) => {
            const id = String(p._id ?? p.id ?? '');
            if (!id || seen.has(id)) return;
            seen.add(id);
            merged.push(p);
          });
          state.products = merged;
        } else {
          state.products = incoming;
        }
        state.pagination = {
          page: action.payload.page,
          limit: action.payload.limit,
          total: action.payload.total,
          totalPages: action.payload.totalPages,
        };
        const page = action.payload.page || 1;
        const totalPages = action.payload.totalPages || 0;
        const loaded = state.products.length;
        const total = Number(action.payload.total) || 0;
        // Keep paging even if a page is empty after client-side parent filtering.
        state.productsHasMore =
          total > loaded && (totalPages > 0 ? page < totalPages : true);
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
      .addCase(openMarketplaceProduct.pending, (state) => {
        state.detailStatus = 'loading';
        state.detailOpen = true;
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
} = bigCommerceSlice.actions;

export const selectBigCommerce = (state) => state.bigCommerce;

export default bigCommerceSlice.reducer;
