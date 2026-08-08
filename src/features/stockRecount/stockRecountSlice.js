import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchStockRecountsRequest,
  filterSessions,
  groupRecountsBySession,
  paginateSessions,
  sortSessions,
} from './stockRecountAPI.js';

export const fetchStockRecounts = createAsyncThunk(
  'stockRecount/fetchStockRecounts',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const stateToken = getState()?.user?.token;
      return await fetchStockRecountsRequest({
        ...params,
        token: params.token || stateToken || undefined,
      });
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch stock recounts');
    }
  }
);

const applySessionView = (state) => {
  const filtered = filterSessions(state.sessionsAll, state.search);
  const sorted = sortSessions(filtered, state.sort.sortBy, state.sort.sortOrder);
  const paginated = paginateSessions(sorted, state.pagination.page, state.pagination.limit);
  state.list = paginated.data;
  state.pagination.total = paginated.total;
  state.pagination.totalPages = paginated.totalPages;
  state.pagination.page = paginated.page;
  state.pagination.limit = paginated.limit;
};

const initialState = {
  listStatus: 'idle',
  list: [],
  rawList: [],
  sessionsAll: [],
  listError: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  search: '',
  warehouseId: '',
  sort: { sortBy: 'createdAt', sortOrder: 'desc' },
};

const stockRecountSlice = createSlice({
  name: 'stockRecount',
  initialState,
  reducers: {
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.page = 1;
      applySessionView(state);
    },
    setWarehouseId: (state, action) => {
      state.warehouseId = String(action.payload || '').trim();
      state.pagination.page = 1;
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
      applySessionView(state);
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
      applySessionView(state);
    },
    setSort: (state, action) => {
      const { sortBy, sortOrder } = action.payload;
      if (sortBy === null) {
        state.sort.sortBy = 'createdAt';
        state.sort.sortOrder = 'desc';
      } else if (state.sort.sortBy === sortBy) {
        state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.sortBy = sortBy;
        state.sort.sortOrder = sortOrder || 'asc';
      }
      state.pagination.page = 1;
      applySessionView(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStockRecounts.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchStockRecounts.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.rawList = action.payload.data || [];
        state.sessionsAll = groupRecountsBySession(state.rawList);
        applySessionView(state);
      })
      .addCase(fetchStockRecounts.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || action.error.message || 'Failed to fetch stock recounts';
        state.list = [];
        state.rawList = [];
        state.sessionsAll = [];
      });
  },
});

export const { setSearch, setWarehouseId, setPage, setLimit, setSort } = stockRecountSlice.actions;
export default stockRecountSlice.reducer;
