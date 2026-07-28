import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  searchWhatsappContactsRequest,
  fetchWhatsappChatRequest,
  getCompanyWhatsappNumber,
} from './whatsappChatAPI.js';

const CHAT_CACHE_MAX = 12;
const PAGE_LIMIT = 50;

export const searchWhatsappContacts = createAsyncThunk(
  'whatsappChat/search',
  async (q, { rejectWithValue }) => {
    try {
      return await searchWhatsappContactsRequest(q);
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to search contacts');
    }
  }
);

export const loadWhatsappChat = createAsyncThunk(
  'whatsappChat/loadChat',
  async ({ contactId, number, page = 1, append = false }, { rejectWithValue, getState }) => {
    try {
      const ourNumber = getCompanyWhatsappNumber(getState()?.user?.company);
      const result = await fetchWhatsappChatRequest(number, {
        page,
        limit: PAGE_LIMIT,
        ourNumber,
      });
      return { contactId, append, ...result };
    } catch (error) {
      return rejectWithValue(error.message || 'Previous chat not found.');
    }
  }
);

function trimCache(cache, keepId) {
  const keys = Object.keys(cache);
  if (keys.length <= CHAT_CACHE_MAX) return cache;
  const next = { ...cache };
  const removable = keys.filter((k) => k !== keepId);
  while (Object.keys(next).length > CHAT_CACHE_MAX && removable.length) {
    delete next[removable.shift()];
  }
  return next;
}

const initialState = {
  searchQuery: '',
  searchStatus: 'idle',
  searchError: null,
  contacts: [],

  selectedContactId: null,
  selectedContact: null,

  messages: [],
  chatPage: 1,
  hasMore: false,
  chatStatus: 'idle',
  chatError: null,
  loadingOlder: false,

  /** contactId → { messages, page, hasMore, contact, savedAt } */
  chatCache: {},
};

const whatsappChatSlice = createSlice({
  name: 'whatsappChat',
  initialState,
  reducers: {
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearSearch: (state) => {
      state.searchQuery = '';
      state.contacts = [];
      state.searchStatus = 'idle';
      state.searchError = null;
    },
    selectContact: (state, action) => {
      const contact = action.payload;
      if (!contact?.contactId) return;
      state.selectedContactId = contact.contactId;
      state.selectedContact = contact;
      state.chatError = null;

      const cached = state.chatCache[contact.contactId];
      if (cached) {
        state.messages = cached.messages;
        state.chatPage = cached.page;
        state.hasMore = cached.hasMore;
        state.chatStatus = 'succeeded';
        if (cached.contact) {
          state.selectedContact = { ...contact, ...cached.contact };
        }
      } else {
        state.messages = [];
        state.chatPage = 1;
        state.hasMore = false;
        state.chatStatus = 'idle';
      }
    },
    clearSelectedContact: (state) => {
      state.selectedContactId = null;
      state.selectedContact = null;
      state.messages = [];
      state.chatPage = 1;
      state.hasMore = false;
      state.chatStatus = 'idle';
      state.chatError = null;
      state.loadingOlder = false;
    },
    appendOptimisticMessage: (state, action) => {
      const msg = action.payload;
      if (!msg?.id) return;
      state.messages.push(msg);
      const id = state.selectedContactId;
      if (id && state.chatCache[id]) {
        state.chatCache[id].messages = state.messages;
      }
    },
    markContactRead: (state, action) => {
      const contactId = action.payload;
      state.contacts = state.contacts.map((c) =>
        c.contactId === contactId ? { ...c, unread: 0 } : c
      );
      if (state.selectedContact?.contactId === contactId) {
        state.selectedContact = { ...state.selectedContact, unread: 0 };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchWhatsappContacts.pending, (state) => {
        state.searchStatus = 'loading';
        state.searchError = null;
      })
      .addCase(searchWhatsappContacts.fulfilled, (state, action) => {
        state.searchStatus = 'succeeded';
        state.contacts = action.payload || [];
      })
      .addCase(searchWhatsappContacts.rejected, (state, action) => {
        state.searchStatus = 'failed';
        state.searchError = action.payload || 'Failed to search contacts';
        state.contacts = [];
      })
      .addCase(loadWhatsappChat.pending, (state, action) => {
        const append = Boolean(action.meta?.arg?.append);
        if (append) {
          state.loadingOlder = true;
        } else if (state.messages.length === 0) {
          state.chatStatus = 'loading';
          state.chatError = null;
        } else {
          // Refreshing with cache already shown — keep UI stable
          state.chatError = null;
        }
      })
      .addCase(loadWhatsappChat.fulfilled, (state, action) => {
        const { contactId, append, messages, hasMore, page, contact } = action.payload;
        state.loadingOlder = false;
        state.chatStatus = 'succeeded';
        state.chatError = null;

        if (state.selectedContactId !== contactId) return;

        if (append) {
          const existingIds = new Set(state.messages.map((m) => m.id));
          const older = (messages || []).filter((m) => !existingIds.has(m.id));
          state.messages = [...older, ...state.messages];
        } else {
          state.messages = messages || [];
        }

        state.chatPage = page;
        state.hasMore = hasMore;
        if (contact) {
          state.selectedContact = { ...state.selectedContact, ...contact };
        }

        state.chatCache = trimCache(
          {
            ...state.chatCache,
            [contactId]: {
              messages: state.messages,
              page: state.chatPage,
              hasMore: state.hasMore,
              contact: state.selectedContact,
              savedAt: Date.now(),
            },
          },
          contactId
        );
      })
      .addCase(loadWhatsappChat.rejected, (state, action) => {
        const append = Boolean(action.meta?.arg?.append);
        state.loadingOlder = false;
        if (!append) {
          state.chatStatus = 'failed';
          state.chatError = action.payload || 'Failed to load chat';
        }
      });
  },
});

export const {
  setSearchQuery,
  clearSearch,
  selectContact,
  clearSelectedContact,
  appendOptimisticMessage,
  markContactRead,
} = whatsappChatSlice.actions;

export const PAGE_LIMIT_CHAT = PAGE_LIMIT;
export default whatsappChatSlice.reducer;
