import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchPurchaseOrderReturnByPurchaseItemRequest,
  fetchPurchaseOrderReturnsListRequest,
  fetchPurchaseOrderReturnByIdRequest,
  createPurchaseOrderReturnRequest,
  updatePurchaseOrderReturnRequest,
  unwrapPurchaseOrderReturnRecord,
} from './purchaseOrderReturnsAPI.js';

/** Paginated list from `get-purchase-order-by-purchase-item` */
export const fetchPurchaseOrderReturns = createAsyncThunk(
  'purchaseOrderReturns/fetchPurchaseOrderReturns',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchPurchaseOrderReturnsListRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch purchase order returns');
    }
  }
);

export const fetchPurchaseOrderReturnById = createAsyncThunk(
  'purchaseOrderReturns/fetchPurchaseOrderReturnById',
  async (purchaseOrderReturnId, { rejectWithValue }) => {
    try {
      const raw = await fetchPurchaseOrderReturnByIdRequest(purchaseOrderReturnId);
      return unwrapPurchaseOrderReturnRecord(raw) ?? raw;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch purchase order return');
    }
  }
);

export const createPurchaseOrderReturn = createAsyncThunk(
  'purchaseOrderReturns/createPurchaseOrderReturn',
  async (payload = {}, { rejectWithValue }) => {
    try {
      const raw = await createPurchaseOrderReturnRequest(payload);
      return unwrapPurchaseOrderReturnRecord(raw) ?? raw;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create purchase order return');
    }
  }
);

export const updatePurchaseOrderReturn = createAsyncThunk(
  'purchaseOrderReturns/updatePurchaseOrderReturn',
  async ({ purchaseOrderReturnId, purchaseOrderReturnData }, { rejectWithValue }) => {
    try {
      const raw = await updatePurchaseOrderReturnRequest(purchaseOrderReturnId, purchaseOrderReturnData);
      const response = unwrapPurchaseOrderReturnRecord(raw) ?? raw;
      return { purchaseOrderReturnId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update purchase order return');
    }
  }
);

export const fetchPurchaseOrderReturnByPurchaseItem = createAsyncThunk(
  'purchaseOrderReturns/fetchPurchaseOrderReturnByPurchaseItem',
  async (purchaseItemId, { rejectWithValue }) => {
    try {
      return await fetchPurchaseOrderReturnByPurchaseItemRequest(purchaseItemId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load purchase order return');
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
  filterPurchaseReturnItemId: '',

  currentPurchaseOrderReturn: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,

  byPurchaseItemStatus: 'idle',
  byPurchaseItemError: null,
  purchaseOrderReturnByItem: null,
  purchaseItemIdQueried: null,
};

const purchaseOrderReturnsSlice = createSlice({
  name: 'purchaseOrderReturns',
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
    setFilterPurchaseReturnItemId: (state, action) => {
      state.filterPurchaseReturnItemId = action.payload != null ? String(action.payload) : '';
      state.pagination.page = 1;
    },
    clearPurchaseOrderReturnByItem: (state) => {
      state.byPurchaseItemStatus = 'idle';
      state.byPurchaseItemError = null;
      state.purchaseOrderReturnByItem = null;
      state.purchaseItemIdQueried = null;
    },
    clearCurrentPurchaseOrderReturn: (state) => {
      state.currentPurchaseOrderReturn = null;
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
      .addCase(fetchPurchaseOrderReturns.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPurchaseOrderReturns.fulfilled, (state, action) => {
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
      .addCase(fetchPurchaseOrderReturns.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch purchase order returns';
        state.list = [];
      })
      .addCase(fetchPurchaseOrderReturnById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchPurchaseOrderReturnById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentPurchaseOrderReturn = action.payload ?? null;
      })
      .addCase(fetchPurchaseOrderReturnById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError =
          action.payload || action.error.message || 'Failed to fetch purchase order return';
      })
      .addCase(updatePurchaseOrderReturn.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updatePurchaseOrderReturn.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { purchaseOrderReturnId, response } = action.payload;
        const patch =
          response && typeof response === 'object' && !Array.isArray(response) ? response : {};
        if (state.currentPurchaseOrderReturn) {
          const cid =
            state.currentPurchaseOrderReturn._id ??
            state.currentPurchaseOrderReturn.id ??
            '';
          if (String(cid) === String(purchaseOrderReturnId)) {
            state.currentPurchaseOrderReturn = { ...state.currentPurchaseOrderReturn, ...patch };
          }
        }
        const idx = state.list.findIndex(
          (item) => String(item._id ?? item.id ?? '') === String(purchaseOrderReturnId)
        );
        if (idx !== -1) {
          state.list[idx] = { ...state.list[idx], ...patch };
        }
      })
      .addCase(updatePurchaseOrderReturn.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError =
          action.payload || action.error.message || 'Failed to update purchase order return';
      })
      .addCase(fetchPurchaseOrderReturnByPurchaseItem.pending, (state) => {
        state.byPurchaseItemStatus = 'loading';
        state.byPurchaseItemError = null;
      })
      .addCase(fetchPurchaseOrderReturnByPurchaseItem.fulfilled, (state, action) => {
        state.byPurchaseItemStatus = 'succeeded';
        state.purchaseOrderReturnByItem = action.payload ?? null;
        state.purchaseItemIdQueried = action.meta.arg != null ? String(action.meta.arg).trim() : null;
      })
      .addCase(fetchPurchaseOrderReturnByPurchaseItem.rejected, (state, action) => {
        state.byPurchaseItemStatus = 'failed';
        state.byPurchaseItemError =
          action.payload || action.error.message || 'Failed to load purchase order return';
        state.purchaseOrderReturnByItem = null;
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
  setFilterPurchaseReturnItemId,
  clearPurchaseOrderReturnByItem,
  clearCurrentPurchaseOrderReturn,
  clearUpdateStatus,
} = purchaseOrderReturnsSlice.actions;
export default purchaseOrderReturnsSlice.reducer;
