import { FaBoxArchive, FaTrashCan } from 'react-icons/fa6';
import {
  formatTaskDue,
  getPriorityMeta,
  isOverdue,
  userInitials,
} from '../../features/tasks/tasksConstants.js';

export default function TaskListTable({
  tasks = [],
  loading,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onOpenTask,
  onArchiveTask,
  onDeleteTask,
  canDelete = false,
  showBoard = true,
}) {
  if (loading) {
    return (
      <div className="tasks-table-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="tasks-skeleton-card" style={{ height: 44 }} />
        ))}
      </div>
    );
  }

  if (!tasks.length) {
    return <div className="tasks-empty-state">No tasks match your filters.</div>;
  }

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(String(t._id)));
  const showActions = !!(onArchiveTask || (canDelete && onDeleteTask));

  return (
    <div className="tasks-table-wrap">
      <table className="tasks-table">
        <thead>
          <tr>
            <th className="tasks-table-check">
              <input
                type="checkbox"
                aria-label="Select all tasks"
                checked={allSelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <th>Task #</th>
            <th>Task</th>
            {showBoard ? <th>Board</th> : null}
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Due</th>
            <th>Created by</th>
            <th>Updated</th>
            <th className="tasks-table-actions-head">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const priority = getPriorityMeta(task.priority);
            const id = String(task._id);
            const selected = selectedIds.includes(id);
            const due = formatTaskDue(task.due_date);
            const overdue = isOverdue(task);
            const assignees = task.assignee_ids || [];
            return (
              <tr key={id} className={selected ? 'is-selected' : ''}>
                <td className="tasks-table-check">
                  <input
                    type="checkbox"
                    aria-label={`Select task ${task.task_number}`}
                    checked={selected}
                    onChange={() => onToggleSelect?.(id)}
                  />
                </td>
                <td className="tasks-table-number">#{task.task_number}</td>
                <td>
                  <button
                    type="button"
                    className={`tasks-table-title ${task.is_completed ? 'is-done' : ''}`}
                    onClick={() => onOpenTask?.(task)}
                  >
                    {task.title}
                  </button>
                </td>
                {showBoard ? <td className="tasks-table-muted">{task.board_id?.name || '—'}</td> : null}
                <td>
                  <span className="tasks-status-pill">{task.column_id?.name || task.status || '—'}</span>
                </td>
                <td>
                  <span
                    className="tasks-label-chip"
                    style={{ background: priority.chipBg, color: priority.chipColor }}
                  >
                    {priority.label}
                  </span>
                </td>
                <td>
                  {assignees.length ? (
                    <div className="tasks-avatar-stack">
                      {assignees.slice(0, 3).map((u) => (
                        <span key={u._id || u} className="tasks-avatar" title={u.name || u.email}>
                          {userInitials(u)}
                        </span>
                      ))}
                      {assignees.length > 3 ? (
                        <span className="tasks-avatar tasks-avatar-more">+{assignees.length - 3}</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="tasks-table-muted">—</span>
                  )}
                </td>
                <td className={overdue ? 'tasks-due-overdue fw-semibold' : ''}>{due || '—'}</td>
                <td className="tasks-table-muted">{task.created_by?.name || '—'}</td>
                <td className="tasks-table-muted">
                  {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  <div className="tasks-row-actions">
                    <button
                      type="button"
                      className="tasks-row-btn tasks-row-btn-open"
                      onClick={() => onOpenTask?.(task)}
                    >
                      Open
                    </button>
                    {showActions ? (
                      <>
                        {onArchiveTask ? (
                          <button
                            type="button"
                            className="tasks-row-btn tasks-row-btn-icon"
                            title="Archive task"
                            aria-label={`Archive task ${task.task_number}`}
                            onClick={() => onArchiveTask(task)}
                          >
                            <FaBoxArchive size={12} />
                          </button>
                        ) : null}
                        {canDelete && onDeleteTask ? (
                          <button
                            type="button"
                            className="tasks-row-btn tasks-row-btn-icon tasks-row-btn-danger"
                            title="Delete task"
                            aria-label={`Delete task ${task.task_number}`}
                            onClick={() => onDeleteTask(task)}
                          >
                            <FaTrashCan size={12} />
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
