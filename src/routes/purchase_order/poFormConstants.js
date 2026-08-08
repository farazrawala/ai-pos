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

/** Line-item add order on PO add/edit (same idea as POS cart). */
export const PO_LINE_ORDER_STORAGE_KEY = 'purchaseOrder.lineDisplayOrder';
export const PO_LINE_ORDER_FIFO = 'fifo';
export const PO_LINE_ORDER_LIFO = 'lifo';

export function readStoredPoLineOrder() {
  if (typeof window === 'undefined') return PO_LINE_ORDER_FIFO;
  try {
    const value = window.localStorage.getItem(PO_LINE_ORDER_STORAGE_KEY);
    if (value === PO_LINE_ORDER_LIFO || value === PO_LINE_ORDER_FIFO) return value;
  } catch {
    /* ignore */
  }
  return PO_LINE_ORDER_FIFO;
}

export function persistPoLineOrder(order) {
  if (typeof window === 'undefined') return;
  if (order !== PO_LINE_ORDER_FIFO && order !== PO_LINE_ORDER_LIFO) return;
  try {
    window.localStorage.setItem(PO_LINE_ORDER_STORAGE_KEY, order);
  } catch {
    /* ignore quota / private mode */
  }
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
