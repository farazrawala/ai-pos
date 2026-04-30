import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchStockMovementsRequest } from './stockMovementAPI.js';

export const fetchStockMovements = createAsyncThunk(
  'stockMovement/fetchStockMovements',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchStockMovementsRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch stock movements');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  search: '',
  sort: { sortBy: null, sortOrder: 'asc' },
};

const stockMovementSlice = createSlice({
  name: 'stockMovement',
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStockMovements.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchStockMovements.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchStockMovements.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch stock movements';
        state.list = [];
      });
  },
});

export const { setSearch, setPage, setLimit, setSort } = stockMovementSlice.actions;
export default stockMovementSlice.reducer;
