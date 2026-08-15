import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as api from './tasksAPI.js';

export const loadBoards = createAsyncThunk('tasks/loadBoards', async (params, { rejectWithValue }) => {
  try {
    const res = await api.fetchBoards(params);
    return res;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const loadKanban = createAsyncThunk(
  'tasks/loadKanban',
  async ({ boardId, params }, { rejectWithValue }) => {
    try {
      const res = await api.fetchBoardKanban(boardId, params);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.message);
    }
  },
);

export const loadTaskList = createAsyncThunk(
  'tasks/loadTaskList',
  async (params, { rejectWithValue }) => {
    try {
      return await api.fetchTasks(params);
    } catch (e) {
      return rejectWithValue(e.message);
    }
  },
);

export const loadTaskDetail = createAsyncThunk(
  'tasks/loadTaskDetail',
  async (taskId, { rejectWithValue }) => {
    try {
      const res = await api.fetchTask(taskId);
      return res.data;
    } catch (e) {
      return rejectWithValue(e.message);
    }
  },
);

export const persistMoveTask = createAsyncThunk(
  'tasks/persistMoveTask',
  async ({ taskId, body, snapshot }, { rejectWithValue }) => {
    try {
      const res = await api.moveTask(taskId, body);
      return { task: res.data, snapshot };
    } catch (e) {
      return rejectWithValue({ message: e.message, snapshot });
    }
  },
);

const initialState = {
  boards: [],
  boardsPagination: { skip: 0, limit: 50, total: 0 },
  boardsLoading: false,
  boardsError: null,

  kanbanBoard: null,
  kanbanColumns: [],
  kanbanLoading: false,
  kanbanError: null,
  filters: {
    search: '',
    quick: 'all',
    priority: '',
    assignee_id: '',
    sortBy: 'position',
  },

  taskList: [],
  taskListPagination: { skip: 0, limit: 25, total: 0 },
  taskListLoading: false,

  selectedTask: null,
  selectedTaskLoading: false,

  movePending: false,
};

function findTaskInColumns(columns, taskId) {
  for (const col of columns) {
    const idx = (col.tasks || []).findIndex((t) => String(t._id) === String(taskId));
    if (idx >= 0) return { col, idx, task: col.tasks[idx] };
  }
  return null;
}

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearSelectedTask(state) {
      state.selectedTask = null;
    },
    optimisticMoveTask(state, action) {
      const { taskId, toColumnId, toIndex } = action.payload;
      const found = findTaskInColumns(state.kanbanColumns, taskId);
      if (!found) return;
      const fromCol = found.col;
      const [task] = fromCol.tasks.splice(found.idx, 1);
      const toCol = state.kanbanColumns.find((c) => String(c._id) === String(toColumnId));
      if (!toCol) {
        fromCol.tasks.splice(found.idx, 0, task);
        return;
      }
      task.column_id = toColumnId;
      const insertAt = Math.max(0, Math.min(toIndex, toCol.tasks.length));
      toCol.tasks.splice(insertAt, 0, task);
    },
    restoreKanbanSnapshot(state, action) {
      if (action.payload?.columns) {
        state.kanbanColumns = action.payload.columns;
      }
      if (action.payload?.board) {
        state.kanbanBoard = action.payload.board;
      }
    },
    patchTaskInKanban(state, action) {
      const task = action.payload;
      if (!task?._id) return;
      for (const col of state.kanbanColumns) {
        const idx = (col.tasks || []).findIndex((t) => String(t._id) === String(task._id));
        if (idx >= 0) {
          if (String(col._id) !== String(task.column_id?._id || task.column_id)) {
            col.tasks.splice(idx, 1);
            const dest = state.kanbanColumns.find(
              (c) => String(c._id) === String(task.column_id?._id || task.column_id),
            );
            if (dest) dest.tasks.push(task);
          } else {
            col.tasks[idx] = { ...col.tasks[idx], ...task };
          }
          break;
        }
      }
      if (state.selectedTask && String(state.selectedTask._id) === String(task._id)) {
        state.selectedTask = { ...state.selectedTask, ...task };
      }
    },
    optimisticReorderColumns(state, action) {
      const orderedIds = action.payload || [];
      const map = Object.fromEntries(state.kanbanColumns.map((c) => [String(c._id), c]));
      state.kanbanColumns = orderedIds.map((id) => map[String(id)]).filter(Boolean);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBoards.pending, (state) => {
        state.boardsLoading = true;
        state.boardsError = null;
      })
      .addCase(loadBoards.fulfilled, (state, action) => {
        state.boardsLoading = false;
        state.boards = action.payload.data || [];
        state.boardsPagination = action.payload.pagination || state.boardsPagination;
      })
      .addCase(loadBoards.rejected, (state, action) => {
        state.boardsLoading = false;
        state.boardsError = action.payload || 'Failed to load boards';
      })
      .addCase(loadKanban.pending, (state) => {
        state.kanbanLoading = true;
        state.kanbanError = null;
      })
      .addCase(loadKanban.fulfilled, (state, action) => {
        state.kanbanLoading = false;
        state.kanbanBoard = action.payload.board;
        state.kanbanColumns = action.payload.columns || [];
      })
      .addCase(loadKanban.rejected, (state, action) => {
        state.kanbanLoading = false;
        state.kanbanError = action.payload || 'Failed to load board';
      })
      .addCase(loadTaskList.pending, (state) => {
        state.taskListLoading = true;
      })
      .addCase(loadTaskList.fulfilled, (state, action) => {
        state.taskListLoading = false;
        state.taskList = action.payload.data || [];
        state.taskListPagination = action.payload.pagination || state.taskListPagination;
      })
      .addCase(loadTaskList.rejected, (state) => {
        state.taskListLoading = false;
      })
      .addCase(loadTaskDetail.pending, (state) => {
        state.selectedTaskLoading = true;
      })
      .addCase(loadTaskDetail.fulfilled, (state, action) => {
        state.selectedTaskLoading = false;
        state.selectedTask = action.payload;
      })
      .addCase(loadTaskDetail.rejected, (state) => {
        state.selectedTaskLoading = false;
      })
      .addCase(persistMoveTask.pending, (state) => {
        state.movePending = true;
      })
      .addCase(persistMoveTask.fulfilled, (state, action) => {
        state.movePending = false;
        if (action.payload?.task) {
          const task = action.payload.task;
          for (const col of state.kanbanColumns) {
            const idx = (col.tasks || []).findIndex((t) => String(t._id) === String(task._id));
            if (idx >= 0) {
              col.tasks[idx] = { ...col.tasks[idx], ...task };
              break;
            }
          }
        }
      })
      .addCase(persistMoveTask.rejected, (state, action) => {
        state.movePending = false;
        const snapshot = action.payload?.snapshot;
        if (snapshot?.columns) state.kanbanColumns = snapshot.columns;
      });
  },
});

export const {
  setFilters,
  clearSelectedTask,
  optimisticMoveTask,
  restoreKanbanSnapshot,
  patchTaskInKanban,
  optimisticReorderColumns,
} = tasksSlice.actions;

export default tasksSlice.reducer;
