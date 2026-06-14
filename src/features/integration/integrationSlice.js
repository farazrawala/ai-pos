import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchIntegrationsRequest,
  fetchIntegrationByIdRequest,
  createIntegrationRequest,
  updateIntegrationRequest,
  deleteIntegrationRequest,
} from './integrationAPI.js';

export const fetchIntegrations = createAsyncThunk(
  'integration/fetchIntegrations',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchIntegrationsRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch integrations');
    }
  }
);

export const fetchIntegrationById = createAsyncThunk(
  'integration/fetchIntegrationById',
  async (integrationId, { rejectWithValue }) => {
    try {
      return await fetchIntegrationByIdRequest(integrationId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch integration');
    }
  }
);

export const createIntegration = createAsyncThunk(
  'integration/createIntegration',
  async (integrationData, { rejectWithValue }) => {
    try {
      return await createIntegrationRequest(integrationData);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create integration');
    }
  }
);

export const updateIntegration = createAsyncThunk(
  'integration/updateIntegration',
  async ({ integrationId, integrationData }, { rejectWithValue }) => {
    try {
      const response = await updateIntegrationRequest(integrationId, integrationData);
      return { integrationId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update integration');
    }
  }
);

export const deleteIntegration = createAsyncThunk(
  'integration/deleteIntegration',
  async (integrationId, { rejectWithValue }) => {
    try {
      const response = await deleteIntegrationRequest(integrationId);
      return { integrationId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete integration');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentIntegration: null,
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

const integrationSlice = createSlice({
  name: 'integration',
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
    clearCurrentIntegration: (state) => {
      state.currentIntegration = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIntegrations.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchIntegrations.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchIntegrations.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch integrations';
        state.list = [];
      })
      .addCase(fetchIntegrationById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchIntegrationById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentIntegration = action.payload.data || action.payload;
      })
      .addCase(fetchIntegrationById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch integration';
        state.currentIntegration = null;
      })
      .addCase(updateIntegration.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateIntegration.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const integrationId = action.payload.integrationId;
        const index = state.list.findIndex(
          (item) =>
            String(item._id || item.id || item.integration_id) === String(integrationId)
        );
        if (index !== -1) {
          state.list[index] = {
            ...state.list[index],
            ...(action.payload.response.data || action.payload.response),
          };
        }
      })
      .addCase(updateIntegration.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update integration';
      })
      .addCase(deleteIntegration.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteIntegration.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.list = state.list.filter(
          (item) =>
            String(item._id || item.id || item.integration_id) !==
            String(action.payload.integrationId)
        );
        if (state.pagination.total > 0) state.pagination.total -= 1;
      })
      .addCase(deleteIntegration.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete integration';
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
  clearCurrentIntegration,
} = integrationSlice.actions;

export default integrationSlice.reducer;
