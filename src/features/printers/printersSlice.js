import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchPrintersRequest,
  createPrinterRequest,
  updatePrinterRequest,
  deletePrinterRequest,
  fetchPrinterTemplatesRequest,
  savePrinterTemplateRequest,
  fetchPrinterAssignmentsRequest,
  savePrinterAssignmentRequest,
  fetchPrinterCategoryLinksRequest,
  savePrinterCategoryLinksRequest,
} from './printersAPI.js';

export const loadPrinters = createAsyncThunk('printers/load', async (_, { rejectWithValue }) => {
  try {
    return await fetchPrintersRequest();
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to load printers');
  }
});

export const savePrinter = createAsyncThunk(
  'printers/save',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      if (id) return await updatePrinterRequest(id, data);
      return await createPrinterRequest(data);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to save printer');
    }
  }
);

export const removePrinter = createAsyncThunk(
  'printers/remove',
  async (id, { rejectWithValue }) => {
    try {
      await deletePrinterRequest(id);
      return id;
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to delete printer');
    }
  }
);

export const loadTemplates = createAsyncThunk('printers/loadTemplates', async (_, { rejectWithValue }) => {
  try {
    return await fetchPrinterTemplatesRequest();
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to load templates');
  }
});

export const saveTemplate = createAsyncThunk(
  'printers/saveTemplate',
  async (template, { rejectWithValue }) => {
    try {
      return await savePrinterTemplateRequest(template);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to save template');
    }
  }
);

export const loadAssignments = createAsyncThunk(
  'printers/loadAssignments',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchPrinterAssignmentsRequest();
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load assignments');
    }
  }
);

export const saveAssignment = createAsyncThunk(
  'printers/saveAssignment',
  async (payload, { rejectWithValue }) => {
    try {
      return await savePrinterAssignmentRequest(payload);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to save assignment');
    }
  }
);

export const loadCategoryLinks = createAsyncThunk(
  'printers/loadCategoryLinks',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchPrinterCategoryLinksRequest();
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to load category links');
    }
  }
);

export const saveCategoryLinks = createAsyncThunk(
  'printers/saveCategoryLinks',
  async (links, { rejectWithValue }) => {
    try {
      return await savePrinterCategoryLinksRequest(links);
    } catch (e) {
      return rejectWithValue(e.message || 'Failed to save category links');
    }
  }
);

const printersSlice = createSlice({
  name: 'printers',
  initialState: {
    list: [],
    templates: [],
    assignments: [],
    categoryLinks: [],
    status: 'idle',
    error: null,
    saveStatus: 'idle',
    saveError: null,
  },
  reducers: {
    clearPrinterErrors: (state) => {
      state.error = null;
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPrinters.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadPrinters.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload || [];
      })
      .addCase(loadPrinters.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.list = [];
      })
      .addCase(savePrinter.pending, (state) => {
        state.saveStatus = 'loading';
        state.saveError = null;
      })
      .addCase(savePrinter.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        const row = action.payload;
        if (!row?._id) return;
        const idx = state.list.findIndex((p) => String(p._id) === String(row._id));
        if (idx >= 0) state.list[idx] = row;
        else state.list.push(row);
      })
      .addCase(savePrinter.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.saveError = action.payload;
      })
      .addCase(removePrinter.fulfilled, (state, action) => {
        state.list = state.list.filter((p) => String(p._id) !== String(action.payload));
      })
      .addCase(loadTemplates.fulfilled, (state, action) => {
        state.templates = action.payload || [];
      })
      .addCase(saveTemplate.fulfilled, (state, action) => {
        const row = action.payload;
        if (!row?._id) return;
        const idx = state.templates.findIndex((t) => String(t._id) === String(row._id));
        if (idx >= 0) state.templates[idx] = row;
        else state.templates.push(row);
      })
      .addCase(loadAssignments.fulfilled, (state, action) => {
        state.assignments = action.payload || [];
      })
      .addCase(loadCategoryLinks.fulfilled, (state, action) => {
        state.categoryLinks = action.payload || [];
      });
  },
});

export const { clearPrinterErrors } = printersSlice.actions;
export default printersSlice.reducer;
