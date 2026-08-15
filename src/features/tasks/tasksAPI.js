/**
 * Task Management API — mirrors backend `/task-board`, `/task-column`, `/task`.
 */
import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${String(API_BASE_URL || '/api').replace(/\/+$/, '')}/`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const jsonHeaders = () => {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const authOnlyHeaders = () => {
  const token = getAuthToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const readError = async (response) => {
  const errorData = await response.json().catch(() => ({}));
  return errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
};

const appendParams = (queryParams, params = {}) => {
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    queryParams.append(key, String(value));
  });
};

async function getJson(path, params = {}) {
  const queryParams = new URLSearchParams();
  appendParams(queryParams, params);
  const qs = queryParams.toString();
  const response = await fetch(`${BASE_URL}${path}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: jsonHeaders(),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function sendJson(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: jsonHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

// Boards
export const fetchBoards = (params) => getJson('task-board/get-all', params);
export const fetchBoard = (id) => getJson(`task-board/get/${id}`);
export const fetchBoardKanban = (id, params) => getJson(`task-board/kanban/${id}`, params);
export const createBoard = (body) => sendJson('POST', 'task-board/create', body);
export const updateBoard = (id, body) => sendJson('PUT', `task-board/update/${id}`, body);
export const archiveBoard = (id) => sendJson('PUT', `task-board/archive/${id}`, {});
export const deleteBoard = (id) => sendJson('DELETE', `task-board/delete/${id}`);
export const duplicateBoard = (id, body = {}) =>
  sendJson('POST', `task-board/duplicate/${id}`, body);
export const addBoardMember = (id, user_id) =>
  sendJson('POST', `task-board/members/${id}`, { user_id });
export const removeBoardMember = (id, userId) =>
  sendJson('DELETE', `task-board/members/${id}/${userId}`);
export const seedDemoBoard = () => sendJson('POST', 'task/seed-demo', {});

// Columns
export const fetchColumns = (board_id) => getJson('task-column/get-all', { board_id });
export const createColumn = (body) => sendJson('POST', 'task-column/create', body);
export const updateColumn = (id, body) => sendJson('PUT', `task-column/update/${id}`, body);
export const archiveColumn = (id) => sendJson('PUT', `task-column/archive/${id}`, {});
export const reorderColumns = (body) => sendJson('PUT', 'task-column/reorder', body);

// Tasks
export const fetchTasks = (params) => getJson('task/get-all', params);
export const fetchTask = (id) => getJson(`task/get/${id}`);
export const createTask = (body) => sendJson('POST', 'task/create', body);
export const updateTask = (id, body) => sendJson('PUT', `task/update/${id}`, body);
export const moveTask = (id, body) => sendJson('PUT', `task/move/${id}`, body);
export const reorderTasks = (body) => sendJson('PUT', 'task/reorder', body);
export const bulkTasks = (body) => sendJson('PUT', 'task/bulk', body);
export const archiveTask = (id) => sendJson('PUT', `task/archive/${id}`, {});
export const deleteTask = (id) => sendJson('DELETE', `task/delete/${id}`);

export const addComment = (taskId, body) => sendJson('POST', `task/comments/${taskId}`, body);
export const updateComment = (taskId, commentId, body) =>
  sendJson('PUT', `task/comments/${taskId}/${commentId}`, body);
export const deleteComment = (taskId, commentId) =>
  sendJson('DELETE', `task/comments/${taskId}/${commentId}`);

export const addChecklist = (taskId, body) =>
  sendJson('POST', `task/checklists/${taskId}`, body);
export const updateChecklist = (taskId, checklistId, body) =>
  sendJson('PUT', `task/checklists/${taskId}/${checklistId}`, body);
export const deleteChecklist = (taskId, checklistId) =>
  sendJson('DELETE', `task/checklists/${taskId}/${checklistId}`);

export const fetchTaskActivity = (taskId) => getJson(`task/activity/${taskId}`);

export async function uploadTaskAttachment(taskId, file) {
  const formData = new FormData();
  formData.append('task_id', taskId);
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}task/upload-attachment`, {
    method: 'POST',
    headers: authOnlyHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export const deleteTaskAttachment = (taskId, attachmentId) =>
  sendJson('DELETE', `task/delete-attachment/${taskId}/${attachmentId}`);
