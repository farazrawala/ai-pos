import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createExpenseRequest,
  fetchExpenseByIdRequest,
  fetchExpensesRequest,
  saveExpenseRequest,
  updateExpenseRequest,
} from './expensesAPI.js';

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

export const fetchExpenseById = createAsyncThunk(
  'expenses/fetchExpenseById',
  async (expenseId, { rejectWithValue }) => {
    try {
      return await fetchExpenseByIdRequest(expenseId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch expense');
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
      console.error('[Expense module] createExpense thunk error', { message, error });
      return rejectWithValue(message);
    }
  }
);

export const saveExpense = createAsyncThunk(
  'expenses/saveExpense',
  async (arg, { rejectWithValue }) => {
    const safe = arg || {};
    const { expenseFields, image } = safe;
    try {
      const payload =
        expenseFields !== undefined
          ? { ...expenseFields, ...(image != null ? { image } : {}) }
          : { ...safe };
      return await saveExpenseRequest(payload);
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to save expense';
      console.error('[Expense module] saveExpense thunk error', { message, error });
      return rejectWithValue(message);
    }
  }
);

export const updateExpense = createAsyncThunk(
  'expenses/updateExpense',
  async ({ expenseId, expenseFields, image }, { rejectWithValue }) => {
    try {
      const payload = {
        ...expenseFields,
        ...(image != null ? { image } : {}),
      };
      const response = await updateExpenseRequest(expenseId, payload);
      return { expenseId, response };
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to update expense';
      console.error('[Expense module] updateExpense thunk error', { message, expenseId, error });
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
  currentExpense: null,
  fetchStatus: 'idle',
  fetchError: null,
  createStatus: 'idle',
  createError: null,
  lastCreated: null,
  updateStatus: 'idle',
  updateError: null,
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
    clearCurrentExpense: (state) => {
      state.currentExpense = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
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
      .addCase(fetchExpenseById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchExpenseById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentExpense = action.payload;
        state.fetchError = null;
      })
      .addCase(fetchExpenseById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch expense';
        state.currentExpense = null;
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
      })
      .addCase(saveExpense.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(saveExpense.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        state.lastCreated = action.payload;
      })
      .addCase(saveExpense.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload || action.error.message || 'Failed to save expense';
      })
      .addCase(updateExpense.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateExpense.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const expenseId = action.payload.expenseId;
        const index = state.list.findIndex(
          (item) => (item._id || item.id) === expenseId
        );
        const updated =
          action.payload.response?.data || action.payload.response?.expense || action.payload.response;
        if (index !== -1 && updated && typeof updated === 'object') {
          state.list[index] = { ...state.list[index], ...updated };
        }
      })
      .addCase(updateExpense.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update expense';
      });
  },
});

export const {
  clearCreateStatus,
  clearLastCreated,
  clearCurrentExpense,
  clearUpdateStatus,
  setSearch,
  setPage,
  setLimit,
  setSort,
} = expensesSlice.actions;
export default expensesSlice.reducer;
