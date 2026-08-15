import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { selectAuthUser } from '../../features/user/userSlice.js';
import {
  loadKanban,
  optimisticMoveTask,
  optimisticReorderColumns,
  persistMoveTask,
  setFilters,
} from '../../features/tasks/tasksSlice.js';
import * as api from '../../features/tasks/tasksAPI.js';
import TaskCard from '../../components/tasks/TaskCard.jsx';
import TaskFilters, {
  applyClientTaskFilters,
  sortTasksClient,
} from '../../components/tasks/TaskFilters.jsx';
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer.jsx';
import TaskListTable from '../../components/tasks/TaskListTable.jsx';
import AppModal from '../../components/AppModal.jsx';
import { TASK_PRIORITIES } from '../../features/tasks/tasksConstants.js';
import { toast } from '../../utils/toast.js';
import '../../styles/tasks-module.css';

function SortableTask({ task, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task._id}`,
    data: { type: 'task', task },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        className={isDragging ? 'is-dragging' : ''}
        dragHandleProps={{ ...attributes, ...listeners }}
        onClick={() => {
          if (isDragging) return;
          onOpen(task);
        }}
      />
    </div>
  );
}

function SortableColumn({ column, tasks, onOpenTask, onAddTask, canEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col:${column._id}`,
    data: { type: 'column', column },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`tasks-column ${isDragging ? 'is-dragging' : ''}`}>
      <div className="tasks-column-header" {...attributes} {...listeners}>
        <h6 className="tasks-column-title">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: column.color || '#6c757d',
              display: 'inline-block',
            }}
          />
          {column.name}
          <span className="tasks-column-count">{tasks.length}</span>
          {column.wip_limit ? (
            <span className="text-muted small">/ {column.wip_limit}</span>
          ) : null}
        </h6>
      </div>
      <SortableContext items={tasks.map((t) => `task:${t._id}`)} strategy={verticalListSortingStrategy}>
        <div className="tasks-column-body" data-column-id={column._id}>
          {tasks.map((task) => (
            <SortableTask key={task._id} task={task} onOpen={onOpenTask} />
          ))}
        </div>
      </SortableContext>
      {canEdit ? (
        <button type="button" className="btn btn-sm btn-link text-start mt-1" onClick={() => onAddTask(column._id)}>
          + Add Task
        </button>
      ) : null}
    </div>
  );
}

function parseDragId(id) {
  const raw = String(id);
  if (raw.startsWith('task:')) return { type: 'task', id: raw.slice(5) };
  if (raw.startsWith('col:')) return { type: 'column', id: raw.slice(4) };
  return { type: 'unknown', id: raw };
}

export default function BoardKanbanPage() {
  useRequireModuleAccess('tasks');
  const { boardId } = useParams();
  const { canCreate, canEdit, canDelete } = usePermissions('tasks');
  const dispatch = useDispatch();
  const currentUser = useSelector(selectAuthUser);
  const { kanbanBoard, kanbanColumns, kanbanLoading, kanbanError, filters, movePending } = useSelector(
    (s) => s.tasks,
  );

  const [viewMode, setViewMode] = useState('kanban');
  const [activeDrag, setActiveDrag] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addColumnId, setAddColumnId] = useState('');
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee_ids: [],
    labels: '',
    due_date: '',
  });
  const [columnName, setColumnName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const moveQueue = useRef(Promise.resolve());
  const snapshotRef = useRef(null);
  const columnsRef = useRef(kanbanColumns);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    columnsRef.current = kanbanColumns;
  }, [kanbanColumns]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const refresh = useCallback(() => {
    if (boardId) dispatch(loadKanban({ boardId }));
  }, [boardId, dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const members = kanbanBoard?.members || [];

  const filteredColumns = useMemo(() => {
    return (kanbanColumns || []).map((col) => {
      let tasks = applyClientTaskFilters(col.tasks || [], {
        search: filters.search,
        quick: filters.quick,
        priority: filters.priority,
        assigneeId: filters.assignee_id,
        currentUserId: currentUser?._id,
      });
      tasks = sortTasksClient(tasks, filters.sortBy);
      return { ...col, tasks };
    });
  }, [kanbanColumns, filters, currentUser]);

  const flatTasks = useMemo(
    () => filteredColumns.flatMap((c) => c.tasks.map((t) => ({ ...t, column_id: c }))),
    [filteredColumns],
  );

  const findColumnOfTask = (taskId, columns = columnsRef.current) => {
    for (const col of columns || []) {
      if ((col.tasks || []).some((t) => String(t._id) === String(taskId))) return col;
    }
    return null;
  };

  const moveTaskLocal = (columns, taskId, toColumnId, toIndex) => {
    const cols = columns.map((c) => ({ ...c, tasks: [...(c.tasks || [])] }));
    let task = null;
    for (const col of cols) {
      const idx = col.tasks.findIndex((t) => String(t._id) === String(taskId));
      if (idx >= 0) {
        [task] = col.tasks.splice(idx, 1);
        break;
      }
    }
    if (!task) return columns;
    const dest = cols.find((c) => String(c._id) === String(toColumnId));
    if (!dest) return columns;
    task = { ...task, column_id: toColumnId };
    dest.tasks.splice(Math.max(0, Math.min(toIndex, dest.tasks.length)), 0, task);
    return cols;
  };

  const onDragStart = (event) => {
    dragMovedRef.current = false;
    snapshotRef.current = {
      columns: JSON.parse(JSON.stringify(columnsRef.current)),
    };
    const parsed = parseDragId(event.active.id);
    if (parsed.type === 'task') {
      const col = findColumnOfTask(parsed.id);
      const task = col?.tasks?.find((t) => String(t._id) === parsed.id);
      setActiveDrag({ type: 'task', task });
    } else if (parsed.type === 'column') {
      const column = (columnsRef.current || []).find((c) => String(c._id) === parsed.id);
      setActiveDrag({ type: 'column', column });
    }
  };

  const onDragOver = (event) => {
    const { active, over } = event;
    if (!over || !canEdit) return;
    const a = parseDragId(active.id);
    const o = parseDragId(over.id);
    if (a.type !== 'task') return;

    let toColumnId = null;
    let toIndex = 0;
    const cols = columnsRef.current || [];

    if (o.type === 'task') {
      const overCol = findColumnOfTask(o.id, cols);
      if (!overCol) return;
      toColumnId = overCol._id;
      toIndex = (overCol.tasks || []).findIndex((t) => String(t._id) === o.id);
    } else if (o.type === 'column') {
      toColumnId = o.id;
      const col = cols.find((c) => String(c._id) === String(toColumnId));
      toIndex = col?.tasks?.length || 0;
    } else {
      return;
    }

    const fromCol = findColumnOfTask(a.id, cols);
    if (!fromCol) return;
    if (String(fromCol._id) === String(toColumnId)) {
      const fromIndex = fromCol.tasks.findIndex((t) => String(t._id) === a.id);
      if (fromIndex === toIndex || fromIndex === toIndex - 1) return;
    }

    dragMovedRef.current = true;
    columnsRef.current = moveTaskLocal(cols, a.id, toColumnId, toIndex);
    dispatch(optimisticMoveTask({ taskId: a.id, toColumnId, toIndex }));
  };

  const persistMove = (taskId) => {
    const col = findColumnOfTask(taskId, columnsRef.current);
    if (!col) return;
    const tasks = col.tasks || [];
    const idx = tasks.findIndex((t) => String(t._id) === String(taskId));
    const before = idx > 0 ? tasks[idx - 1] : null;
    const after = idx < tasks.length - 1 ? tasks[idx + 1] : null;
    const body = {
      column_id: col._id,
      before_task_id: before?._id || null,
      after_task_id: after?._id || null,
    };
    const snapshot = snapshotRef.current;
    moveQueue.current = moveQueue.current
      .then(() => dispatch(persistMoveTask({ taskId, body, snapshot })).unwrap())
      .catch((err) => {
        toast.error(err?.message || err || 'Move failed');
      });
  };

  const onDragEnd = async (event) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || !canEdit) return;
    const a = parseDragId(active.id);
    const o = parseDragId(over.id);

    if (a.type === 'column' && o.type === 'column') {
      const ids = (columnsRef.current || []).map((c) => String(c._id));
      const oldIndex = ids.indexOf(a.id);
      const newIndex = ids.indexOf(o.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(ids, oldIndex, newIndex);
      dispatch(optimisticReorderColumns(next));
      try {
        await api.reorderColumns({ board_id: boardId, column_ids: next });
      } catch (e) {
        toast.error(e.message || 'Column reorder failed');
        refresh();
      }
      return;
    }

    if (a.type === 'task' && dragMovedRef.current) {
      persistMove(a.id);
    }
  };

  const openAdd = (columnId) => {
    setAddColumnId(columnId || kanbanColumns[0]?._id || '');
    setAddForm({
      title: '',
      description: '',
      priority: 'medium',
      assignee_ids: [],
      labels: '',
      due_date: '',
    });
    setAddOpen(true);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.title.trim() || !addColumnId) return;
    try {
      await api.createTask({
        board_id: boardId,
        column_id: addColumnId,
        title: addForm.title.trim(),
        description: addForm.description,
        priority: addForm.priority,
        assignee_ids: addForm.assignee_ids,
        labels: addForm.labels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        due_date: addForm.due_date || null,
      });
      toast.success('Task created');
      setAddOpen(false);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Create failed');
    }
  };

  const addColumn = async () => {
    const name = columnName.trim();
    if (!name) return;
    try {
      await api.createColumn({ board_id: boardId, name });
      setColumnName('');
      refresh();
      toast.success('Column added');
    } catch (e) {
      toast.error(e.message || 'Failed to add column');
    }
  };

  const runBulk = async (action, extra = {}) => {
    if (!selectedIds.length) return;
    if ((action === 'delete' || action === 'archive') && !window.confirm('Confirm bulk action?')) return;
    try {
      await api.bulkTasks({ task_ids: selectedIds, action, ...extra });
      toast.success('Bulk update applied');
      setSelectedIds([]);
      refresh();
    } catch (e) {
      toast.error(e.message || 'Bulk failed');
    }
  };

  return (
    <div className="container-fluid py-3 tasks-module">
      <div className="tasks-page-header">
        <div>
          <Link to="/tasks/boards" className="small text-muted">
            ← Boards
          </Link>
          <h4 className="mb-0">{kanbanBoard?.name || 'Board'}</h4>
          <p className="text-muted mb-0 small">{kanbanBoard?.description}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {movePending ? <span className="small text-muted">Saving…</span> : null}
          {canEdit ? (
            <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
              <input
                className="form-control"
                placeholder="New column"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={addColumn}>
                Add
              </button>
            </div>
          ) : null}
          {canCreate ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openAdd()}>
              + Add Task
            </button>
          ) : null}
        </div>
      </div>

      <TaskFilters
        search={filters.search}
        onSearchChange={(v) => dispatch(setFilters({ search: v }))}
        quick={filters.quick}
        onQuickChange={(v) => dispatch(setFilters({ quick: v }))}
        priority={filters.priority}
        onPriorityChange={(v) => dispatch(setFilters({ priority: v }))}
        sortBy={filters.sortBy}
        onSortChange={(v) => dispatch(setFilters({ sortBy: v }))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        members={members}
        assigneeId={filters.assignee_id}
        onAssigneeChange={(v) => dispatch(setFilters({ assignee_id: v }))}
      />

      {kanbanError ? <div className="alert alert-danger">{kanbanError}</div> : null}

      {viewMode === 'list' ? (
        <>
          {selectedIds.length ? (
            <div className="d-flex gap-2 mb-2 flex-wrap">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 140 }}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) runBulk('priority', { priority: e.target.value });
                  e.target.value = '';
                }}
              >
                <option value="">Priority…</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 160 }}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) runBulk('move', { column_id: e.target.value });
                  e.target.value = '';
                }}
              >
                <option value="">Move to…</option>
                {kanbanColumns.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runBulk('complete')}>
                Complete
              </button>
              {canDelete ? (
                <>
                  <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => runBulk('archive')}>
                    Archive
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => runBulk('delete')}>
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          <TaskListTable
            tasks={flatTasks}
            loading={kanbanLoading}
            showBoard={false}
            selectedIds={selectedIds}
            onToggleSelect={(id) =>
              setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onToggleSelectAll={() => {
              const ids = flatTasks.map((t) => String(t._id));
              setSelectedIds((prev) => (prev.length === ids.length ? [] : ids));
            }}
            onOpenTask={(t) => setDetailTaskId(t._id)}
          />
        </>
      ) : (
        <div className="tasks-kanban-shell">
          {kanbanLoading ? (
            <div className="tasks-kanban-scroll">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="tasks-column">
                  <div className="tasks-skeleton-card mb-2" />
                  <div className="tasks-skeleton-card mb-2" />
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={canEdit ? onDragOver : undefined}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={filteredColumns.map((c) => `col:${c._id}`)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="tasks-kanban-scroll">
                  {filteredColumns.map((col) => (
                    <SortableColumn
                      key={col._id}
                      column={col}
                      tasks={col.tasks}
                      onOpenTask={(t) => setDetailTaskId(t._id)}
                      onAddTask={openAdd}
                      canEdit={canCreate || canEdit}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDrag?.type === 'task' && activeDrag.task ? (
                  <TaskCard task={activeDrag.task} className="is-dragging" />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      <TaskDetailDrawer
        open={!!detailTaskId}
        taskId={detailTaskId}
        columns={kanbanColumns}
        members={members}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setDetailTaskId(null)}
        onChanged={() => refresh()}
      />

      <AppModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Task"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="add-task-form" className="btn btn-primary btn-sm">
              Create
            </button>
          </>
        }
      >
        <form id="add-task-form" onSubmit={submitAdd}>
          <div className="mb-2">
            <label className="form-label">Title</label>
            <input
              className="form-control"
              required
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Column</label>
            <select
              className="form-select"
              value={addColumnId}
              onChange={(e) => setAddColumnId(e.target.value)}
            >
              {kanbanColumns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={addForm.priority}
                onChange={(e) => setAddForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Due date</label>
              <input
                type="date"
                className="form-control"
                value={addForm.due_date}
                onChange={(e) => setAddForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-2 mt-2">
            <label className="form-label">Assignees</label>
            <select
              className="form-select"
              multiple
              value={addForm.assignee_ids}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  assignee_ids: Array.from(e.target.selectedOptions).map((o) => o.value),
                }))
              }
            >
              {members.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Labels</label>
            <input
              className="form-control"
              placeholder="POS, Inventory"
              value={addForm.labels}
              onChange={(e) => setAddForm((f) => ({ ...f, labels: e.target.value }))}
            />
          </div>
        </form>
      </AppModal>
    </div>
  );
}
