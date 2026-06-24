import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchSalesReturnByOrderItemRequest,
  fetchSalesReturnsListRequest,
  fetchSalesReturnByIdRequest,
  createSalesReturnRequest,
  updateSalesReturnRequest,
  deleteSalesReturnRequest,
  unwrapSalesReturnRecord,
} from './salesReturnsAPI.js';

/** Paginated list from `sales_return/get-all-active` */
export const fetchSalesReturns = createAsyncThunk(
  'salesReturns/fetchSalesReturns',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchSalesReturnsListRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sales returns');
    }
  }
);

export const fetchSalesReturnById = createAsyncThunk(
  'salesReturns/fetchSalesReturnById',
  async (salesReturnId, { rejectWithValue }) => {
    try {
      const raw = await fetchSalesReturnByIdRequest(salesReturnId);
      return unwrapSalesReturnRecord(raw) ?? raw;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sales return');
    }
  }
);

export const createSalesReturn = createAsyncThunk(
  'salesReturns/createSalesReturn',
  async (payload = {}, { rejectWithValue }) => {
    try {
      const raw = await createSalesReturnRequest(payload);
      return unwrapSalesReturnRecord(raw) ?? raw;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create sales return');
    }
  }
);

export const updateSalesReturn = createAsyncThunk(
  'salesReturns/updateSalesReturn',
  async ({ salesReturnId, salesReturnData }, { rejectWithValue }) => {
    try {
      const raw = await updateSalesReturnRequest(salesReturnId, salesReturnData);
      const response = unwrapSalesReturnRecord(raw) ?? raw;
      return { salesReturnId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update sales return');
    }
  }
);

export const deleteSalesReturn = createAsyncThunk(
  'salesReturns/deleteSalesReturn',
  async (salesReturnId, { rejectWithValue }) => {
    try {
      const response = await deleteSalesReturnRequest(salesReturnId);
      return { salesReturnId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete sales return');
    }
  }
);

export const fetchSalesReturnByOrderItem = createAsyncThunk(
  'salesReturns/fetchSalesReturnByOrderItem',
  async (orderItemId, { rejectWithValue }) => {
    try {
      return await fetchSalesReturnByOrderItemRequest(orderItemId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load sales return');
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
  filters: {
    startDate: '',
    endDate: '',
  },
  sort: {
    sortBy: null,
    sortOrder: 'asc',
  },
  filterSalesReturnItemId: '',

  currentSalesReturn: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,

  byOrderItemStatus: 'idle',
  byOrderItemError: null,
  salesReturnByItem: null,
  orderItemIdQueried: null,
};

const salesReturnsSlice = createSlice({
  name: 'salesReturns',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.page = 1;
    },
    setDateFilters: (state, action) => {
      state.filters.startDate = action.payload?.startDate || '';
      state.filters.endDate = action.payload?.endDate || '';
      state.pagination.page = 1;
    },
    clearDateFilters: (state) => {
      state.filters.startDate = '';
      state.filters.endDate = '';
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
    setFilterSalesReturnItemId: (state, action) => {
      state.filterSalesReturnItemId = action.payload != null ? String(action.payload) : '';
      state.pagination.page = 1;
    },
    clearSalesReturnByItem: (state) => {
      state.byOrderItemStatus = 'idle';
      state.byOrderItemError = null;
      state.salesReturnByItem = null;
      state.orderItemIdQueried = null;
    },
    clearCurrentSalesReturn: (state) => {
      state.currentSalesReturn = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSalesReturns.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSalesReturns.fulfilled, (state, action) => {
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
      .addCase(fetchSalesReturns.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch sales returns';
        state.list = [];
      })
      .addCase(fetchSalesReturnById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchSalesReturnById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentSalesReturn = action.payload ?? null;
      })
      .addCase(fetchSalesReturnById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError =
          action.payload || action.error.message || 'Failed to fetch sales return';
      })
      .addCase(updateSalesReturn.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateSalesReturn.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { salesReturnId, response } = action.payload;
        const patch =
          response && typeof response === 'object' && !Array.isArray(response) ? response : {};
        if (state.currentSalesReturn) {
          const cid =
            state.currentSalesReturn._id ??
            state.currentSalesReturn.id ??
            '';
          if (String(cid) === String(salesReturnId)) {
            state.currentSalesReturn = { ...state.currentSalesReturn, ...patch };
          }
        }
        const idx = state.list.findIndex(
          (item) => String(item._id ?? item.id ?? '') === String(salesReturnId)
        );
        if (idx !== -1) {
          state.list[idx] = { ...state.list[idx], ...patch };
        }
      })
      .addCase(updateSalesReturn.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError =
          action.payload || action.error.message || 'Failed to update sales return';
      })
      .addCase(deleteSalesReturn.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteSalesReturn.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const deletedId = String(action.payload.salesReturnId ?? '');
        state.list = state.list.filter(
          (item) => String(item._id ?? item.id ?? '') !== deletedId
        );
        if (state.pagination.total > 0) {
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteSalesReturn.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError =
          action.payload || action.error.message || 'Failed to delete sales return';
      })
      .addCase(fetchSalesReturnByOrderItem.pending, (state) => {
        state.byOrderItemStatus = 'loading';
        state.byOrderItemError = null;
      })
      .addCase(fetchSalesReturnByOrderItem.fulfilled, (state, action) => {
        state.byOrderItemStatus = 'succeeded';
        state.salesReturnByItem = action.payload ?? null;
        state.orderItemIdQueried = action.meta.arg != null ? String(action.meta.arg).trim() : null;
      })
      .addCase(fetchSalesReturnByOrderItem.rejected, (state, action) => {
        state.byOrderItemStatus = 'failed';
        state.byOrderItemError =
          action.payload || action.error.message || 'Failed to load sales return';
        state.salesReturnByItem = null;
        state.orderItemIdQueried = null;
      });
  },
});

export const {
  clearError,
  setSearch,
  setDateFilters,
  clearDateFilters,
  setPage,
  setLimit,
  setSort,
  setFilterSalesReturnItemId,
  clearSalesReturnByItem,
  clearCurrentSalesReturn,
  clearUpdateStatus,
  clearDeleteStatus,
} = salesReturnsSlice.actions;
export default salesReturnsSlice.reducer;
