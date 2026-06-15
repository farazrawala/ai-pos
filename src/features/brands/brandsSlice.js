import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchBrandsRequest,
  fetchBrandByIdRequest,
  createBrandRequest,
  updateBrandRequest,
  deleteBrandRequest,
} from './brandsAPI.js';

export const fetchBrands = createAsyncThunk(
  'brands/fetchBrands',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchBrandsRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch brands');
    }
  }
);

export const fetchBrandById = createAsyncThunk(
  'brands/fetchBrandById',
  async (brandId, { rejectWithValue }) => {
    try {
      return await fetchBrandByIdRequest(brandId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch brand');
    }
  }
);

export const createBrand = createAsyncThunk(
  'brands/createBrand',
  async (brandData, { rejectWithValue }) => {
    try {
      return await createBrandRequest(brandData);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create brand');
    }
  }
);

export const updateBrand = createAsyncThunk(
  'brands/updateBrand',
  async ({ brandId, brandData }, { rejectWithValue }) => {
    try {
      const response = await updateBrandRequest(brandId, brandData);
      return { brandId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update brand');
    }
  }
);

export const deleteBrand = createAsyncThunk(
  'brands/deleteBrand',
  async (brandId, { rejectWithValue }) => {
    try {
      const response = await deleteBrandRequest(brandId);
      return { brandId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete brand');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentBrand: null,
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

const brandsSlice = createSlice({
  name: 'brands',
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
    clearCurrentBrand: (state) => {
      state.currentBrand = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrands.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch brands';
        state.list = [];
      })
      .addCase(fetchBrandById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchBrandById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentBrand = action.payload.data || action.payload;
      })
      .addCase(fetchBrandById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch brand';
        state.currentBrand = null;
      })
      .addCase(updateBrand.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateBrand.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const brandId = action.payload.brandId;
        const index = state.list.findIndex(
          (item) => String(item._id || item.id || item.brand_id) === String(brandId)
        );
        if (index !== -1) {
          state.list[index] = {
            ...state.list[index],
            ...(action.payload.response.data || action.payload.response),
          };
        }
      })
      .addCase(updateBrand.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update brand';
      })
      .addCase(deleteBrand.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteBrand.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.list = state.list.filter(
          (item) =>
            String(item._id || item.id || item.brand_id) !== String(action.payload.brandId)
        );
        if (state.pagination.total > 0) state.pagination.total -= 1;
      })
      .addCase(deleteBrand.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete brand';
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
  clearCurrentBrand,
} = brandsSlice.actions;

export default brandsSlice.reducer;
