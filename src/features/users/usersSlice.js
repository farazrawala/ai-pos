import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchUsersRequest,
  fetchUserByIdRequest,
  createUserRequest,
  updateUserRequest,
  deleteUserRequest,
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

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await deleteUserRequest(userId);
      return { userId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete user');
    }
  }
);

export const USER_LIST_ROLE_TABS = [
  { id: 'users', label: 'Users', role: 'USER' },
  { id: 'customer', label: 'Customers', role: 'CUSTOMER' },
  { id: 'vendor', label: 'Vendors', role: 'VENDOR' },
];

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
  roleFilter: 'users',
  sort: {
    sortBy: null,
    sortOrder: 'asc',
  },
  currentUser: null,
  fetchRequestedUserId: null,
  fetchStatus: 'idle',
  fetchError: null,
  createStatus: 'idle',
  createError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,
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
    setRoleFilter: (state, action) => {
      state.roleFilter = action.payload;
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
      state.fetchRequestedUserId = null;
    },
    clearCreateStatus: (state) => {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
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
      .addCase(fetchUserById.pending, (state, action) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
        state.fetchRequestedUserId = String(action.meta.arg || '');
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        const requestedId = String(action.meta.arg || '');
        if (state.fetchRequestedUserId !== requestedId) return;
        state.fetchStatus = 'succeeded';
        state.currentUser = action.payload;
        state.fetchError = null;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        const requestedId = String(action.meta.arg || '');
        if (state.fetchRequestedUserId !== requestedId) return;
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
      })
      .addCase(deleteUser.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const userId = String(action.payload.userId);
        state.list = state.list.filter((item) => String(item._id || item.id) !== userId);
        if (state.pagination.total > 0) state.pagination.total -= 1;
        if (
          state.currentUser &&
          String(state.currentUser._id || state.currentUser.id) === userId
        ) {
          state.currentUser = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete user';
      });
  },
});

export const {
  clearError,
  setSearch,
  setRoleFilter,
  setPage,
  setLimit,
  setSort,
  clearFetchStatus,
  clearCreateStatus,
  clearUpdateStatus,
  clearDeleteStatus,
} = usersSlice.actions;
export default usersSlice.reducer;
