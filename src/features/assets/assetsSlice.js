import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  saveAssetRequest,
  fetchAssetsRequest,
  fetchAssetByIdRequest,
  updateAssetRequest,
} from './assetsAPI.js';

export const fetchAssets = createAsyncThunk(
  'assets/fetchAssets',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const stateToken = getState()?.user?.token;
      return await fetchAssetsRequest({
        ...params,
        token: params.token || stateToken || undefined,
      });
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch assets');
    }
  }
);

export const fetchAssetById = createAsyncThunk(
  'assets/fetchAssetById',
  async (assetId, { rejectWithValue }) => {
    try {
      return await fetchAssetByIdRequest(assetId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch asset');
    }
  }
);

export const createAsset = createAsyncThunk(
  'assets/createAsset',
  async (arg, { rejectWithValue }) => {
    const safe = arg || {};
    const { assetFields } = safe;
    try {
      const payload = assetFields !== undefined ? { ...assetFields } : { ...safe };
      const response = await saveAssetRequest(payload);
      return response;
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to create asset';
      console.error('[Asset module] createAsset thunk error', { message, error });
      return rejectWithValue(message);
    }
  }
);

export const updateAsset = createAsyncThunk(
  'assets/updateAsset',
  async ({ assetId, assetFields }, { rejectWithValue }) => {
    try {
      const response = await updateAssetRequest(assetId, assetFields ?? {});
      return { assetId, response };
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to update asset';
      console.error('[Asset module] updateAsset thunk error', { message, assetId, error });
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
  currentAsset: null,
  fetchStatus: 'idle',
  fetchError: null,
  createStatus: 'idle',
  createError: null,
  lastCreated: null,
  updateStatus: 'idle',
  updateError: null,
};

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    clearCreateStatus: (state) => {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearLastCreated: (state) => {
      state.lastCreated = null;
    },
    clearCurrentAsset: (state) => {
      state.currentAsset = null;
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
      .addCase(fetchAssets.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchAssets.fulfilled, (state, action) => {
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
      .addCase(fetchAssets.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || action.error.message || 'Failed to fetch assets';
        state.list = [];
      })
      .addCase(fetchAssetById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchAssetById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentAsset = action.payload;
        state.fetchError = null;
      })
      .addCase(fetchAssetById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch asset';
        state.currentAsset = null;
      })
      .addCase(createAsset.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createAsset.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        state.lastCreated = action.payload?.data ?? action.payload ?? null;
      })
      .addCase(createAsset.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload || action.error.message || 'Failed to create asset';
      })
      .addCase(updateAsset.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateAsset.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const assetId = action.payload.assetId;
        const index = state.list.findIndex(
          (item) => (item._id || item.id) === assetId
        );
        if (index !== -1) {
          const updated = action.payload.response?.data ?? action.payload.response;
          if (updated && typeof updated === 'object') {
            state.list[index] = { ...state.list[index], ...updated };
          }
        }
      })
      .addCase(updateAsset.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update asset';
      });
  },
});

export const {
  clearCreateStatus,
  clearLastCreated,
  clearCurrentAsset,
  clearUpdateStatus,
  setSearch,
  setPage,
  setLimit,
  setSort,
} = assetsSlice.actions;
export default assetsSlice.reducer;
