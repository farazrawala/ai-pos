/** Task management display constants. */

export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low', badgeClass: 'bg-secondary', dot: '#6c757d' },
  { value: 'medium', label: 'Medium', badgeClass: 'bg-info', dot: '#0dcaf0' },
  { value: 'high', label: 'High', badgeClass: 'bg-warning text-dark', dot: '#ffc107' },
  { value: 'urgent', label: 'Urgent', badgeClass: 'bg-danger', dot: '#dc3545' },
];

export const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'my', label: 'My Tasks' },
  { id: 'due_today', label: 'Due Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'high', label: 'High Priority' },
  { id: 'completed', label: 'Completed' },
];

export const BOARD_COLORS = [
  '#0d6efd',
  '#198754',
  '#fd7e14',
  '#6f42c1',
  '#dc3545',
  '#20c997',
  '#6610f2',
  '#0dcaf0',
];

export const ATTACHMENT_ACCEPT =
  'image/*,.pdf,.zip,.docx,.xlsx,.txt,application/pdf,application/zip';

export function getPriorityMeta(priority) {
  const key = String(priority || '').toLowerCase();
  return (
    TASK_PRIORITIES.find((p) => p.value === key) || {
      value: key || 'medium',
      label: priority || 'Medium',
      badgeClass: 'bg-secondary',
      dot: '#6c757d',
    }
  );
}

export function formatTaskDue(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isOverdue(task) {
  if (!task?.due_date || task.is_completed) return false;
  return new Date(task.due_date) < new Date();
}

export function checklistLabel(task) {
  const p = task?.checklist_progress;
  if (p && typeof p.total === 'number') {
    if (!p.total) return null;
    return `${p.completed}/${p.total}`;
  }
  let total = 0;
  let done = 0;
  for (const c of task?.checklists || []) {
    for (const item of c.items || []) {
      total += 1;
      if (item.is_completed) done += 1;
    }
  }
  if (!total) return null;
  return `${done}/${total}`;
}

export function userInitials(user) {
  const name = user?.name || user?.email || '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function userIdOf(user) {
  if (!user) return '';
  return String(user._id || user.id || user);
}
