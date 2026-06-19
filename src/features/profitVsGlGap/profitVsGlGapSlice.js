import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchProfitVsGlGapRequest } from './profitVsGlGapAPI.js';

export const fetchProfitVsGlGap = createAsyncThunk(
  'profitVsGlGap/fetchProfitVsGlGap',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchProfitVsGlGapRequest();
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load profit vs GL gap');
    }
  }
);

const initialState = {
  status: 'idle',
  error: null,
  report: null,
};

const profitVsGlGapSlice = createSlice({
  name: 'profitVsGlGap',
  initialState,
  reducers: {
    clearProfitVsGlGap: (state) => {
      state.report = null;
      state.error = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfitVsGlGap.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProfitVsGlGap.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.report = action.payload.report;
      })
      .addCase(fetchProfitVsGlGap.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error.message || 'Failed to load profit vs GL gap';
        state.report = null;
      });
  },
});

export const { clearProfitVsGlGap } = profitVsGlGapSlice.actions;
export default profitVsGlGapSlice.reducer;
