import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchPurchaseOrderByPurchaseItemRequest,
  fetchPurchaseOrdersListRequest,
  fetchPurchaseOrderByIdRequest,
  createPurchaseOrderRequest,
  updatePurchaseOrderRequest,
  unwrapPurchaseOrderRecord,
} from './purchaseOrdersAPI.js';

/** Paginated list from `get-purchase-order-by-purchase-item` */
export const fetchPurchaseOrders = createAsyncThunk(
  'purchaseOrders/fetchPurchaseOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchPurchaseOrdersListRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch purchase orders');
    }
  }
);

export const fetchPurchaseOrderById = createAsyncThunk(
  'purchaseOrders/fetchPurchaseOrderById',
  async (purchaseOrderId, { rejectWithValue }) => {
    try {
      const raw = await fetchPurchaseOrderByIdRequest(purchaseOrderId);
      return unwrapPurchaseOrderRecord(raw) ?? raw;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch purchase order');
    }
  }
);

export const createPurchaseOrder = createAsyncThunk(
  'purchaseOrders/createPurchaseOrder',
  async (payload = {}, { rejectWithValue }) => {
    try {
      const raw = await createPurchaseOrderRequest(payload);
      return unwrapPurchaseOrderRecord(raw) ?? raw;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create purchase order');
    }
  }
);

export const updatePurchaseOrder = createAsyncThunk(
  'purchaseOrders/updatePurchaseOrder',
  async ({ purchaseOrderId, purchaseOrderData }, { rejectWithValue }) => {
    try {
      const raw = await updatePurchaseOrderRequest(purchaseOrderId, purchaseOrderData);
      const response = unwrapPurchaseOrderRecord(raw) ?? raw;
      return { purchaseOrderId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update purchase order');
    }
  }
);

export const fetchPurchaseOrderByPurchaseItem = createAsyncThunk(
  'purchaseOrders/fetchPurchaseOrderByPurchaseItem',
  async (purchaseItemId, { rejectWithValue }) => {
    try {
      return await fetchPurchaseOrderByPurchaseItemRequest(purchaseItemId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load purchase order');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  search: '',
  sort: {
    sortBy: null,
    sortOrder: 'asc',
  },
  filterPurchaseItemId: '',

  currentPurchaseOrder: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,

  byPurchaseItemStatus: 'idle',
  byPurchaseItemError: null,
  purchaseOrderByItem: null,
  purchaseItemIdQueried: null,
};

const purchaseOrdersSlice = createSlice({
  name: 'purchaseOrders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.page = 1;
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
    },
    setSort: (state, action) => {
      const { sortBy, sortOrder } = action.payload;
      if (sortBy === null) {
        state.sort.sortBy = null;
        state.sort.sortOrder = 'asc';
      } else if (state.sort.sortBy === sortBy) {
        state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.sortBy = sortBy;
        state.sort.sortOrder = sortOrder || 'asc';
      }
      state.pagination.page = 1;
    },
    setFilterPurchaseItemId: (state, action) => {
      state.filterPurchaseItemId = action.payload != null ? String(action.payload) : '';
      state.pagination.page = 1;
    },
    clearPurchaseOrderByItem: (state) => {
      state.byPurchaseItemStatus = 'idle';
      state.byPurchaseItemError = null;
      state.purchaseOrderByItem = null;
      state.purchaseItemIdQueried = null;
    },
    clearCurrentPurchaseOrder: (state) => {
      state.currentPurchaseOrder = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchaseOrders.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total ?? 0,
          totalPages: action.payload.totalPages ?? 0,
        };
        state.error = null;
      })
      .addCase(fetchPurchaseOrders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch purchase orders';
        state.list = [];
      })
      .addCase(fetchPurchaseOrderById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchPurchaseOrderById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentPurchaseOrder = action.payload ?? null;
      })
      .addCase(fetchPurchaseOrderById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError =
          action.payload || action.error.message || 'Failed to fetch purchase order';
      })
      .addCase(updatePurchaseOrder.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updatePurchaseOrder.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { purchaseOrderId, response } = action.payload;
        const patch =
          response && typeof response === 'object' && !Array.isArray(response) ? response : {};
        if (state.currentPurchaseOrder) {
          const cid =
            state.currentPurchaseOrder._id ??
            state.currentPurchaseOrder.id ??
            '';
          if (String(cid) === String(purchaseOrderId)) {
            state.currentPurchaseOrder = { ...state.currentPurchaseOrder, ...patch };
          }
        }
        const idx = state.list.findIndex(
          (item) => String(item._id ?? item.id ?? '') === String(purchaseOrderId)
        );
        if (idx !== -1) {
          state.list[idx] = { ...state.list[idx], ...patch };
        }
      })
      .addCase(updatePurchaseOrder.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError =
          action.payload || action.error.message || 'Failed to update purchase order';
      })
      .addCase(fetchPurchaseOrderByPurchaseItem.pending, (state) => {
        state.byPurchaseItemStatus = 'loading';
        state.byPurchaseItemError = null;
      })
      .addCase(fetchPurchaseOrderByPurchaseItem.fulfilled, (state, action) => {
        state.byPurchaseItemStatus = 'succeeded';
        state.purchaseOrderByItem = action.payload ?? null;
        state.purchaseItemIdQueried = action.meta.arg != null ? String(action.meta.arg).trim() : null;
      })
      .addCase(fetchPurchaseOrderByPurchaseItem.rejected, (state, action) => {
        state.byPurchaseItemStatus = 'failed';
        state.byPurchaseItemError =
          action.payload || action.error.message || 'Failed to load purchase order';
        state.purchaseOrderByItem = null;
        state.purchaseItemIdQueried = null;
      });
  },
});

export const {
  clearError,
  setSearch,
  setPage,
  setLimit,
  setSort,
  setFilterPurchaseItemId,
  clearPurchaseOrderByItem,
  clearCurrentPurchaseOrder,
  clearUpdateStatus,
} = purchaseOrdersSlice.actions;
export default purchaseOrdersSlice.reducer;
