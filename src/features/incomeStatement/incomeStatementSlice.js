import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchIncomeStatementRequest } from './incomeStatementAPI.js';

export const fetchIncomeStatement = createAsyncThunk(
  'incomeStatement/fetchIncomeStatement',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchIncomeStatementRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to load income statement');
    }
  }
);

const initialState = {
  status: 'idle',
  error: null,
  report: null,
  demo: false,
};

const incomeStatementSlice = createSlice({
  name: 'incomeStatement',
  initialState,
  reducers: {
    clearIncomeStatement: (state) => {
      state.report = null;
      state.demo = false;
      state.error = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIncomeStatement.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchIncomeStatement.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.report = action.payload.report;
        state.demo = Boolean(action.payload.demo);
      })
      .addCase(fetchIncomeStatement.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message || 'Failed to load income statement';
        state.report = null;
        state.demo = false;
      });
  },
});

export const { clearIncomeStatement } = incomeStatementSlice.actions;
export default incomeStatementSlice.reducer;
