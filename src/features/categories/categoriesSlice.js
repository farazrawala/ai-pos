import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchCategoriesRequest } from './categoriesAPI.js';

export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchCategoriesRequest();
      return data;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch categories');
    }
  }
);

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  list: [],
  error: null,
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
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
        state.list = action.payload;
        state.error = null;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch categories';
        state.list = [];
      });
  },
});

export const { clearError } = categoriesSlice.actions;
export default categoriesSlice.reducer;
