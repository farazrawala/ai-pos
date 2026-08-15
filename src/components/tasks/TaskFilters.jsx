import { QUICK_FILTERS, TASK_PRIORITIES } from '../../features/tasks/tasksConstants.js';

export default function TaskFilters({
  search,
  onSearchChange,
  quick,
  onQuickChange,
  priority,
  onPriorityChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  members = [],
  assigneeId,
  onAssigneeChange,
  extra,
}) {
  return (
    <div className="tasks-filters">
      <input
        type="search"
        className="form-control form-control-sm"
        style={{ maxWidth: 220 }}
        placeholder="Search title or #…"
        value={search || ''}
        onChange={(e) => onSearchChange?.(e.target.value)}
      />
      <div className="d-flex flex-wrap gap-1">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`tasks-quick-chip ${quick === f.id ? 'active' : ''}`}
            onClick={() => onQuickChange?.(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <select
        className="form-select form-select-sm"
        style={{ maxWidth: 140 }}
        value={priority || ''}
        onChange={(e) => onPriorityChange?.(e.target.value)}
      >
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {onAssigneeChange ? (
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 160 }}
          value={assigneeId || ''}
          onChange={(e) => onAssigneeChange(e.target.value)}
        >
          <option value="">All assignees</option>
          {members.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name || m.email}
            </option>
          ))}
        </select>
      ) : null}
      {onSortChange ? (
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 150 }}
          value={sortBy || 'position'}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="position">Manual</option>
          <option value="priority">Priority</option>
          <option value="due_date">Due date</option>
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
        </select>
      ) : null}
      {onViewModeChange ? (
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className={`btn ${viewMode === 'kanban' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => onViewModeChange('kanban')}
          >
            Kanban
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => onViewModeChange('list')}
          >
            List
          </button>
        </div>
      ) : null}
      {extra}
    </div>
  );
}

export function applyClientTaskFilters(tasks, { search, quick, priority, assigneeId, currentUserId }) {
  const q = String(search || '').trim().toLowerCase();
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return (tasks || []).filter((task) => {
    if (priority && task.priority !== priority) return false;
    if (assigneeId) {
      const ids = (task.assignee_ids || []).map((a) => String(a._id || a));
      if (!ids.includes(String(assigneeId))) return false;
    }
    if (q) {
      const hay = `${task.title || ''} ${task.task_number || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (quick === 'my' && currentUserId) {
      const ids = (task.assignee_ids || []).map((a) => String(a._id || a));
      if (!ids.includes(String(currentUserId)) && String(task.created_by?._id || task.created_by) !== String(currentUserId)) {
        return false;
      }
    }
    if (quick === 'due_today') {
      if (!task.due_date) return false;
      const d = new Date(task.due_date);
      if (d < start || d > end) return false;
    }
    if (quick === 'overdue') {
      if (!task.due_date || task.is_completed) return false;
      if (new Date(task.due_date) >= now) return false;
    }
    if (quick === 'high') {
      if (task.priority !== 'high' && task.priority !== 'urgent') return false;
    }
    if (quick === 'completed' && !task.is_completed) return false;
    return true;
  });
}

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

export function sortTasksClient(tasks, sortBy) {
  const list = [...(tasks || [])];
  if (!sortBy || sortBy === 'position') {
    return list.sort((a, b) => (a.position || 0) - (b.position || 0));
  }
  if (sortBy === 'priority') {
    return list.sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
    );
  }
  return list.sort((a, b) => {
    const av = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
    const bv = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
    return av - bv;
  });
}
