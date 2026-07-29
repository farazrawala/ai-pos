import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  assignTicket,
  changePriority,
  changeStatus,
  createTicket,
  getTicket,
  getTickets,
  replyTicket,
} from './supportAPI.js';

export const fetchTickets = createAsyncThunk(
  'support/fetchTickets',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await getTickets(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch tickets');
    }
  }
);

export const fetchTicketById = createAsyncThunk(
  'support/fetchTicketById',
  async ({ id, ...params }, { rejectWithValue }) => {
    try {
      return await getTicket(id, params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch ticket');
    }
  }
);

export const createSupportTicket = createAsyncThunk(
  'support/createSupportTicket',
  async (payload, { rejectWithValue }) => {
    try {
      return await createTicket(payload);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create ticket');
    }
  }
);

export const replySupportTicket = createAsyncThunk(
  'support/replySupportTicket',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      return await replyTicket(id, payload);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send reply');
    }
  }
);

export const updateTicketStatus = createAsyncThunk(
  'support/updateTicketStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      return await changeStatus(id, status);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to change status');
    }
  }
);

export const updateTicketPriority = createAsyncThunk(
  'support/updateTicketPriority',
  async ({ id, priority }, { rejectWithValue }) => {
    try {
      return await changePriority(id, priority);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to change priority');
    }
  }
);

export const assignSupportTicket = createAsyncThunk(
  'support/assignSupportTicket',
  async ({ id, assignedTo }, { rejectWithValue }) => {
    try {
      return await assignTicket(id, assignedTo);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to assign ticket');
    }
  }
);

const initialFilters = {
  search: '',
  status: '',
  priority: '',
  category: '',
  assigned_to: '',
  date_from: '',
  date_to: '',
};

const initialState = {
  listStatus: 'idle',
  list: [],
  listError: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: { ...initialFilters },
  sort: {
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  },
  currentTicket: null,
  fetchStatus: 'idle',
  fetchError: null,
  createStatus: 'idle',
  createError: null,
  actionStatus: 'idle',
  actionError: null,
};

const supportSlice = createSlice({
  name: 'support',
  initialState,
  reducers: {
    setSearch(state, action) {
      state.filters.search = action.payload ?? '';
      state.pagination.page = 1;
    },
    setFilters(state, action) {
      state.filters = { ...state.filters, ...(action.payload || {}) };
      state.pagination.page = 1;
    },
    resetFilters(state) {
      state.filters = { ...initialFilters };
      state.pagination.page = 1;
    },
    setPage(state, action) {
      state.pagination.page = action.payload;
    },
    setLimit(state, action) {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
    },
    setSort(state, action) {
      const { sortBy, sortOrder } = action.payload || {};
      if (!sortBy) {
        state.sort = { sortBy: 'updatedAt', sortOrder: 'desc' };
        return;
      }
      if (state.sort.sortBy === sortBy) {
        state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.sortBy = sortBy;
        state.sort.sortOrder = sortOrder || 'asc';
      }
    },
    clearCurrentTicket(state) {
      state.currentTicket = null;
      state.fetchStatus = 'idle';
      state.fetchError = null;
    },
    clearCreateStatus(state) {
      state.createStatus = 'idle';
      state.createError = null;
    },
    clearActionStatus(state) {
      state.actionStatus = 'idle';
      state.actionError = null;
    },
    patchCurrentTicket(state, action) {
      if (state.currentTicket && action.payload) {
        state.currentTicket = { ...state.currentTicket, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.list = action.payload?.data || [];
        state.pagination = {
          page: action.payload?.page || state.pagination.page,
          limit: action.payload?.limit || state.pagination.limit,
          total: action.payload?.total || 0,
          totalPages: action.payload?.totalPages || 0,
        };
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || 'Failed to fetch tickets';
        state.list = [];
      })
      .addCase(fetchTicketById.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetchTicketById.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.currentTicket = action.payload;
      })
      .addCase(fetchTicketById.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || 'Failed to fetch ticket';
      })
      .addCase(createSupportTicket.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createSupportTicket.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.currentTicket = action.payload;
      })
      .addCase(createSupportTicket.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload || 'Failed to create ticket';
      })
      .addCase(replySupportTicket.pending, (state) => {
        state.actionStatus = 'loading';
        state.actionError = null;
      })
      .addCase(replySupportTicket.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        if (action.payload) state.currentTicket = action.payload;
      })
      .addCase(replySupportTicket.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = action.payload || 'Failed to send reply';
      })
      .addCase(updateTicketStatus.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        if (action.payload) state.currentTicket = action.payload;
      })
      .addCase(updateTicketStatus.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = action.payload || 'Failed to change status';
      })
      .addCase(updateTicketPriority.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        if (action.payload) state.currentTicket = action.payload;
      })
      .addCase(updateTicketPriority.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = action.payload || 'Failed to change priority';
      })
      .addCase(assignSupportTicket.fulfilled, (state, action) => {
        state.actionStatus = 'succeeded';
        if (action.payload) state.currentTicket = action.payload;
      })
      .addCase(assignSupportTicket.rejected, (state, action) => {
        state.actionStatus = 'failed';
        state.actionError = action.payload || 'Failed to assign ticket';
      });
  },
});

export const {
  setSearch,
  setFilters,
  resetFilters,
  setPage,
  setLimit,
  setSort,
  clearCurrentTicket,
  clearCreateStatus,
  clearActionStatus,
  patchCurrentTicket,
} = supportSlice.actions;

export default supportSlice.reducer;
