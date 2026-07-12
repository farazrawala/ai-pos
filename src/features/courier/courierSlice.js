import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchCouriersRequest,
  fetchCourierByIdRequest,
  createCourierRequest,
  updateCourierRequest,
  deleteCourierRequest,
  pickCourierId,
} from './courierAPI.js';

export const fetchCouriers = createAsyncThunk(
  'courier/fetchCouriers',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchCouriersRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch courier integrations');
    }
  }
);

export const fetchCourierById = createAsyncThunk(
  'courier/fetchCourierById',
  async (courierId, { rejectWithValue }) => {
    try {
      return await fetchCourierByIdRequest(courierId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch courier integration');
    }
  }
);

export const createCourier = createAsyncThunk(
  'courier/createCourier',
  async (courierData, { rejectWithValue }) => {
    try {
      return await createCourierRequest(courierData);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create courier integration');
    }
  }
);

export const updateCourier = createAsyncThunk(
  'courier/updateCourier',
  async ({ courierId, courierData }, { rejectWithValue }) => {
    try {
      const response = await updateCourierRequest(courierId, courierData);
      return { courierId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update courier integration');
    }
  }
);

export const deleteCourier = createAsyncThunk(
  'courier/deleteCourier',
  async (courierId, { rejectWithValue }) => {
    try {
      const response = await deleteCourierRequest(courierId);
      return { courierId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete courier integration');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentCourier: null,
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

const courierSlice = createSlice({
  name: 'courier',
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
    clearCurrentCourier: (state) => {
      state.currentCourier = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCouriers.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCouriers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchCouriers.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error.message || 'Failed to fetch courier integrations';
        state.list = [];
      })
      .addCase(fetchCourierById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchCourierById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentCourier = action.payload.data || action.payload;
      })
      .addCase(fetchCourierById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError =
          action.payload || action.error.message || 'Failed to fetch courier integration';
      })
      .addCase(updateCourier.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateCourier.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const courierId = String(action.payload.courierId ?? '');
        const index = state.list.findIndex((item) => String(pickCourierId(item)) === courierId);
        if (index !== -1) {
          state.list[index] = {
            ...state.list[index],
            ...(action.payload.response.data || action.payload.response),
          };
        }
      })
      .addCase(updateCourier.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError =
          action.payload || action.error.message || 'Failed to update courier integration';
      })
      .addCase(deleteCourier.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteCourier.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const deletedId = String(action.payload.courierId ?? '');
        state.list = state.list.filter((item) => String(pickCourierId(item)) !== deletedId);
        if (state.pagination.total > 0) state.pagination.total -= 1;
      })
      .addCase(deleteCourier.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError =
          action.payload || action.error.message || 'Failed to delete courier integration';
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
  clearCurrentCourier,
} = courierSlice.actions;

export default courierSlice.reducer;
