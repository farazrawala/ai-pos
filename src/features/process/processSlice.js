import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchProcessesRequest } from './processAPI.js';

export const fetchProcesses = createAsyncThunk(
  'process/fetchProcesses',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchProcessesRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch processes');
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

const processSlice = createSlice({
  name: 'process',
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
      .addCase(fetchProcesses.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProcesses.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchProcesses.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch processes';
        state.list = [];
      });
  },
});

export const { setSearch, setPage, setLimit, setSort } = processSlice.actions;

export default processSlice.reducer;
