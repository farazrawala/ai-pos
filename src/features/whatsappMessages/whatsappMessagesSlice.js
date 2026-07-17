import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchWhatsappMessagesRequest,
  deleteWhatsappMessageRequest,
} from './whatsappMessagesAPI.js';

export const fetchWhatsappMessages = createAsyncThunk(
  'whatsappMessages/fetchWhatsappMessages',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchWhatsappMessagesRequest(params);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch WhatsApp messages');
    }
  }
);

export const deleteWhatsappMessage = createAsyncThunk(
  'whatsappMessages/deleteWhatsappMessage',
  async (messageId, { rejectWithValue }) => {
    try {
      const response = await deleteWhatsappMessageRequest(messageId);
      return { messageId, response };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to stop WhatsApp message');
    }
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null,
  deleteStatus: 'idle',
  deleteError: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
  search: '',
  statusFilter: '',
  sort: { sortBy: 'createdAt', sortOrder: 'desc' },
};

const whatsappMessagesSlice = createSlice({
  name: 'whatsappMessages',
  initialState,
  reducers: {
    setSearch: (state, action) => {
      state.search = action.payload;
      state.pagination.page = 1;
    },
    setStatusFilter: (state, action) => {
      state.statusFilter = action.payload;
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
      const { sortBy } = action.payload;
      if (sortBy === null) {
        state.sort = { sortBy: 'createdAt', sortOrder: 'desc' };
      } else if (state.sort.sortBy === sortBy) {
        state.sort.sortOrder = state.sort.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = { sortBy, sortOrder: action.payload.sortOrder || 'asc' };
      }
      state.pagination.page = 1;
    },
    clearDeleteStatus: (state) => {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWhatsappMessages.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchWhatsappMessages.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload.data || [];
        state.pagination = {
          page: action.payload.page || state.pagination.page,
          limit: action.payload.limit || state.pagination.limit,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchWhatsappMessages.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload || action.error.message || 'Failed to fetch WhatsApp messages';
        state.list = [];
      })
      .addCase(deleteWhatsappMessage.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteWhatsappMessage.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const deletedId = String(action.payload.messageId || '');
        state.list = state.list.filter(
          (item) => String(item._id || item.id || '') !== deletedId
        );
        if (state.pagination.total > 0) {
          state.pagination.total -= 1;
          const limit = state.pagination.limit || 25;
          state.pagination.totalPages =
            limit > 0 ? Math.ceil(state.pagination.total / limit) : 0;
        }
      })
      .addCase(deleteWhatsappMessage.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError =
          action.payload || action.error.message || 'Failed to stop WhatsApp message';
      });
  },
});

export const { setSearch, setStatusFilter, setPage, setLimit, setSort, clearDeleteStatus } =
  whatsappMessagesSlice.actions;
export default whatsappMessagesSlice.reducer;
