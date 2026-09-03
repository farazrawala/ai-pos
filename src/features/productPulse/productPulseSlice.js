import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchProductPulseBundle,
  fetchProductPulseSales,
  fetchProductPulseTimeline,
} from './productPulseAPI.js';
import { DEFAULT_DATE_PRESET } from './productPulseEngine.js';

const defaultSalesPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  cursor: null,
};

const idleLoadProgress = {
  percent: 0,
  stage: 'idle',
  label: '',
  detail: '',
};

export const loadProductPulse = createAsyncThunk(
  'productPulse/load',
  async (params, { dispatch, rejectWithValue }) => {
    try {
      return await fetchProductPulseBundle({
        ...params,
        granularity: params.granularity || 'daily',
        page: params.page || 1,
        limit: params.limit || 25,
        onProgress: (progress) => dispatch(setLoadProgress(progress)),
      });
    } catch (e) {
      return rejectWithValue({
        message: e.message || 'Failed to load ProductPulse',
        status: e.status || null,
      });
    }
  }
);

export const loadProductPulseTimeline = createAsyncThunk(
  'productPulse/timeline',
  async (params, { rejectWithValue }) => {
    try {
      return await fetchProductPulseTimeline(params);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load timeline');
    }
  }
);

export const loadProductPulseSales = createAsyncThunk(
  'productPulse/sales',
  async (params, { rejectWithValue }) => {
    try {
      return await fetchProductPulseSales(params);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load sales history');
    }
  }
);

const productPulseSlice = createSlice({
  name: 'productPulse',
  initialState: {
    productId: '',
    variantId: '',
    warehouseId: '',
    preset: DEFAULT_DATE_PRESET,
    startDate: '',
    endDate: '',
    granularity: 'daily',
    overview: null,
    timeline: null,
    variants: null,
    warehouses: null,
    sales: [],
    salesPagination: { ...defaultSalesPagination },
    status: 'idle',
    timelineStatus: 'idle',
    salesStatus: 'idle',
    error: null,
    timelineError: null,
    salesError: null,
    loadProgress: { ...idleLoadProgress },
  },
  reducers: {
    setLoadProgress: (state, action) => {
      const next = action.payload || {};
      const percent = Number(next.percent);
      if (Number.isFinite(percent)) {
        state.loadProgress.percent = Math.max(state.loadProgress.percent || 0, Math.min(100, percent));
      }
      if (next.stage) state.loadProgress.stage = next.stage;
      if (next.label) state.loadProgress.label = next.label;
      if (next.detail != null) state.loadProgress.detail = next.detail;
    },
    setProductPulseFilters: (state, action) => {
      const next = action.payload || {};
      if (next.productId != null) state.productId = next.productId;
      if (next.variantId != null) state.variantId = next.variantId;
      if (next.warehouseId != null) state.warehouseId = next.warehouseId;
      if (next.preset != null) state.preset = next.preset;
      if (next.startDate != null) state.startDate = next.startDate;
      if (next.endDate != null) state.endDate = next.endDate;
      if (next.granularity != null) state.granularity = next.granularity;
    },
    clearProductPulse: (state) => {
      state.overview = null;
      state.timeline = null;
      state.variants = null;
      state.warehouses = null;
      state.sales = [];
      state.salesPagination = { ...defaultSalesPagination };
      state.status = 'idle';
      state.timelineStatus = 'idle';
      state.salesStatus = 'idle';
      state.error = null;
      state.timelineError = null;
      state.salesError = null;
      state.loadProgress = { ...idleLoadProgress };
    },
    setSalesPage: (state, action) => {
      state.salesPagination.page = action.payload;
    },
    setSalesLimit: (state, action) => {
      state.salesPagination.limit = action.payload;
      state.salesPagination.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProductPulse.pending, (state, action) => {
        state.status = 'loading';
        state.timelineStatus = 'loading';
        state.salesStatus = 'loading';
        state.error = null;
        state.timelineError = null;
        state.salesError = null;
        const arg = action.meta.arg || {};
        if (arg.productId) state.productId = arg.productId;
        if (arg.variantId != null) state.variantId = arg.variantId;
        if (arg.warehouseId != null) state.warehouseId = arg.warehouseId;
        if (arg.preset) state.preset = arg.preset;
        if (arg.startDate) state.startDate = arg.startDate;
        if (arg.endDate) state.endDate = arg.endDate;
        state.loadProgress = {
          percent: 8,
          stage: 'loading',
          section: 'Product details',
          label: 'Product details',
          detail: 'Fetching product data…',
        };
      })
      .addCase(loadProductPulse.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.timelineStatus = 'succeeded';
        state.salesStatus = 'succeeded';
        state.loadProgress = { percent: 100, stage: 'ready', label: '', detail: '' };
        state.overview = action.payload.overview;
        state.timeline = action.payload.timeline;
        state.variants = action.payload.variants;
        state.warehouses = action.payload.warehouses;
        state.sales = action.payload.sales?.rows ?? [];
        state.salesPagination = action.payload.sales?.pagination ?? { ...defaultSalesPagination };
      })
      .addCase(loadProductPulse.rejected, (state, action) => {
        state.status = 'failed';
        state.timelineStatus = 'failed';
        state.salesStatus = 'failed';
        const payload = action.payload;
        state.error =
          (payload && payload.message) || payload || action.error?.message || 'Failed to load ProductPulse';
        state.overview = null;
        state.timeline = null;
        state.variants = null;
        state.warehouses = null;
        state.sales = [];
        state.loadProgress = { ...idleLoadProgress };
      })
      .addCase(loadProductPulseTimeline.pending, (state) => {
        state.timelineStatus = 'loading';
        state.timelineError = null;
      })
      .addCase(loadProductPulseTimeline.fulfilled, (state, action) => {
        state.timelineStatus = 'succeeded';
        state.timeline = action.payload;
        if (action.payload?.granularity) state.granularity = action.payload.granularity;
      })
      .addCase(loadProductPulseTimeline.rejected, (state, action) => {
        state.timelineStatus = 'failed';
        state.timelineError = action.payload || action.error?.message;
      })
      .addCase(loadProductPulseSales.pending, (state) => {
        state.salesStatus = 'loading';
        state.salesError = null;
      })
      .addCase(loadProductPulseSales.fulfilled, (state, action) => {
        state.salesStatus = 'succeeded';
        state.sales = action.payload?.rows ?? [];
        state.salesPagination = action.payload?.pagination ?? state.salesPagination;
      })
      .addCase(loadProductPulseSales.rejected, (state, action) => {
        state.salesStatus = 'failed';
        state.salesError = action.payload || action.error?.message;
      });
  },
});

export const { setProductPulseFilters, setLoadProgress, clearProductPulse, setSalesPage, setSalesLimit } =
  productPulseSlice.actions;
export default productPulseSlice.reducer;
