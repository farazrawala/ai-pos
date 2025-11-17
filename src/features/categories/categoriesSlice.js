import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchCategoriesRequest,
  fetchCategoryByIdRequest,
  createCategoryRequest,
  updateCategoryRequest,
  deleteCategoryRequest,
} from './categoriesAPI.js';

export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchCategoriesRequest(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch categories');
    }
  }
);

export const fetchCategoryById = createAsyncThunk(
  'categories/fetchCategoryById',
  async (categoryId, { rejectWithValue }) => {
    try {
      const response = await fetchCategoryByIdRequest(categoryId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch category');
    }
  }
);

export const createCategory = createAsyncThunk(
  'categories/createCategory',
  async (categoryData, { rejectWithValue }) => {
    try {
      const response = await createCategoryRequest(categoryData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create category');
    }
  }
);

export const updateCategory = createAsyncThunk(
  'categories/updateCategory',
  async ({ categoryId, categoryData }, { rejectWithValue }) => {
    try {
      const response = await updateCategoryRequest(categoryId, categoryData);
      return { categoryId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update category');
    }
  }
);

export const deleteCategory = createAsyncThunk(
  'categories/deleteCategory',
  async (categoryId, { rejectWithValue }) => {
    try {
      const response = await deleteCategoryRequest(categoryId);
      return { categoryId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete category');
    }
  }
);

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  list: [],
  error: null,
  currentCategory: null, // For edit page
  fetchStatus: 'idle', // For fetching single category
  fetchError: null,
  updateStatus: 'idle', // For update operation
  updateError: null,
  deleteStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  deleteError: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  search: '',
  sort: {
    sortBy: null, // Field name to sort by
    sortOrder: 'asc', // 'asc' or 'desc'
  },
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.page = 1; // Reset to first page on new search
    },
    setPage: (state, action) => {
      state.pagination.page = action.payload;
    },
    setLimit: (state, action) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1; // Reset to first page on limit change
    },
    setSort: (state, action) => {
      const { sortBy, sortOrder } = action.payload;
      // If sortBy is null, clear sorting
      if (sortBy === null) {
        state.sort.sortBy = null;
        state.sort.sortOrder = 'asc';
      } else if (state.sort.sortBy === sortBy) {
        // If clicking the same column, toggle order
        state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        // Set new column with asc
        state.sort.sortBy = sortBy;
        state.sort.sortOrder = sortOrder || 'asc';
      }
      state.pagination.page = 1; // Reset to first page on sort change
    },
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
    clearUpdateStatus: (state) => {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
    clearCurrentCategory: (state) => {
      state.currentCategory = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
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
      .addCase(fetchCategories.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch categories';
        state.list = [];
      })
      .addCase(deleteCategory.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.deleteError = null;
        // Remove deleted item from list
        state.list = state.list.filter(
          (item) => (item._id || item.id || item.category_id) !== action.payload.categoryId
        );
        // Update total count
        if (state.pagination.total > 0) {
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete category';
      })
      .addCase(fetchCategoryById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchCategoryById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentCategory = action.payload.data || action.payload;
        state.fetchError = null;
      })
      .addCase(fetchCategoryById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch category';
        state.currentCategory = null;
      })
      .addCase(updateCategory.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        // Update the category in the list if it exists
        const categoryId = action.payload.categoryId;
        const index = state.list.findIndex(
          (item) => (item._id || item.id || item.category_id) === categoryId
        );
        if (index !== -1) {
          state.list[index] = { ...state.list[index], ...action.payload.response.data };
        }
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update category';
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
  clearCurrentCategory,
} = categoriesSlice.actions;
export default categoriesSlice.reducer;
