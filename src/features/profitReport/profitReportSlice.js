import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchProfitByOrderItemRequest } from './profitReportAPI.js';

export const loadProfitReport = createAsyncThunk(
  'profitReport/load',
  async (params, { rejectWithValue }) => {
    try {
      return await fetchProfitByOrderItemRequest(params);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load profit report');
    }
  }
);

const profitReportSlice = createSlice({
  name: 'profitReport',
  initialState: {
    report: null,
    status: 'idle',
    error: null,
    lastParams: null,
  },
  reducers: {
    clearProfitReportError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProfitReport.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.lastParams = action.meta.arg ?? null;
      })
      .addCase(loadProfitReport.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.report = action.payload.report;
      })
      .addCase(loadProfitReport.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error?.message || 'Failed to load profit report';
        state.report = null;
      });
  },
});

export const { clearProfitReportError } = profitReportSlice.actions;
export default profitReportSlice.reducer;
