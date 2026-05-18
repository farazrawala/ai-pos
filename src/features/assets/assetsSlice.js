import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { createAssetRequest } from './assetsAPI.js';

export const createAsset = createAsyncThunk(
  'assets/createAsset',
  async (arg, { rejectWithValue }) => {
    const safe = arg || {};
    const { assetFields } = safe;
    try {
      const payload = assetFields !== undefined ? { ...assetFields } : { ...safe };
      const response = await createAssetRequest(payload);
      return response;
    } catch (error) {
      const message = error?.message || String(error) || 'Failed to create asset';
      console.error('[Asset module] createAsset thunk error', { message, error });
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  createStatus: 'idle',
  createError: null,
  lastCreated: null,
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
  },
  extraReducers: (builder) => {
    builder
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
      });
  },
});

export const { clearCreateStatus, clearLastCreated } = assetsSlice.actions;
export default assetsSlice.reducer;
