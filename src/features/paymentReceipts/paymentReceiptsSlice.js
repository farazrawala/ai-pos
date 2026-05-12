import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchPaymentReceiptsRequest,
  fetchPaymentReceiptByIdRequest,
  updatePaymentReceiptRequest,
} from './paymentReceiptsAPI.js';

export const fetchPaymentReceipts = createAsyncThunk(
  'paymentReceipts/fetchPaymentReceipts',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchPaymentReceiptsRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch payment receipts');
    }
  }
);

export const fetchPaymentReceiptById = createAsyncThunk(
  'paymentReceipts/fetchPaymentReceiptById',
  async (receiptId, { rejectWithValue }) => {
    try {
      return await fetchPaymentReceiptByIdRequest(receiptId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch payment receipt');
    }
  }
);

export const updatePaymentReceipt = createAsyncThunk(
  'paymentReceipts/updatePaymentReceipt',
  async ({ receiptId, payload }, { rejectWithValue }) => {
    try {
      const response = await updatePaymentReceiptRequest(receiptId, payload);
      return { receiptId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update payment receipt');
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
  currentReceipt: null,
  receiptFetchStatus: 'idle',
  receiptFetchError: null,
  receiptUpdateStatus: 'idle',
  receiptUpdateError: null,
};

const paymentReceiptsSlice = createSlice({
  name: 'paymentReceipts',
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
    clearCurrentReceipt: (state) => {
      state.currentReceipt = null;
      state.receiptFetchStatus = 'idle';
      state.receiptFetchError = null;
    },
    clearReceiptUpdateStatus: (state) => {
      state.receiptUpdateStatus = 'idle';
      state.receiptUpdateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentReceipts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPaymentReceipts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
        state.error = null;
      })
      .addCase(fetchPaymentReceipts.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error.message || 'Failed to fetch payment receipts';
        state.list = [];
      })
      .addCase(fetchPaymentReceiptById.pending, (state) => {
        state.receiptFetchStatus = 'loading';
        state.receiptFetchError = null;
      })
      .addCase(fetchPaymentReceiptById.fulfilled, (state, action) => {
        state.receiptFetchStatus = 'succeeded';
        state.currentReceipt = action.payload;
        state.receiptFetchError = null;
      })
      .addCase(fetchPaymentReceiptById.rejected, (state, action) => {
        state.receiptFetchStatus = 'failed';
        state.receiptFetchError =
          action.payload || action.error.message || 'Failed to fetch payment receipt';
        state.currentReceipt = null;
      })
      .addCase(updatePaymentReceipt.pending, (state) => {
        state.receiptUpdateStatus = 'loading';
        state.receiptUpdateError = null;
      })
      .addCase(updatePaymentReceipt.fulfilled, (state, action) => {
        state.receiptUpdateStatus = 'succeeded';
        state.receiptUpdateError = null;
        const rid = action.payload.receiptId;
        const body = action.payload.response?.data ?? action.payload.response;
        const idx = state.list.findIndex((row) => String(row._id ?? row.id) === String(rid));
        if (idx !== -1 && body && typeof body === 'object') {
          state.list[idx] = { ...state.list[idx], ...body };
        }
      })
      .addCase(updatePaymentReceipt.rejected, (state, action) => {
        state.receiptUpdateStatus = 'failed';
        state.receiptUpdateError =
          action.payload || action.error.message || 'Failed to update payment receipt';
      });
  },
});

export const {
  clearError,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearCurrentReceipt,
  clearReceiptUpdateStatus,
} = paymentReceiptsSlice.actions;
export default paymentReceiptsSlice.reducer;
