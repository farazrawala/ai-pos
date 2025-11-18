import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchProductsRequest,
  fetchProductByIdRequest,
  createProductRequest,
  updateProductRequest,
  deleteProductRequest,
  uploadProductImageRequest,
  uploadBulkProductImagesRequest,
} from './productsAPI.js';

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchProductsRequest(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch products');
    }
  }
);

export const fetchProductById = createAsyncThunk(
  'products/fetchProductById',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await fetchProductByIdRequest(productId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch product');
    }
  }
);

export const createProduct = createAsyncThunk(
  'products/createProduct',
  async ({ productData, images = [] }, { rejectWithValue }) => {
    try {
      const response = await createProductRequest(productData, images);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create product');
    }
  }
);

export const updateProduct = createAsyncThunk(
  'products/updateProduct',
  async ({ productId, productData, images = [] }, { rejectWithValue }) => {
    try {
      const response = await updateProductRequest(productId, productData, images);
      return { productId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update product');
    }
  }
);

export const deleteProduct = createAsyncThunk(
  'products/deleteProduct',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await deleteProductRequest(productId);
      return { productId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete product');
    }
  }
);

export const uploadProductImage = createAsyncThunk(
  'products/uploadProductImage',
  async ({ productId, imageFile }, { rejectWithValue }) => {
    try {
      const response = await uploadProductImageRequest(productId, imageFile);
      return { productId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to upload image');
    }
  }
);

export const uploadBulkProductImages = createAsyncThunk(
  'products/uploadBulkProductImages',
  async ({ productId, imageFiles }, { rejectWithValue }) => {
    try {
      const response = await uploadBulkProductImagesRequest(productId, imageFiles);
      return { productId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to upload images');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  currentProduct: null,
  fetchStatus: 'idle',
  fetchError: null,
  updateStatus: 'idle',
  updateError: null,
  deleteStatus: 'idle',
  deleteError: null,
  uploadImageStatus: 'idle',
  uploadImageError: null,
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

const productsSlice = createSlice({
  name: 'products',
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
    clearCurrentProduct: (state) => {
      state.currentProduct = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearUploadImageStatus: (state) => {
      state.uploadImageStatus = 'idle';
      state.uploadImageError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
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
      .addCase(fetchProducts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to fetch products';
        state.list = [];
      })
      .addCase(deleteProduct.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        state.deleteError = null;
        state.list = state.list.filter(
          (item) => (item._id || item.id || item.product_id) !== action.payload.productId
        );
        if (state.pagination.total > 0) {
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload || action.error.message || 'Failed to delete product';
      })
      .addCase(fetchProductById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentProduct = action.payload.data || action.payload;
        state.fetchError = null;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || action.error.message || 'Failed to fetch product';
        state.currentProduct = null;
      })
      .addCase(updateProduct.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.updateError = null;
        const productId = action.payload.productId;
        const index = state.list.findIndex(
          (item) => (item._id || item.id || item.product_id) === productId
        );
        if (index !== -1) {
          state.list[index] = { ...state.list[index], ...action.payload.response.data };
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || action.error.message || 'Failed to update product';
      })
      .addCase(uploadProductImage.pending, (state) => {
        state.uploadImageStatus = 'loading';
        state.uploadImageError = null;
      })
      .addCase(uploadProductImage.fulfilled, (state, action) => {
        state.uploadImageStatus = 'succeeded';
        state.uploadImageError = null;
      })
      .addCase(uploadProductImage.rejected, (state, action) => {
        state.uploadImageStatus = 'failed';
        state.uploadImageError = action.payload || action.error.message || 'Failed to upload image';
      })
      .addCase(uploadBulkProductImages.pending, (state) => {
        state.uploadImageStatus = 'loading';
        state.uploadImageError = null;
      })
      .addCase(uploadBulkProductImages.fulfilled, (state, action) => {
        state.uploadImageStatus = 'succeeded';
        state.uploadImageError = null;
      })
      .addCase(uploadBulkProductImages.rejected, (state, action) => {
        state.uploadImageStatus = 'failed';
        state.uploadImageError =
          action.payload || action.error.message || 'Failed to upload images';
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
  clearCurrentProduct,
  clearUploadImageStatus,
} = productsSlice.actions;
export default productsSlice.reducer;

