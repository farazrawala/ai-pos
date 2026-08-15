import { formatTaskDue, getPriorityMeta, userInitials } from '../../features/tasks/tasksConstants.js';

export default function TaskListTable({
  tasks = [],
  loading,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onOpenTask,
  showBoard = true,
}) {
  if (loading) {
    return <div className="text-muted p-3">Loading tasks…</div>;
  }

  if (!tasks.length) {
    return (
      <div className="text-center text-muted py-5 border rounded bg-white">
        No tasks match your filters.
      </div>
    );
  }

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(String(t._id)));

  return (
    <div className="table-responsive bg-white border rounded">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
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
            <th />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const priority = getPriorityMeta(task.priority);
            const id = String(task._id);
            return (
              <tr key={id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(id)}
                    onChange={() => onToggleSelect?.(id)}
                  />
                </td>
                <td>#{task.task_number}</td>
                <td>
                  <button type="button" className="btn btn-link p-0 text-start" onClick={() => onOpenTask?.(task)}>
                    {task.title}
                  </button>
                </td>
                {showBoard ? <td>{task.board_id?.name || '—'}</td> : null}
                <td>{task.column_id?.name || task.status || '—'}</td>
                <td>
                  <span className={`badge ${priority.badgeClass}`}>{priority.label}</span>
                </td>
                <td>
                  <div className="d-flex gap-1">
                    {(task.assignee_ids || []).slice(0, 3).map((u) => (
                      <span key={u._id || u} className="tasks-avatar" title={u.name}>
                        {userInitials(u)}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{formatTaskDue(task.due_date) || '—'}</td>
                <td>{task.created_by?.name || '—'}</td>
                <td className="small text-muted">
                  {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenTask?.(task)}>
                    Open
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
