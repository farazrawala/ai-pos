import {
  FaListUl,
  FaTableCellsLarge,
} from 'react-icons/fa6';
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
        style={{ maxWidth: 200 }}
        placeholder="Search tasks…"
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
        style={{ maxWidth: 130 }}
        value={priority || ''}
        onChange={(e) => onPriorityChange?.(e.target.value)}
      >
        <option value="">Priority</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {onAssigneeChange ? (
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 150 }}
          value={assigneeId || ''}
          onChange={(e) => onAssigneeChange(e.target.value)}
        >
          <option value="">Assignee</option>
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
          style={{ maxWidth: 130 }}
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
        <div className="tasks-view-toggle ms-auto">
          <button
            type="button"
            className={`tasks-icon-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            title="Board view"
            onClick={() => onViewModeChange('kanban')}
          >
            <FaTableCellsLarge size={14} />
          </button>
          <button
            type="button"
            className={`tasks-icon-btn ${viewMode === 'list' ? 'active' : ''}`}
            title="List view"
            onClick={() => onViewModeChange('list')}
          >
            <FaListUl size={14} />
          </button>
        </div>
      ) : null}
      {extra}
    </div>
  );
}
