import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchOrdersRequest,
  fetchDeletedOrdersRequest,
  deleteOrderRequest,
  pickOrderDocumentId,
} from './ordersAPI.js';

export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchOrdersRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch orders');
    }
  }
);

export const fetchDeletedOrders = createAsyncThunk(
  'orders/fetchDeletedOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchDeletedOrdersRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch deleted orders');
    }
  }
);

export const deleteOrder = createAsyncThunk(
  'orders/deleteOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await deleteOrderRequest(orderId);
      return { orderId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete order');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  search: '',
  filters: {
    startDate: '',
    endDate: '',
  },
  sort: { sortBy: null, sortOrder: 'asc' },
  deleteStatus: 'idle',
  deleteError: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
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
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
  },
  extraReducers: (builder) => {
    const applyListFulfilled = (state, action) => {
      state.status = 'succeeded';
      state.list = action.payload.data || [];
      state.pagination = {
        page: action.payload.page || state.pagination.page,
        limit: action.payload.limit || state.pagination.limit,
        total: action.payload.total || 0,
        totalPages: action.payload.totalPages || 0,
      };
    };

    builder
      .addCase(fetchOrders.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, applyListFulfilled)
      .addCase(fetchOrders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch orders';
        state.list = [];
      })
      .addCase(fetchDeletedOrders.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchDeletedOrders.fulfilled, applyListFulfilled)
      .addCase(fetchDeletedOrders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch deleted orders';
        state.list = [];
      })
      .addCase(deleteOrder.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteOrder.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const deletedId = String(action.payload.orderId ?? '');
        state.list = state.list.filter(
          (item) => pickOrderDocumentId(item) !== deletedId
        );
        if (state.pagination.total > 0) {
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteOrder.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete order';
      });
  },
});

export const { setSearch, setDateFilters, clearDateFilters, setPage, setLimit, setSort, clearDeleteStatus } =
  ordersSlice.actions;
export default ordersSlice.reducer;
