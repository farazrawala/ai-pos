/** Keep only digits and at most one decimal point (max 2 decimal places). */
export function sanitizeAmountPaidInput(value) {
  const s = String(value ?? '').replace(/,/g, '');
  let out = '';
  let sawDot = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !sawDot) {
      out += ch;
      sawDot = true;
    }
  }
  const dot = out.indexOf('.');
  if (dot !== -1 && out.length - dot - 1 > 2) {
    out = out.slice(0, dot + 3);
  }
  return out;
}

/** Badge class for PO status in list and form views. */
export function poStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'completed' || s === 'posted' || s === 'delivered') {
    return 'bg-gradient-success';
  }
  if (s === 'pending' || s === 'draft' || s === 'placed') return 'bg-gradient-warning';
  if (s === 'cancelled' || s === 'void' || s === 'refunded') return 'bg-gradient-danger';
  return 'bg-gradient-secondary';
}

/** Common PO statuses — align with your API enum if different. */
export const PO_STATUS_OPTIONS = [
  'draft',
  'active',
  'placed',
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'completed',
  'refunded',
];
