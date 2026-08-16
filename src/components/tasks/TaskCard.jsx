import {
  FaCheckDouble,
  FaClock,
  FaCommentDots,
  FaPaperclip,
} from 'react-icons/fa6';
import {
  checklistLabel,
  formatTaskDue,
  getLabelStyle,
  getPriorityMeta,
  isOverdue,
  userInitials,
} from '../../features/tasks/tasksConstants.js';

function parseChecklist(task) {
  const label = checklistLabel(task);
  if (!label) return null;
  const [completed, total] = label.split('/').map(Number);
  return { label, completed, total, done: total > 0 && completed === total };
}

export default function TaskCard({ task, dragHandleProps, style, className = '', onClick }) {
  const priority = getPriorityMeta(task.priority);
  const due = formatTaskDue(task.due_date);
  const overdue = isOverdue(task);
  const checklist = parseChecklist(task);
  const assignees = task.assignee_ids || [];
  const attachmentCount = task.attachments_count || task.attachments?.length || 0;
  const labels = task.labels || [];

  return (
    <div
      className={`tasks-card ${className}`}
      style={style}
      onClick={onClick}
      {...dragHandleProps}
    >
      <div className="tasks-card-labels">
        <span
          className="tasks-label-chip"
          style={{ background: priority.chipBg, color: priority.chipColor }}
        >
          {priority.label}
        </span>
        {labels.slice(0, 3).map((label) => {
          const tone = getLabelStyle(label);
          return (
            <span
              key={label}
              className="tasks-label-chip"
              style={{ background: tone.bg, color: tone.color }}
            >
              {label}
            </span>
          );
        })}
      </div>

      <p className="tasks-card-title">
        <span className="tasks-card-number">#{task.task_number}</span>
        {task.title}
      </p>

      <div className="tasks-card-footer">
        <div className="tasks-card-stats">
          {due ? (
            <span className={`tasks-card-stat ${overdue ? 'tasks-due-overdue' : ''}`} title="Due date">
              <FaClock size={11} />
              {due}
            </span>
          ) : null}
          {attachmentCount > 0 ? (
            <span className="tasks-card-stat" title="Attachments">
              <FaPaperclip size={11} />
              {attachmentCount}
            </span>
          ) : null}
          {task.comments_count > 0 ? (
            <span className="tasks-card-stat" title="Comments">
              <FaCommentDots size={11} />
              {task.comments_count}
            </span>
          ) : null}
          {checklist ? (
            <span
              className={`tasks-card-stat ${checklist.done ? 'tasks-checklist-done' : ''}`}
              title="Checklist"
            >
              <FaCheckDouble size={11} />
              {checklist.label}
            </span>
          ) : null}
        </div>

        {assignees.length ? (
          <span className="tasks-avatar-stack">
            {assignees.slice(0, 3).map((u) => (
              <span key={u._id || u} className="tasks-avatar" title={u.name || u.email || ''}>
                {userInitials(u)}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
