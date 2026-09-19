/** Line-item display order on sales return add/edit (same idea as POS cart). */
export const SR_LINE_ORDER_STORAGE_KEY = 'salesReturn.lineDisplayOrder';
export const SR_LINE_ORDER_FIFO = 'fifo';
export const SR_LINE_ORDER_LIFO = 'lifo';
export const SR_LINE_ORDER_AMOUNT_ASC = 'amount_asc';
export const SR_LINE_ORDER_AMOUNT_DESC = 'amount_desc';
export const SR_LINE_ORDER_AMOUNT = 'amount';
export const SR_LINE_ORDER_PRICE_ASC = 'price_asc';
export const SR_LINE_ORDER_PRICE_DESC = 'price_desc';
export const SR_LINE_ORDER_MODES = new Set([
  SR_LINE_ORDER_FIFO,
  SR_LINE_ORDER_LIFO,
  SR_LINE_ORDER_AMOUNT_ASC,
  SR_LINE_ORDER_AMOUNT_DESC,
  SR_LINE_ORDER_AMOUNT,
  SR_LINE_ORDER_PRICE_ASC,
  SR_LINE_ORDER_PRICE_DESC,
]);

export function isSrLineAmountOrder(order) {
  return (
    order === SR_LINE_ORDER_AMOUNT_ASC ||
    order === SR_LINE_ORDER_AMOUNT_DESC ||
    order === SR_LINE_ORDER_AMOUNT
  );
}

export function isSrLinePriceOrder(order) {
  return order === SR_LINE_ORDER_PRICE_ASC || order === SR_LINE_ORDER_PRICE_DESC;
}

export function isSrLineValueOrder(order) {
  return isSrLineAmountOrder(order) || isSrLinePriceOrder(order);
}

function parseSrLineNumber(raw) {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const roundSrMoney2 = (n) => Math.round(n * 100) / 100;

/** Base product rate (Rate column) — used by Price sort. */
export function srLinePrice(line) {
  return parseSrLineNumber(line?.rate);
}

/** Displayed line amount (final rate × qty) — used by Amount sort. */
export function srLineAmount(line) {
  const qty = parseSrLineNumber(line?.qty);
  const baseRate = parseSrLineNumber(line?.rate);
  const tsRaw = String(line?.totalShipping ?? '').trim();
  if (tsRaw === '') return roundSrMoney2(qty * baseRate);
  const totalShippingNum = roundSrMoney2(parseSrLineNumber(tsRaw));
  const shippingPerUnit = qty > 0 ? roundSrMoney2(totalShippingNum / qty) : 0;
  const finalRate = roundSrMoney2(baseRate + shippingPerUnit);
  return roundSrMoney2(finalRate * qty);
}

export function nextSrLineSeq(lines) {
  let max = -1;
  for (const line of lines || []) {
    const n = Number(line?.addedSeq);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Fill missing insertion order so FIFO/LIFO still work after price/amount sorts. */
export function ensureSrLineSeq(lines, currentOrder) {
  if (!Array.isArray(lines) || lines.length === 0) return lines || [];
  if (lines.every((line) => Number.isFinite(Number(line?.addedSeq)))) return lines;
  const n = lines.length;
  return lines.map((line, i) => {
    if (Number.isFinite(Number(line?.addedSeq))) return line;
    const addedSeq = currentOrder === SR_LINE_ORDER_LIFO ? n - 1 - i : i;
    return { ...line, addedSeq };
  });
}

export function sortSrLinesByOrder(lines, order) {
  if (!Array.isArray(lines) || lines.length <= 1) return lines;
  const copy = [...lines];
  const seq = (line) => Number(line?.addedSeq) || 0;
  if (order === SR_LINE_ORDER_AMOUNT_ASC) {
    copy.sort((a, b) => srLineAmount(a) - srLineAmount(b) || seq(a) - seq(b));
    return copy;
  }
  if (order === SR_LINE_ORDER_AMOUNT_DESC || order === SR_LINE_ORDER_AMOUNT) {
    copy.sort((a, b) => srLineAmount(b) - srLineAmount(a) || seq(a) - seq(b));
    return copy;
  }
  if (order === SR_LINE_ORDER_PRICE_ASC) {
    copy.sort((a, b) => srLinePrice(a) - srLinePrice(b) || seq(a) - seq(b));
    return copy;
  }
  if (order === SR_LINE_ORDER_PRICE_DESC) {
    copy.sort((a, b) => srLinePrice(b) - srLinePrice(a) || seq(a) - seq(b));
    return copy;
  }
  if (order === SR_LINE_ORDER_LIFO) {
    copy.sort((a, b) => seq(b) - seq(a));
    return copy;
  }
  copy.sort((a, b) => seq(a) - seq(b));
  return copy;
}

export function applySrLineOrder(lines, order) {
  return sortSrLinesByOrder(ensureSrLineSeq(lines, order), order);
}

export function insertSrLine(prev, newLine, order) {
  const withSeq = { ...newLine, addedSeq: nextSrLineSeq(prev) };
  if (isSrLineValueOrder(order)) {
    return sortSrLinesByOrder([...prev, withSeq], order);
  }
  return order === SR_LINE_ORDER_LIFO ? [withSeq, ...prev] : [...prev, withSeq];
}

export function readStoredSrLineOrder() {
  if (typeof window === 'undefined') return SR_LINE_ORDER_FIFO;
  try {
    const value = window.localStorage.getItem(SR_LINE_ORDER_STORAGE_KEY);
    if (value === SR_LINE_ORDER_AMOUNT) return SR_LINE_ORDER_AMOUNT_DESC;
    if (SR_LINE_ORDER_MODES.has(value)) return value;
  } catch {
    /* ignore */
  }
  return SR_LINE_ORDER_FIFO;
}

export function persistSrLineOrder(order) {
  if (typeof window === 'undefined') return;
  if (!SR_LINE_ORDER_MODES.has(order)) return;
  try {
    window.localStorage.setItem(SR_LINE_ORDER_STORAGE_KEY, order);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Unsaved sales-return draft (survives accidental refresh / HMR reload). */
const SR_DRAFT_CACHE_PREFIX = 'salesReturn.draft.v1';
const SR_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SR_DRAFT_FORM_KEYS = [
  'sales_order_no',
  'customer_id',
  'order_status',
  'notes',
  'expected_delivery_date',
  'account_id',
  'amount_received',
];

export function srDraftStorageKey(mode, companyId, recordId = '') {
  const cid = String(companyId || '').trim();
  if (!cid) return '';
  if (mode === 'edit') {
    const rid = String(recordId || '').trim();
    if (!rid) return '';
    return `${SR_DRAFT_CACHE_PREFIX}.edit.${cid}.${rid}`;
  }
  return `${SR_DRAFT_CACHE_PREFIX}.add.${cid}`;
}

function sanitizeSrDraftForm(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  SR_DRAFT_FORM_KEYS.forEach((key) => {
    if (raw[key] != null) out[key] = String(raw[key]);
  });
  return out;
}

export function sanitizeSrDraftLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== 'object') return null;
      const productId = String(row.productId ?? row.product_id ?? '').trim();
      if (!productId) return null;
      return {
        key: String(row.key || '').trim() || `sr-draft-${i}`,
        productId,
        label: String(row.label ?? ''),
        qty: String(row.qty ?? '1'),
        rate: String(row.rate ?? ''),
        totalShipping: String(row.totalShipping ?? ''),
        warehouseId: String(row.warehouseId ?? row.warehouse_id ?? ''),
        warehouseInventoryRows: Array.isArray(row.warehouseInventoryRows)
          ? row.warehouseInventoryRows
          : [],
        presetWarehouseInventoryId: String(row.presetWarehouseInventoryId ?? ''),
        presetWarehouseId: String(row.presetWarehouseId ?? row.warehouseId ?? ''),
        addedSeq: Number.isFinite(Number(row.addedSeq)) ? Number(row.addedSeq) : undefined,
      };
    })
    .filter(Boolean);
}

export function readSrDraftCache(mode, companyId, recordId = '') {
  if (typeof window === 'undefined') return null;
  const key = srDraftStorageKey(mode, companyId, recordId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const savedAt = Number(parsed.savedAt);
    if (Number.isFinite(savedAt) && Date.now() - savedAt > SR_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return {
      form: sanitizeSrDraftForm(parsed.form),
      lines: sanitizeSrDraftLines(parsed.lines),
      amountPaidDirty: Boolean(parsed.amountPaidDirty),
    };
  } catch {
    return null;
  }
}

export function persistSrDraftCache(mode, companyId, recordId, draft) {
  if (typeof window === 'undefined') return;
  const key = srDraftStorageKey(mode, companyId, recordId);
  if (!key) return;
  const payload = {
    v: 1,
    savedAt: Date.now(),
    form: sanitizeSrDraftForm(draft?.form),
    lines: sanitizeSrDraftLines(draft?.lines),
    amountPaidDirty: Boolean(draft?.amountPaidDirty),
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    return;
  } catch {
    /* quota — retry without bulky warehouse rows */
  }
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        lines: payload.lines.map((row) => {
          const rest = { ...row };
          delete rest.warehouseInventoryRows;
          return rest;
        }),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSrDraftCache(mode, companyId, recordId = '') {
  if (typeof window === 'undefined') return;
  const key = srDraftStorageKey(mode, companyId, recordId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
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
