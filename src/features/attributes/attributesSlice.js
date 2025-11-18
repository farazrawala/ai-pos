import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchAttributesRequest,
  fetchAttributeByIdRequest,
  createAttributeRequest,
  updateAttributeRequest,
  deleteAttributeRequest,
} from './attributesAPI.js';

export const fetchAttributes = createAsyncThunk(
  'attributes/fetchAttributes',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchAttributesRequest(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch attributes');
    }
  }
);

export const fetchAttributeById = createAsyncThunk(
  'attributes/fetchAttributeById',
  async (attributeId, { rejectWithValue }) => {
    try {
      const response = await fetchAttributeByIdRequest(attributeId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch attribute');
    }
  }
);

export const createAttribute = createAsyncThunk(
  'attributes/createAttribute',
  async (attributeData, { rejectWithValue }) => {
    try {
      const response = await createAttributeRequest(attributeData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create attribute');
    }
  }
);

export const updateAttribute = createAsyncThunk(
  'attributes/updateAttribute',
  async ({ attributeId, attributeData }, { rejectWithValue }) => {
    try {
      const response = await updateAttributeRequest(attributeId, attributeData);
      return { attributeId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update attribute');
    }
  }
);

export const deleteAttribute = createAsyncThunk(
  'attributes/deleteAttribute',
  async (attributeId, { rejectWithValue }) => {
    try {
      const response = await deleteAttributeRequest(attributeId);
      return { attributeId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete attribute');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentAttribute: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,
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
};

const attributesSlice = createSlice({
  name: 'attributes',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
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
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
    clearCurrentAttribute: (state) => {
      state.currentAttribute = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttributes.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAttributes.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
        state.error = null;
      })
      .addCase(fetchAttributes.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch attributes';
        state.list = [];
      })
      .addCase(deleteAttribute.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteAttribute.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.deleteError = null;
        state.list = state.list.filter(
          (item) => (item._id || item.id || item.attribute_id) !== action.payload.attributeId
        );
        if (state.pagination.total > 0) {
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteAttribute.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete attribute';
      })
      .addCase(fetchAttributeById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchAttributeById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentAttribute = action.payload.data || action.payload;
        state.fetchError = null;
      })
      .addCase(fetchAttributeById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch attribute';
        state.currentAttribute = null;
      })
      .addCase(updateAttribute.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateAttribute.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const attributeId = action.payload.attributeId;
        const index = state.list.findIndex(
          (item) => (item._id || item.id || item.attribute_id) === attributeId
        );
        if (index !== -1) {
          state.list[index] = { ...state.list[index], ...action.payload.response.data };
        }
      })
      .addCase(updateAttribute.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update attribute';
      });
  },
});

export const {
  clearError,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
  clearUpdateStatus,
  clearCurrentAttribute,
} = attributesSlice.actions;
export default attributesSlice.reducer;
