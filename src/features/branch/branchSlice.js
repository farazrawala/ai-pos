import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchBranchesRequest,
  fetchBranchByIdRequest,
  createBranchRequest,
  updateBranchRequest,
  deleteBranchRequest,
} from './branchAPI.js';

export const fetchBranches = createAsyncThunk(
  'branch/fetchBranches',
  async (params = {}, { rejectWithValue }) => {
    try {
      `  `;
      return await fetchBranchesRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch branches');
    }
  }
);

export const fetchBranchById = createAsyncThunk(
  'branch/fetchBranchById',
  async (branchId, { rejectWithValue }) => {
    try {
      return await fetchBranchByIdRequest(branchId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch branch');
    }
  }
);

export const createBranch = createAsyncThunk(
  'branch/createBranch',
  async (branchData, { rejectWithValue }) => {
    try {
      return await createBranchRequest(branchData);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create branch');
    }
  }
);

export const updateBranch = createAsyncThunk(
  'branch/updateBranch',
  async ({ branchId, branchData }, { rejectWithValue }) => {
    try {
      const response = await updateBranchRequest(branchId, branchData);
      return { branchId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update branch');
    }
  }
);

export const deleteBranch = createAsyncThunk(
  'branch/deleteBranch',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await deleteBranchRequest(branchId);
      return { branchId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete branch');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentBranch: null,
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

const branchSlice = createSlice({
  name: 'branch',
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
    clearCurrentBranch: (state) => {
      state.currentBranch = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBranches.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchBranches.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchBranches.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch branches';
        state.list = [];
      })
      .addCase(fetchBranchById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchBranchById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentBranch = action.payload.data || action.payload;
      })
      .addCase(fetchBranchById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch branch';
      })
      .addCase(updateBranch.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateBranch.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const branchId = action.payload.branchId;
        const index = state.list.findIndex(
          (item) => String(item._id || item.id || item.branch_id) === String(branchId)
        );
        if (index !== -1) {
          state.list[index] = {
            ...state.list[index],
            ...(action.payload.response.data || action.payload.response),
          };
        }
      })
      .addCase(updateBranch.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update branch';
      })
      .addCase(deleteBranch.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteBranch.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.list = state.list.filter(
          (item) =>
            String(item._id || item.id || item.branch_id) !== String(action.payload.branchId)
        );
        if (state.pagination.total > 0) state.pagination.total -= 1;
      })
      .addCase(deleteBranch.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete branch';
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
  clearCurrentBranch,
} = branchSlice.actions;

export default branchSlice.reducer;
