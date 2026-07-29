/** Ticket status values and display metadata. */
export const TICKET_STATUSES = [
  { value: 'open', label: 'Open', badgeClass: 'bg-success' },
  { value: 'pending', label: 'Pending', badgeClass: 'bg-warning text-dark' },
  { value: 'waiting_for_user', label: 'Waiting for User', badgeClass: 'bg-info' },
  { value: 'waiting_for_admin', label: 'Waiting for Admin', badgeClass: 'bg-primary' },
  { value: 'resolved', label: 'Resolved', badgeClass: 'bg-secondary' },
  { value: 'closed', label: 'Closed', badgeClass: 'bg-dark' },
];

/** Ticket priority values and display metadata. */
export const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', badgeClass: 'bg-secondary' },
  { value: 'medium', label: 'Medium', badgeClass: 'bg-info' },
  { value: 'high', label: 'High', badgeClass: 'bg-warning text-dark' },
  { value: 'urgent', label: 'Urgent', badgeClass: 'bg-danger' },
];

/** Ticket category options. */
export const TICKET_CATEGORIES = [
  'General',
  'Billing',
  'Technical',
  'Sales',
  'Feature Request',
  'Bug Report',
  'Other',
];

/** Allowed attachment MIME types / extensions. */
export const ATTACHMENT_ACCEPT =
  'image/*,.pdf,.zip,.docx,application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const ATTACHMENT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.zip', '.docx'];

export function getStatusMeta(status) {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '_');
  return (
    TICKET_STATUSES.find((s) => s.value === key) || {
      value: key || 'unknown',
      label: status || 'Unknown',
      badgeClass: 'bg-secondary',
    }
  );
}

export function getPriorityMeta(priority) {
  const key = String(priority || '').toLowerCase();
  return (
    TICKET_PRIORITIES.find((p) => p.value === key) || {
      value: key || 'unknown',
      label: priority || 'Unknown',
      badgeClass: 'bg-secondary',
    }
  );
}

export function formatTicketId(ticket) {
  if (!ticket) return '—';
  const explicit = ticket.ticket_number || ticket.ticketNumber || ticket.ticket_id;
  if (explicit) return String(explicit).startsWith('#') ? String(explicit) : `#${explicit}`;
  const id = ticket._id || ticket.id;
  if (!id) return '—';
  const s = String(id);
  return `#${s.slice(-8).toUpperCase()}`;
}

export function getTicketId(ticket) {
  return ticket?._id ?? ticket?.id ?? '';
}

export function personDisplayName(ref) {
  if (ref == null || ref === '') return '—';
  if (typeof ref === 'object') {
    const name = String(ref.name ?? '').trim();
    if (name) return name;
    const email = String(ref.email ?? '').trim();
    if (email) return email;
    return '—';
  }
  return '—';
}

export function personEmail(ref) {
  if (ref == null || typeof ref !== 'object') return '';
  return String(ref.email ?? '').trim();
}

export function isAttachmentAllowed(file) {
  if (!file?.name) return false;
  const name = String(file.name).toLowerCase();
  const okExt = ATTACHMENT_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!okExt) return false;
  if (file.size > ATTACHMENT_MAX_BYTES) return false;
  return true;
}
