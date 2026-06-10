import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchAdvanceBalanceSheetRequest } from './advanceBalanceSheetAPI.js';

export const fetchAdvanceBalanceSheet = createAsyncThunk(
  'advanceBalanceSheet/fetchAdvanceBalanceSheet',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAdvanceBalanceSheetRequest();
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load advance balance sheet');
    }
  }
);

const initialState = {
  status: 'idle',
  error: null,
  report: null,
};

const advanceBalanceSheetSlice = createSlice({
  name: 'advanceBalanceSheet',
  initialState,
  reducers: {
    clearAdvanceBalanceSheet: (state) => {
      state.report = null;
      state.error = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdvanceBalanceSheet.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAdvanceBalanceSheet.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.report = action.payload.report;
      })
      .addCase(fetchAdvanceBalanceSheet.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error.message || 'Failed to load advance balance sheet';
        state.report = null;
      });
  },
});

export const { clearAdvanceBalanceSheet } = advanceBalanceSheetSlice.actions;
export default advanceBalanceSheetSlice.reducer;
