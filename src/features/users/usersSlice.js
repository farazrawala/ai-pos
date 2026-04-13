import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchUsersRequest,
  fetchUserByIdRequest,
  createUserRequest,
  updateUserRequest,
} from './usersAPI.js';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchUsersRequest(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch users');
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'users/fetchUserById',
  async (userId, { rejectWithValue }) => {
    try {
      return await fetchUserByIdRequest(userId);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch user');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (payload, { rejectWithValue }) => {
    try {
      return await createUserRequest(payload);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create user');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, payload }, { rejectWithValue }) => {
    try {
      const response = await updateUserRequest(userId, payload);
      return { userId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update user');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
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
  currentUser: null,
  fetchStatus: 'idle',
  fetchError: null,
  createStatus: 'idle',
  createError: null,
  updateStatus: 'idle',
  updateError: null,
};

const usersSlice = createSlice({
  name: 'users',
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
    clearFetchStatus: (state) => {
      state.fetchStatus = 'idle';
      state.fetchError = null;
      state.currentUser = null;
    },
    clearCreateStatus: (state) => {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
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
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch users';
        state.list = [];
      })
      .addCase(fetchUserById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentUser = action.payload;
        state.fetchError = null;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch user';
        state.currentUser = null;
      })
      .addCase(createUser.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.createError = null;
        if (action.payload && typeof action.payload === 'object') {
          state.list = [action.payload, ...state.list];
        }
      })
      .addCase(createUser.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload || action.error.message || 'Failed to create user';
      })
      .addCase(updateUser.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const userId = action.payload.userId;
        const index = state.list.findIndex((item) => String(item._id || item.id) === String(userId));
        if (index !== -1 && action.payload.response) {
          state.list[index] = { ...state.list[index], ...action.payload.response };
        }
        if (state.currentUser && String(state.currentUser._id || state.currentUser.id) === String(userId)) {
          state.currentUser = { ...state.currentUser, ...action.payload.response };
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update user';
      });
  },
});

export const {
  clearError,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearFetchStatus,
  clearCreateStatus,
  clearUpdateStatus,
} = usersSlice.actions;
export default usersSlice.reducer;
