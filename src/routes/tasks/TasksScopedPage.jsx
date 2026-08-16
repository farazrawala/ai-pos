import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaBoxArchive, FaCheck, FaTrashCan } from 'react-icons/fa6';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { loadTaskList } from '../../features/tasks/tasksSlice.js';
import * as api from '../../features/tasks/tasksAPI.js';
import TaskFilters from '../../components/tasks/TaskFilters.jsx';
import TaskListTable from '../../components/tasks/TaskListTable.jsx';
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer.jsx';
import TablePagination from '../../components/TablePagination.jsx';
import { TASK_PRIORITIES } from '../../features/tasks/tasksConstants.js';
import { toast } from '../../utils/toast.js';
import '../../styles/tasks-module.css';

const SCOPE_META = {
  my_tasks: { title: 'My Tasks', scope: 'my_tasks' },
  assigned_to_me: { title: 'Assigned to Me', scope: 'assigned_to_me' },
  created_by_me: { title: 'Created by Me', scope: 'created_by_me' },
  completed: { title: 'Completed Tasks', scope: 'completed' },
};

export default function TasksScopedPage({ scopeKey = 'my_tasks' }) {
  useRequireModuleAccess('tasks');
  const meta = SCOPE_META[scopeKey] || SCOPE_META.my_tasks;
  const { canEdit, canDelete } = usePermissions('tasks');
  const dispatch = useDispatch();
  const { taskList, taskListLoading, taskListPagination } = useSelector((s) => s.tasks);

  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState('all');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [page, setPage] = useState(1);
  const limit = 25;
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [group, setGroup] = useState('all');

  const params = useMemo(() => {
    const p = {
      scope: meta.scope,
      skip: (page - 1) * limit,
      limit,
      sortBy,
      sortOrder: 'desc',
      search: search || undefined,
      priority: priority || undefined,
    };
    if (quick === 'due_today') p.due = 'today';
    if (quick === 'overdue') p.due = 'overdue';
    if (quick === 'high') p.priority = p.priority || 'high';
    if (quick === 'completed' || scopeKey === 'completed') p.is_completed = 'true';
    if (group === 'today') p.due = 'today';
    if (group === 'upcoming') p.due = 'upcoming';
    if (group === 'overdue') p.due = 'overdue';
    if (group === 'completed') p.is_completed = 'true';
    return p;
  }, [meta.scope, page, search, priority, sortBy, quick, group, scopeKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(loadTaskList(params));
    }, 250);
    return () => clearTimeout(t);
  }, [dispatch, params]);

  const runBulk = async (action, extra = {}) => {
    if (!selectedIds.length) return;
    const count = selectedIds.length;
    const noun = count === 1 ? 'task' : 'tasks';
    if (action === 'delete' && !window.confirm(`Permanently delete ${count} ${noun}?`)) return;
    if (action === 'archive' && !window.confirm(`Archive ${count} ${noun}?`)) return;
    try {
      await api.bulkTasks({ task_ids: selectedIds, action, ...extra });
      toast.success('Updated');
      setSelectedIds([]);
      dispatch(loadTaskList(params));
    } catch (e) {
      toast.error(e.message || 'Bulk failed');
    }
  };

  const archiveOne = async (task) => {
    if (!window.confirm(`Archive task #${task.task_number}?`)) return;
    try {
      await api.archiveTask(task._id);
      toast.success('Task archived');
      setSelectedIds((prev) => prev.filter((id) => id !== String(task._id)));
      dispatch(loadTaskList(params));
    } catch (e) {
      toast.error(e.message || 'Archive failed');
    }
  };

  const deleteOne = async (task) => {
    if (!window.confirm(`Permanently delete task #${task.task_number} "${task.title}"?`)) return;
    try {
      await api.deleteTask(task._id);
      toast.success('Task deleted');
      setSelectedIds((prev) => prev.filter((id) => id !== String(task._id)));
      dispatch(loadTaskList(params));
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  return (
    <div className="tasks-module tasks-workspace">
      <div className="tasks-page-header">
        <div>
          <h4 className="mb-0">{meta.title}</h4>
          <p className="text-muted mb-0 small">List view with filters and bulk actions</p>
        </div>
      </div>

      <TaskFilters
        search={search}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        quick={quick}
        onQuickChange={(v) => {
          setPage(1);
          setQuick(v);
        }}
        priority={priority}
        onPriorityChange={(v) => {
          setPage(1);
          setPriority(v);
        }}
        sortBy={sortBy}
        onSortChange={setSortBy}
        extra={
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 150 }}
            value={group}
            onChange={(e) => {
              setPage(1);
              setGroup(e.target.value);
            }}
          >
            <option value="all">All groups</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </select>
        }
      />

      {selectedIds.length && canEdit ? (
        <div className="tasks-bulk-bar">
          <span className="tasks-bulk-count">
            {selectedIds.length} selected
          </span>
          <select
            className="tasks-bulk-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) runBulk('priority', { priority: e.target.value });
              e.target.value = '';
            }}
          >
            <option value="">Set priority…</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" className="tasks-bulk-btn tasks-bulk-btn-success" onClick={() => runBulk('complete')}>
            <FaCheck size={11} aria-hidden />
            Mark completed
          </button>
          {canDelete ? (
            <>
              <button type="button" className="tasks-bulk-btn tasks-bulk-btn-warning" onClick={() => runBulk('archive')}>
                <FaBoxArchive size={11} aria-hidden />
                Archive
              </button>
              <button type="button" className="tasks-bulk-btn tasks-bulk-btn-danger" onClick={() => runBulk('delete')}>
                <FaTrashCan size={11} aria-hidden />
                Delete
              </button>
            </>
          ) : null}
          <button type="button" className="tasks-bulk-clear" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="tasks-list-panel">
        <TaskListTable
          tasks={taskList}
          loading={taskListLoading}
          selectedIds={selectedIds}
          onToggleSelect={(id) =>
            setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onToggleSelectAll={() => {
            const ids = taskList.map((t) => String(t._id));
            setSelectedIds((prev) => (prev.length === ids.length ? [] : ids));
          }}
          onOpenTask={(t) => setDetailTaskId(t._id)}
          onArchiveTask={canDelete ? archiveOne : undefined}
          onDeleteTask={deleteOne}
          canDelete={canDelete}
        />
      </div>

      <div className="mt-3">
        <TablePagination
          pagination={{
            page,
            limit,
            total: taskListPagination?.total || 0,
          }}
          onPageChange={setPage}
        />
      </div>

      <TaskDetailDrawer
        open={!!detailTaskId}
        taskId={detailTaskId}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setDetailTaskId(null)}
        onChanged={() => dispatch(loadTaskList(params))}
      />
    </div>
  );
}
