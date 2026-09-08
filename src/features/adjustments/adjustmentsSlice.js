import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchAdjustmentsRequest,
  filterAdjustments,
  paginateAdjustments,
  saveAdjustmentRequest,
  sortAdjustments,
} from './adjustmentsAPI.js';

export const fetchAdjustments = createAsyncThunk(
  'adjustments/fetchAdjustments',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const stateToken = getState()?.user?.token;
      const token = params.token || stateToken || undefined;
      const pageSize = Number(params.limit) > 0 ? Number(params.limit) : 1000;
      const first = await fetchAdjustmentsRequest({
        ...params,
        token,
        skip: params.skip ?? 0,
        limit: pageSize,
      });
      const rows = Array.isArray(first.data) ? first.data : [];
      const total = Number(first.total) || rows.length;
      if (rows.length >= total) {
        return { ...first, data: rows };
      }
      const all = [...rows];
      let skip = rows.length;
      while (skip < total) {
        const next = await fetchAdjustmentsRequest({
          ...params,
          token,
          skip,
          limit: pageSize,
        });
        const chunk = Array.isArray(next.data) ? next.data : [];
        if (!chunk.length) break;
        all.push(...chunk);
        skip += chunk.length;
      }
      return { ...first, data: all, total: all.length };
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
      return await saveAdjustmentRequest(payload);
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to create adjustment';
      console.error('[Adjustment module] createAdjustment thunk error', { message, error });
      return rejectWithValue(message);
    }
  }
);

const applyListView = (state) => {
  const source = Array.isArray(state.listAll) ? state.listAll : [];
  const filtered = filterAdjustments(source, state.search);
  const sorted = sortAdjustments(filtered, state.sort.sortBy, state.sort.sortOrder);
  const paginated = paginateAdjustments(sorted, state.pagination.page, state.pagination.limit);
  state.list = paginated.data;
  state.pagination.total = paginated.total;
  state.pagination.totalPages = paginated.totalPages;
  state.pagination.page = paginated.page;
  state.pagination.limit = paginated.limit;
};

const initialState = {
  listStatus: 'idle',
  list: [],
  listAll: [],
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
      applyListView(state);
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
      applyListView(state);
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
      applyListView(state);
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
      applyListView(state);
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
        state.listAll = action.payload.data || [];
        state.listError = null;
        applyListView(state);
      })
      .addCase(fetchAdjustments.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || action.error.message || 'Failed to fetch adjustments';
        state.list = [];
        state.listAll = [];
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
