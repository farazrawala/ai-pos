import moment from 'moment';

export function formatChatTime(value) {
  if (!value) return '';
  const m = moment(value);
  if (!m.isValid()) return '';
  const now = moment();
  if (m.isSame(now, 'day')) return m.format('h:mm a');
  if (m.isSame(now.clone().subtract(1, 'day'), 'day')) return 'Yesterday';
  if (m.isAfter(now.clone().subtract(7, 'days'))) return m.format('ddd');
  return m.format('DD/MM/YYYY');
}

export function formatMessageClock(value) {
  if (!value) return '';
  const m = moment(value);
  return m.isValid() ? m.format('h:mm a') : '';
}

export function formatDateLabel(value) {
  if (!value) return '';
  const m = moment(value);
  if (!m.isValid()) return '';
  const now = moment();
  if (m.isSame(now, 'day')) return 'Today';
  if (m.isSame(now.clone().subtract(1, 'day'), 'day')) return 'Yesterday';
  return m.format('MMMM D, YYYY');
}

export function contactInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Group messages with date separators for chronological display. */
export function groupMessagesByDate(messages) {
  const groups = [];
  let currentKey = null;
  let current = null;

  for (const msg of messages || []) {
    const key = msg.timestamp ? moment(msg.timestamp).format('YYYY-MM-DD') : 'unknown';
    if (key !== currentKey) {
      currentKey = key;
      current = {
        key,
        label: formatDateLabel(msg.timestamp) || 'Unknown',
        messages: [],
      };
      groups.push(current);
    }
    current.messages.push(msg);
  }
  return groups;
}

export function deliveryTicks(status) {
  const s = String(status || '').toLowerCase().replace(/[\s_-]/g, '');
  if (s === 'read') return { kind: 'ticks', text: '✓✓', className: 'wa-ticks read', title: 'Read' };
  if (s === 'delivered') {
    return { kind: 'ticks', text: '✓✓', className: 'wa-ticks', title: 'Delivered' };
  }
  if (s === 'sent' || s === 'success' || s === 'completed') {
    return { kind: 'ticks', text: '✓✓', className: 'wa-ticks', title: 'Sent' };
  }
  if (
    s === 'notstarted' ||
    s === 'pending' ||
    s === 'queued' ||
    s === 'inprocess' ||
    s === 'inprogress' ||
    s === 'processing' ||
    s === 'sending'
  ) {
    return { kind: 'icon', icon: 'clock', className: 'wa-ticks wa-ticks-pending', title: 'Sending' };
  }
  if (s === 'failed' || s === 'error') {
    return { kind: 'none', text: '', className: 'wa-ticks', title: 'Failed' };
  }
  return { kind: 'none', text: '', className: 'wa-ticks', title: '' };
}

/** Highlight case-insensitive matches inside text. */
export function highlightText(text, query) {
  const source = String(text ?? '');
  const q = String(query || '').trim();
  if (!q) return source;
  const lower = source.toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let start = 0;
  let idx = lower.indexOf(needle, start);
  let key = 0;
  while (idx !== -1) {
    if (idx > start) parts.push(source.slice(start, idx));
    parts.push(
      <mark key={`h-${key++}`} className="wa-highlight">
        {source.slice(idx, idx + needle.length)}
      </mark>
    );
    start = idx + needle.length;
    idx = lower.indexOf(needle, start);
  }
  if (start < source.length) parts.push(source.slice(start));
  return parts.length ? parts : source;
}
