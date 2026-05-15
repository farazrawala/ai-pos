import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { createExpenseRequest, fetchExpensesRequest } from './expensesAPI.js';

export const fetchExpenses = createAsyncThunk(
  'expenses/fetchExpenses',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchExpensesRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch expenses');
    }
  }
);

export const createExpense = createAsyncThunk(
  'expenses/createExpense',
  async (expenseData, { rejectWithValue }) => {
    try {
      const response = await createExpenseRequest(expenseData);
      return response;
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to create expense';
      console.error('[Expense module] createExpense thunk error', {
        message,
        errorName: error?.name,
        stack: error?.stack,
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
  createStatus: 'idle',
  createError: null,
  lastCreated: null,
};

const expensesSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    clearCreateStatus: (state) => {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearLastCreated: (state) => {
      state.lastCreated = null;
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
      .addCase(fetchExpenses.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
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
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || action.error.message || 'Failed to fetch expenses';
        state.list = [];
      })
      .addCase(createExpense.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createExpense.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        state.lastCreated = action.payload;
      })
      .addCase(createExpense.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload || action.error.message || 'Failed to create expense';
      });
  },
});

export const { clearCreateStatus, clearLastCreated, setSearch, setPage, setLimit, setSort } =
  expensesSlice.actions;
export default expensesSlice.reducer;
