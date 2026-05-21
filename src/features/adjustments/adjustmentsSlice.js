import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchAdjustmentsRequest, createAdjustmentRequest } from './adjustmentsAPI.js';

export const fetchAdjustments = createAsyncThunk(
  'adjustments/fetchAdjustments',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const stateToken = getState()?.user?.token;
      return await fetchAdjustmentsRequest({
        ...params,
        token: params.token || stateToken || undefined,
      });
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch adjustments');
    }
  }
);

export const createAdjustment = createAsyncThunk(
  'adjustments/createAdjustment',
  async (arg, { rejectWithValue }) => {
    const safe = arg || {};
    const { adjustmentFields } = safe;
    try {
      const payload = adjustmentFields !== undefined ? { ...adjustmentFields } : { ...safe };
      return await createAdjustmentRequest(payload);
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to create adjustment';
      console.error('[Adjustment module] createAdjustment thunk error', { message, error });
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

const adjustmentsSlice = createSlice({
  name: 'adjustments',
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
      .addCase(fetchAdjustments.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchAdjustments.fulfilled, (state, action) => {
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
      .addCase(fetchAdjustments.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || action.error.message || 'Failed to fetch adjustments';
        state.list = [];
      })
      .addCase(createAdjustment.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createAdjustment.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        state.lastCreated = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(createAdjustment.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload || action.error.message || 'Failed to create adjustment';
      });
  },
});

export const { clearCreateStatus, clearLastCreated, setSearch, setPage, setLimit, setSort } =
  adjustmentsSlice.actions;
export default adjustmentsSlice.reducer;
