import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchWarehousesRequest,
  fetchWarehouseByIdRequest,
  createWarehouseRequest,
  updateWarehouseRequest,
  deleteWarehouseRequest,
} from './warehouseAPI.js';

export const fetchWarehouses = createAsyncThunk(
  'warehouse/fetchWarehouses',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchWarehousesRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch warehouses');
    }
  }
);

export const fetchWarehouseById = createAsyncThunk(
  'warehouse/fetchWarehouseById',
  async (warehouseId, { rejectWithValue }) => {
    try {
      return await fetchWarehouseByIdRequest(warehouseId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch warehouse');
    }
  }
);

export const createWarehouse = createAsyncThunk(
  'warehouse/createWarehouse',
  async (warehouseData, { rejectWithValue }) => {
    try {
      return await createWarehouseRequest(warehouseData);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create warehouse');
    }
  }
);

export const updateWarehouse = createAsyncThunk(
  'warehouse/updateWarehouse',
  async ({ warehouseId, warehouseData }, { rejectWithValue }) => {
    try {
      const response = await updateWarehouseRequest(warehouseId, warehouseData);
      return { warehouseId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update warehouse');
    }
  }
);

export const deleteWarehouse = createAsyncThunk(
  'warehouse/deleteWarehouse',
  async (warehouseId, { rejectWithValue }) => {
    try {
      const response = await deleteWarehouseRequest(warehouseId);
      return { warehouseId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete warehouse');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentWarehouse: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  search: '',
  sort: { sortBy: null, sortOrder: 'asc' },
};

const warehouseSlice = createSlice({
  name: 'warehouse',
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
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
    clearCurrentWarehouse: (state) => {
      state.currentWarehouse = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWarehouses.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchWarehouses.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchWarehouses.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch warehouses';
        state.list = [];
      })
      .addCase(fetchWarehouseById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchWarehouseById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentWarehouse = action.payload.data || action.payload;
      })
      .addCase(fetchWarehouseById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch warehouse';
      })
      .addCase(updateWarehouse.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateWarehouse.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const warehouseId = action.payload.warehouseId;
        const index = state.list.findIndex(
          (item) => String(item._id || item.id || item.warehouse_id) === String(warehouseId)
        );
        if (index !== -1) {
          state.list[index] = { ...state.list[index], ...(action.payload.response.data || action.payload.response) };
        }
      })
      .addCase(updateWarehouse.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update warehouse';
      })
      .addCase(deleteWarehouse.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteWarehouse.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.list = state.list.filter(
          (item) =>
            String(item._id || item.id || item.warehouse_id) !== String(action.payload.warehouseId)
        );
        if (state.pagination.total > 0) state.pagination.total -= 1;
      })
      .addCase(deleteWarehouse.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete warehouse';
      });
  },
});

export const {
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
  clearUpdateStatus,
  clearCurrentWarehouse,
} = warehouseSlice.actions;

export default warehouseSlice.reducer;
