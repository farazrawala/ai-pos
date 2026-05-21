import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchAmountTransfersRequest,
  fetchAmountTransferByIdRequest,
  saveAmountTransferRequest,
  updateAmountTransferRequest,
} from './amountTransfersAPI.js';

export const fetchAmountTransfers = createAsyncThunk(
  'amountTransfers/fetchAmountTransfers',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const stateToken = getState()?.user?.token;
      return await fetchAmountTransfersRequest({
        ...params,
        token: params.token || stateToken || undefined,
      });
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch amount transfers');
    }
  }
);

export const fetchAmountTransferById = createAsyncThunk(
  'amountTransfers/fetchAmountTransferById',
  async (transferId, { rejectWithValue }) => {
    try {
      return await fetchAmountTransferByIdRequest(transferId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch amount transfer');
    }
  }
);

export const createAmountTransfer = createAsyncThunk(
  'amountTransfers/createAmountTransfer',
  async (arg, { rejectWithValue }) => {
    const safe = arg || {};
    const { transferFields } = safe;
    try {
      const payload = transferFields !== undefined ? { ...transferFields } : { ...safe };
      return await saveAmountTransferRequest(payload);
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to create amount transfer';
      console.error('[Amount transfer module] createAmountTransfer thunk error', { message, error });
      return rejectWithValue(message);
    }
  }
);

export const updateAmountTransfer = createAsyncThunk(
  'amountTransfers/updateAmountTransfer',
  async ({ transferId, transferFields }, { rejectWithValue }) => {
    try {
      const response = await updateAmountTransferRequest(transferId, transferFields ?? {});
      return { transferId, response };
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to update amount transfer';
      console.error('[Amount transfer module] updateAmountTransfer thunk error', {
        message,
        transferId,
        error,
      });
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  listStatus: 'idle',
  list: [],
  listError: null,
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
  currentTransfer: null,
  fetchStatus: 'idle',
  fetchError: null,
  createStatus: 'idle',
  createError: null,
  updateStatus: 'idle',
  updateError: null,
};

const amountTransfersSlice = createSlice({
  name: 'amountTransfers',
  initialState,
  reducers: {
    clearCurrentTransfer: (state) => {
      state.currentTransfer = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearCreateStatus: (state) => {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAmountTransfers.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchAmountTransfers.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
        state.listError = null;
      })
      .addCase(fetchAmountTransfers.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError =
          action.payload || action.error.message || 'Failed to fetch amount transfers';
        state.list = [];
      })
      .addCase(fetchAmountTransferById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchAmountTransferById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentTransfer = action.payload;
        state.fetchError = null;
      })
      .addCase(fetchAmountTransferById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError =
          action.payload || action.error.message || 'Failed to fetch amount transfer';
        state.currentTransfer = null;
      })
      .addCase(createAmountTransfer.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createAmountTransfer.fulfilled, (state) => {
        state.createStatus = 'succeeded';
        state.createError = null;
      })
      .addCase(createAmountTransfer.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError =
          action.payload || action.error.message || 'Failed to create amount transfer';
      })
      .addCase(updateAmountTransfer.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateAmountTransfer.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const transferId = action.payload.transferId;
        const index = state.list.findIndex(
          (item) => (item._id || item.id) === transferId
        );
        if (index !== -1 && action.payload.response?.data) {
          state.list[index] = { ...state.list[index], ...action.payload.response.data };
        }
      })
      .addCase(updateAmountTransfer.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError =
          action.payload || action.error.message || 'Failed to update amount transfer';
      });
  },
});

export const {
  clearCurrentTransfer,
  clearCreateStatus,
  clearUpdateStatus,
  setSearch,
  setPage,
  setLimit,
  setSort,
} = amountTransfersSlice.actions;

export default amountTransfersSlice.reducer;
