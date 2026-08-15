import {
  checklistLabel,
  formatTaskDue,
  getPriorityMeta,
  isOverdue,
  userInitials,
} from '../../features/tasks/tasksConstants.js';

export default function TaskCard({ task, dragHandleProps, style, className = '', onClick }) {
  const priority = getPriorityMeta(task.priority);
  const due = formatTaskDue(task.due_date);
  const overdue = isOverdue(task);
  const checklist = checklistLabel(task);
  const assignees = task.assignee_ids || [];

  return (
    <div
      className={`tasks-card ${className}`}
      style={style}
      onClick={onClick}
      {...dragHandleProps}
    >
      <p className="tasks-card-title">
        <span className="text-muted me-1">#{task.task_number}</span>
        {task.title}
      </p>
      <div className="tasks-card-meta mb-1">
        <span className={`badge ${priority.badgeClass}`}>
          <span className="tasks-priority-dot me-1" style={{ background: priority.dot }} />
          {priority.label}
        </span>
        {(task.labels || []).slice(0, 3).map((label) => (
          <span key={label} className="tasks-label-chip">
            #{label}
          </span>
        ))}
      </div>
      <div className="tasks-card-meta justify-content-between">
        <div className="d-flex align-items-center gap-2">
          {checklist ? <span title="Checklist">☑ {checklist}</span> : null}
          {task.comments_count > 0 ? <span title="Comments">💬 {task.comments_count}</span> : null}
          {(task.attachments_count || task.attachments?.length) > 0 ? (
            <span title="Attachments">
              📎 {task.attachments_count || task.attachments.length}
            </span>
          ) : null}
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="tasks-avatar-stack">
            {assignees.slice(0, 3).map((u) => (
              <span key={u._id || u} className="tasks-avatar" title={u.name || u.email || ''}>
                {userInitials(u)}
              </span>
            ))}
          </span>
          {due ? (
            <span className={overdue ? 'tasks-due-overdue' : ''} title="Due date">
              📅 {due}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
