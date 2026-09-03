import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchProfitReportBundleRequest,
  fetchOrdersWithProfitLinesRequest,
} from './profitReportAPI.js';

export const loadProfitReport = createAsyncThunk(
  'profitReport/load',
  async (params, { rejectWithValue, signal }) => {
    try {
      if (signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      return await fetchProfitReportBundleRequest(params);
    } catch (e) {
      if (e?.name === 'AbortError' || signal.aborted) throw e;
      return rejectWithValue(e.message || 'Failed to load profit report');
    }
  }
);

export const loadProfitReportLines = createAsyncThunk(
  'profitReport/loadLines',
  async (params, { rejectWithValue }) => {
    try {
      return await fetchOrdersWithProfitLinesRequest(params);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load profit lines');
    }
  }
);

const defaultPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
};

function isCurrentLoad(state, action) {
  return state.loadRequestId === action.meta.requestId;
}

const profitReportSlice = createSlice({
  name: 'profitReport',
  initialState: {
    report: null,
    quickStats: null,
    lines: [],
    orderProfitRows: [],
    orderGroups: [],
    linesSummary: null,
    ordersPageSummary: null,
    linesPagination: { ...defaultPagination },
    status: 'idle',
    linesStatus: 'idle',
    error: null,
    linesError: null,
    lastParams: null,
    loadRequestId: null,
  },
  reducers: {
    clearProfitReportError: (state) => {
      state.error = null;
      state.linesError = null;
    },
    setLinesPage: (state, action) => {
      state.linesPagination.page = action.payload;
    },
    setLinesLimit: (state, action) => {
      state.linesPagination.limit = action.payload;
      state.linesPagination.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProfitReport.pending, (state, action) => {
        state.status = 'loading';
        state.linesStatus = 'loading';
        state.error = null;
        state.linesError = null;
        state.lastParams = action.meta.arg ?? null;
        state.loadRequestId = action.meta.requestId;
      })
      .addCase(loadProfitReport.fulfilled, (state, action) => {
        if (!isCurrentLoad(state, action)) return;
        state.status = 'succeeded';
        state.linesStatus = 'succeeded';
        state.report = action.payload.report;
        state.quickStats = action.payload.quickStats ?? null;
        state.lines = action.payload.lines ?? [];
        state.orderProfitRows = action.payload.orderProfitRows ?? [];
        state.orderGroups = action.payload.orderGroups ?? [];
        state.linesSummary = action.payload.linesSummary ?? null;
        state.ordersPageSummary = action.payload.ordersPageSummary ?? null;
        state.linesPagination = action.payload.linesPagination ?? { ...defaultPagination };
        state.loadRequestId = null;
      })
      .addCase(loadProfitReport.rejected, (state, action) => {
        if (!isCurrentLoad(state, action)) return;
        if (action.meta.aborted) return;
        state.status = 'failed';
        state.linesStatus = 'failed';
        state.error = action.payload || action.error?.message || 'Failed to load profit report';
        state.linesError = state.error;
        state.report = null;
        state.quickStats = null;
        state.lines = [];
        state.orderProfitRows = [];
        state.orderGroups = [];
        state.linesSummary = null;
        state.ordersPageSummary = null;
        state.loadRequestId = null;
      })
      .addCase(loadProfitReportLines.pending, (state) => {
        state.linesStatus = 'loading';
        state.linesError = null;
      })
      .addCase(loadProfitReportLines.fulfilled, (state, action) => {
        state.linesStatus = 'succeeded';
        state.lines = action.payload.lines ?? [];
        state.orderProfitRows = action.payload.orderProfitRows ?? [];
        state.orderGroups = action.payload.orderGroups ?? [];
        state.linesSummary = action.payload.linesSummary ?? null;
        state.ordersPageSummary = action.payload.ordersPageSummary ?? null;
        state.linesPagination = action.payload.pagination ?? state.linesPagination;
      })
      .addCase(loadProfitReportLines.rejected, (state, action) => {
        state.linesStatus = 'failed';
        state.linesError =
          action.payload || action.error?.message || 'Failed to load profit lines';
      });
  },
});

export const { clearProfitReportError, setLinesPage, setLinesLimit } = profitReportSlice.actions;
export default profitReportSlice.reducer;
