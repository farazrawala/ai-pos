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
