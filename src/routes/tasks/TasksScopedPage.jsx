import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
    if ((action === 'delete' || action === 'archive') && !window.confirm('Confirm bulk action?')) return;
    try {
      await api.bulkTasks({ task_ids: selectedIds, action, ...extra });
      toast.success('Updated');
      setSelectedIds([]);
      dispatch(loadTaskList(params));
    } catch (e) {
      toast.error(e.message || 'Bulk failed');
    }
  };

  return (
    <div className="container-fluid py-3 tasks-module">
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
            <option value="">Set priority…</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runBulk('complete')}>
            Mark completed
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
      />

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
