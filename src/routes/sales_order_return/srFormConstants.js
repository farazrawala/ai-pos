/** Line-item add order on sales return add/edit (same idea as POS cart / PO forms). */
export const SR_LINE_ORDER_STORAGE_KEY = 'salesReturn.lineDisplayOrder';
export const SR_LINE_ORDER_FIFO = 'fifo';
export const SR_LINE_ORDER_LIFO = 'lifo';

export function readStoredSrLineOrder() {
  if (typeof window === 'undefined') return SR_LINE_ORDER_FIFO;
  try {
    const value = window.localStorage.getItem(SR_LINE_ORDER_STORAGE_KEY);
    if (value === SR_LINE_ORDER_LIFO || value === SR_LINE_ORDER_FIFO) return value;
  } catch {
    /* ignore */
  }
  return SR_LINE_ORDER_FIFO;
}

export function persistSrLineOrder(order) {
  if (typeof window === 'undefined') return;
  if (order !== SR_LINE_ORDER_FIFO && order !== SR_LINE_ORDER_LIFO) return;
  try {
    window.localStorage.setItem(SR_LINE_ORDER_STORAGE_KEY, order);
  } catch {
    /* ignore quota / private mode */
  }
}

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
