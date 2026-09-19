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

/** Line-item display order on PO / PO-return add/edit (same idea as POS cart). */
export const PO_LINE_ORDER_STORAGE_KEY = 'purchaseOrder.lineDisplayOrder';
export const PO_LINE_ORDER_FIFO = 'fifo';
export const PO_LINE_ORDER_LIFO = 'lifo';
export const PO_LINE_ORDER_AMOUNT_ASC = 'amount_asc';
export const PO_LINE_ORDER_AMOUNT_DESC = 'amount_desc';
export const PO_LINE_ORDER_AMOUNT = 'amount';
export const PO_LINE_ORDER_PRICE_ASC = 'price_asc';
export const PO_LINE_ORDER_PRICE_DESC = 'price_desc';
export const PO_LINE_ORDER_MODES = new Set([
  PO_LINE_ORDER_FIFO,
  PO_LINE_ORDER_LIFO,
  PO_LINE_ORDER_AMOUNT_ASC,
  PO_LINE_ORDER_AMOUNT_DESC,
  PO_LINE_ORDER_AMOUNT,
  PO_LINE_ORDER_PRICE_ASC,
  PO_LINE_ORDER_PRICE_DESC,
]);

export function isPoLineAmountOrder(order) {
  return (
    order === PO_LINE_ORDER_AMOUNT_ASC ||
    order === PO_LINE_ORDER_AMOUNT_DESC ||
    order === PO_LINE_ORDER_AMOUNT
  );
}

export function isPoLinePriceOrder(order) {
  return order === PO_LINE_ORDER_PRICE_ASC || order === PO_LINE_ORDER_PRICE_DESC;
}

export function isPoLineValueOrder(order) {
  return isPoLineAmountOrder(order) || isPoLinePriceOrder(order);
}

function parsePoLineNumber(raw) {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const roundPoMoney2 = (n) => Math.round(n * 100) / 100;

/** Base product rate (Rate column) — used by Price sort. */
export function poLinePrice(line) {
  return parsePoLineNumber(line?.rate);
}

/** Displayed line amount (final rate × qty) — used by Amount sort. */
export function poLineAmount(line) {
  const qty = parsePoLineNumber(line?.qty);
  const baseRate = parsePoLineNumber(line?.rate);
  const tsRaw = String(line?.totalShipping ?? '').trim();
  if (tsRaw === '') return roundPoMoney2(qty * baseRate);
  const totalShippingNum = roundPoMoney2(parsePoLineNumber(tsRaw));
  const shippingPerUnit = qty > 0 ? roundPoMoney2(totalShippingNum / qty) : 0;
  const finalRate = roundPoMoney2(baseRate + shippingPerUnit);
  return roundPoMoney2(finalRate * qty);
}

export function nextPoLineSeq(lines) {
  let max = -1;
  for (const line of lines || []) {
    const n = Number(line?.addedSeq);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Fill missing insertion order so FIFO/LIFO still work after price/amount sorts. */
export function ensurePoLineSeq(lines, currentOrder) {
  if (!Array.isArray(lines) || lines.length === 0) return lines || [];
  if (lines.every((line) => Number.isFinite(Number(line?.addedSeq)))) return lines;
  const n = lines.length;
  return lines.map((line, i) => {
    if (Number.isFinite(Number(line?.addedSeq))) return line;
    const addedSeq = currentOrder === PO_LINE_ORDER_LIFO ? n - 1 - i : i;
    return { ...line, addedSeq };
  });
}

export function sortPoLinesByOrder(lines, order) {
  if (!Array.isArray(lines) || lines.length <= 1) return lines;
  const copy = [...lines];
  const seq = (line) => Number(line?.addedSeq) || 0;
  if (order === PO_LINE_ORDER_AMOUNT_ASC) {
    copy.sort((a, b) => poLineAmount(a) - poLineAmount(b) || seq(a) - seq(b));
    return copy;
  }
  if (order === PO_LINE_ORDER_AMOUNT_DESC || order === PO_LINE_ORDER_AMOUNT) {
    copy.sort((a, b) => poLineAmount(b) - poLineAmount(a) || seq(a) - seq(b));
    return copy;
  }
  if (order === PO_LINE_ORDER_PRICE_ASC) {
    copy.sort((a, b) => poLinePrice(a) - poLinePrice(b) || seq(a) - seq(b));
    return copy;
  }
  if (order === PO_LINE_ORDER_PRICE_DESC) {
    copy.sort((a, b) => poLinePrice(b) - poLinePrice(a) || seq(a) - seq(b));
    return copy;
  }
  if (order === PO_LINE_ORDER_LIFO) {
    copy.sort((a, b) => seq(b) - seq(a));
    return copy;
  }
  copy.sort((a, b) => seq(a) - seq(b));
  return copy;
}

export function applyPoLineOrder(lines, order) {
  return sortPoLinesByOrder(ensurePoLineSeq(lines, order), order);
}

export function insertPoLine(prev, newLine, order) {
  const withSeq = { ...newLine, addedSeq: nextPoLineSeq(prev) };
  if (isPoLineValueOrder(order)) {
    return sortPoLinesByOrder([...prev, withSeq], order);
  }
  return order === PO_LINE_ORDER_LIFO ? [withSeq, ...prev] : [...prev, withSeq];
}

export function readStoredPoLineOrder() {
  if (typeof window === 'undefined') return PO_LINE_ORDER_FIFO;
  try {
    const value = window.localStorage.getItem(PO_LINE_ORDER_STORAGE_KEY);
    if (value === PO_LINE_ORDER_AMOUNT) return PO_LINE_ORDER_AMOUNT_DESC;
    if (PO_LINE_ORDER_MODES.has(value)) return value;
  } catch {
    /* ignore */
  }
  return PO_LINE_ORDER_FIFO;
}

export function persistPoLineOrder(order) {
  if (typeof window === 'undefined') return;
  if (!PO_LINE_ORDER_MODES.has(order)) return;
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
