import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchWarehouseInventoryRequest,
  groupInventoryByProduct,
  paginateGroupedProducts,
  sortGroupedProducts,
} from './warehouseInventoryAPI.js';

export const fetchWarehouseInventory = createAsyncThunk(
  'warehouseInventory/fetchWarehouseInventory',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchWarehouseInventoryRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch warehouse inventory');
    }
  }
);

const applyGroupedView = (state) => {
  const sorted = sortGroupedProducts(
    state.groupedAll,
    state.sort.sortBy,
    state.sort.sortOrder
  );
  const paginated = paginateGroupedProducts(
    sorted,
    state.pagination.page,
    state.pagination.limit
  );
  state.list = paginated.data;
  state.pagination.total = paginated.total;
  state.pagination.totalPages = paginated.totalPages;
  state.pagination.page = paginated.page;
  state.pagination.limit = paginated.limit;
};

const initialState = {
  status: 'idle',
  list: [],
  rawList: [],
  groupedAll: [],
  error: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  search: '',
  sort: { sortBy: 'product_name', sortOrder: 'asc' },
};

const warehouseInventorySlice = createSlice({
  name: 'warehouseInventory',
  initialState,
  reducers: {
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.page = 1;
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
      applyGroupedView(state);
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
      applyGroupedView(state);
    },
    setSort: (state, action) => {
      const { sortBy, sortOrder } = action.payload;
      if (sortBy === null) {
        state.sort.sortBy = 'product_name';
        state.sort.sortOrder = 'asc';
      } else if (state.sort.sortBy === sortBy) {
        state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.sortBy = sortBy;
        state.sort.sortOrder = sortOrder || 'asc';
      }
      state.pagination.page = 1;
      applyGroupedView(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWarehouseInventory.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchWarehouseInventory.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.rawList = action.payload.rawData || [];
        state.groupedAll = groupInventoryByProduct(state.rawList);
        applyGroupedView(state);
      })
      .addCase(fetchWarehouseInventory.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error.message || 'Failed to fetch warehouse inventory';
        state.list = [];
        state.rawList = [];
        state.groupedAll = [];
      });
  },
});

export const { setSearch, setPage, setLimit, setSort } = warehouseInventorySlice.actions;
export default warehouseInventorySlice.reducer;
