import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchOrderPulseBundle, fetchOrderPulseOrders, fetchOrderPulseTrend } from './orderPulseAPI.js';
import { DEFAULT_DATE_PRESET } from './orderPulseEngine.js';

const defaultOrdersPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  cursor: null,
};

const idleLoadProgress = {
  percent: 0,
  stage: 'idle',
  section: '',
  label: '',
  detail: '',
};

export const loadOrderPulse = createAsyncThunk(
  'orderPulse/load',
  async (params, { dispatch, rejectWithValue }) => {
    try {
      return await fetchOrderPulseBundle({
        ...params,
        granularity: params.granularity || 'daily',
        page: params.page || 1,
        limit: params.limit || 25,
        onProgress: (progress) => dispatch(setLoadProgress(progress)),
      });
    } catch (e) {
      return rejectWithValue({
        message: e.message || 'Failed to load OrderPulse',
        status: e.status || null,
      });
    }
  }
);

export const loadOrderPulseTrend = createAsyncThunk(
  'orderPulse/trend',
  async (params, { rejectWithValue }) => {
    try {
      return await fetchOrderPulseTrend(params);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load trend');
    }
  }
);

export const loadOrderPulseOrders = createAsyncThunk(
  'orderPulse/orders',
  async (params, { rejectWithValue }) => {
    try {
      return await fetchOrderPulseOrders(params);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load orders');
    }
  }
);

const orderPulseSlice = createSlice({
  name: 'orderPulse',
  initialState: {
    warehouseId: '',
    orderStatus: '',
    paymentStatus: '',
    paymentMethodId: '',
    orderType: '',
    productId: '',
    preset: DEFAULT_DATE_PRESET,
    startDate: '',
    endDate: '',
    granularity: 'daily',
    search: '',
    overview: null,
    trend: null,
    status: null,
    products: null,
    customers: null,
    payments: null,
    returns: null,
    cancellations: null,
    orders: [],
    ordersPagination: { ...defaultOrdersPagination },
    loadStatus: 'idle',
    trendStatus: 'idle',
    ordersStatus: 'idle',
    error: null,
    trendError: null,
    ordersError: null,
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
      if (next.section) state.loadProgress.section = next.section;
      if (next.label) state.loadProgress.label = next.label;
      if (next.detail != null) state.loadProgress.detail = next.detail;
    },
    setOrderPulseFilters: (state, action) => {
      const next = action.payload || {};
      const keys = [
        'warehouseId',
        'orderStatus',
        'paymentStatus',
        'paymentMethodId',
        'orderType',
        'productId',
        'preset',
        'startDate',
        'endDate',
        'granularity',
        'search',
      ];
      for (const key of keys) {
        if (next[key] != null) state[key] = next[key];
      }
    },
    clearOrderPulse: (state) => {
      state.overview = null;
      state.trend = null;
      state.status = null;
      state.products = null;
      state.customers = null;
      state.payments = null;
      state.returns = null;
      state.cancellations = null;
      state.orders = [];
      state.ordersPagination = { ...defaultOrdersPagination };
      state.loadStatus = 'idle';
      state.trendStatus = 'idle';
      state.ordersStatus = 'idle';
      state.error = null;
      state.trendError = null;
      state.ordersError = null;
      state.loadProgress = { ...idleLoadProgress };
    },
    setOrdersPage: (state, action) => {
      state.ordersPagination.page = action.payload;
    },
    setOrdersLimit: (state, action) => {
      state.ordersPagination.limit = action.payload;
      state.ordersPagination.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadOrderPulse.pending, (state, action) => {
        state.loadStatus = 'loading';
        state.trendStatus = 'loading';
        state.ordersStatus = 'loading';
        state.error = null;
        state.trendError = null;
        state.ordersError = null;
        const arg = action.meta.arg || {};
        if (arg.warehouseId != null) state.warehouseId = arg.warehouseId;
        if (arg.orderStatus != null) state.orderStatus = arg.orderStatus;
        if (arg.preset) state.preset = arg.preset;
        if (arg.startDate) state.startDate = arg.startDate;
        if (arg.endDate) state.endDate = arg.endDate;
        state.loadProgress = {
          percent: 8,
          stage: 'loading',
          section: 'Overview',
          label: 'Overview',
          detail: 'Starting Order Pulse…',
        };
      })
      .addCase(loadOrderPulse.fulfilled, (state, action) => {
        state.loadStatus = 'succeeded';
        state.trendStatus = 'succeeded';
        state.ordersStatus = 'succeeded';
        state.loadProgress = { percent: 100, stage: 'ready', section: '', label: '', detail: '' };
        state.overview = action.payload.overview;
        state.trend = action.payload.trend;
        state.status = action.payload.status;
        state.products = action.payload.products;
        state.customers = action.payload.customers;
        state.payments = action.payload.payments;
        state.returns = action.payload.returns;
        state.cancellations = action.payload.cancellations;
        state.orders = action.payload.orders?.rows ?? [];
        state.ordersPagination = action.payload.orders?.pagination ?? { ...defaultOrdersPagination };
      })
      .addCase(loadOrderPulse.rejected, (state, action) => {
        state.loadStatus = 'failed';
        state.trendStatus = 'failed';
        state.ordersStatus = 'failed';
        const payload = action.payload;
        state.error =
          (payload && payload.message) || payload || action.error?.message || 'Failed to load OrderPulse';
        state.overview = null;
        state.trend = null;
        state.status = null;
        state.products = null;
        state.customers = null;
        state.payments = null;
        state.returns = null;
        state.cancellations = null;
        state.orders = [];
        state.loadProgress = { ...idleLoadProgress };
      })
      .addCase(loadOrderPulseTrend.pending, (state) => {
        state.trendStatus = 'loading';
        state.trendError = null;
      })
      .addCase(loadOrderPulseTrend.fulfilled, (state, action) => {
        state.trendStatus = 'succeeded';
        state.trend = action.payload;
        if (action.payload?.granularity) state.granularity = action.payload.granularity;
      })
      .addCase(loadOrderPulseTrend.rejected, (state, action) => {
        state.trendStatus = 'failed';
        state.trendError = action.payload || action.error?.message;
      })
      .addCase(loadOrderPulseOrders.pending, (state) => {
        state.ordersStatus = 'loading';
        state.ordersError = null;
      })
      .addCase(loadOrderPulseOrders.fulfilled, (state, action) => {
        state.ordersStatus = 'succeeded';
        state.orders = action.payload?.rows ?? [];
        state.ordersPagination = action.payload?.pagination ?? state.ordersPagination;
      })
      .addCase(loadOrderPulseOrders.rejected, (state, action) => {
        state.ordersStatus = 'failed';
        state.ordersError = action.payload || action.error?.message;
      });
  },
});

export const { setLoadProgress, setOrderPulseFilters, clearOrderPulse, setOrdersPage, setOrdersLimit } =
  orderPulseSlice.actions;
export default orderPulseSlice.reducer;
