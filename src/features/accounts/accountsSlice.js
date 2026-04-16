import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchAccountsRequest,
  fetchAccountByIdRequest,
  updateAccountRequest,
  deleteAccountRequest,
} from './accountsAPI.js';

export const fetchAccounts = createAsyncThunk(
  'accounts/fetchAccounts',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchAccountsRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch accounts');
    }
  }
);

export const fetchAccountById = createAsyncThunk(
  'accounts/fetchAccountById',
  async (accountId, { rejectWithValue }) => {
    try {
      return await fetchAccountByIdRequest(accountId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch account');
    }
  }
);

export const updateAccount = createAsyncThunk(
  'accounts/updateAccount',
  async ({ accountId, accountData }, { rejectWithValue }) => {
    try {
      const response = await updateAccountRequest(accountId, accountData);
      return { accountId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update account');
    }
  }
);

export const deleteAccount = createAsyncThunk(
  'accounts/deleteAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      const response = await deleteAccountRequest(accountId);
      return { accountId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete account');
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
  currentAccount: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,
};

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
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
    clearCurrentAccount: (state) => {
      state.currentAccount = null;
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
      .addCase(fetchAccounts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch accounts';
        state.list = [];
      })
      .addCase(fetchAccountById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchAccountById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentAccount = action.payload;
        state.fetchError = null;
      })
      .addCase(fetchAccountById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch account';
        state.currentAccount = null;
      })
      .addCase(updateAccount.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const accountId = action.payload.accountId;
        const index = state.list.findIndex((item) => String(item._id || item.id) === String(accountId));
        if (index !== -1 && action.payload.response) {
          state.list[index] = { ...state.list[index], ...action.payload.response };
        }
      })
      .addCase(updateAccount.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update account';
      })
      .addCase(deleteAccount.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteAccount.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.list = state.list.filter(
          (item) => String(item._id || item.id) !== String(action.payload.accountId)
        );
        if (state.pagination.total > 0) state.pagination.total -= 1;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete account';
      });
  },
});

export const {
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearCurrentAccount,
  clearUpdateStatus,
  clearDeleteStatus,
} = accountsSlice.actions;
export default accountsSlice.reducer;
