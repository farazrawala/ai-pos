import { getMeta, setMeta } from '../offline/repositories/metaRepo.js';

const POS_CART_SESSION_STORAGE_KEY = 'pos.cartSession';
const POS_CART_SESSION_META_KEY = 'pos_cart_session';

function posCartSessionLocalStorageKey(companyId, userId) {
  const company = String(companyId || '').trim();
  const user = String(userId || '').trim();
  if (company && user) return `${POS_CART_SESSION_STORAGE_KEY}.${company}.${user}`;
  if (company) return `${POS_CART_SESSION_STORAGE_KEY}.${company}`;
  return POS_CART_SESSION_STORAGE_KEY;
}

function posCartSessionMetaKey(companyId, userId) {
  const company = String(companyId || '').trim();
  const user = String(userId || '').trim();
  if (company && user) return `${POS_CART_SESSION_META_KEY}.${company}.${user}`;
  if (company) return `${POS_CART_SESSION_META_KEY}.${company}`;
  return POS_CART_SESSION_META_KEY;
}

function readLocalStorageJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function roundQty(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function parseQty(raw) {
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? roundQty(n) : 0;
}

function formatQtyLabel(qty) {
  const q = roundQty(qty);
  if (!Number.isFinite(q) || q <= 0) return '0';
  return Number.isInteger(q) ? String(q) : q.toFixed(2);
}

function nextCartLineSeq(lines) {
  let max = -1;
  for (const line of lines) {
    const n = Number(line?.addedSeq);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export function normalizeStoredCartLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.filter(
    (line) => line && typeof line === 'object' && String(line.productId || '').trim()
  );
}

export function normalizeCartSession(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      cartLines: [],
      selectedCustomerId: '',
      shipping: '',
      orderDateTime: '',
      extraDiscount: '',
      extraDiscountPercent: '',
      activeDraftId: null,
    };
  }
  const activeDraftId =
    raw.activeDraftId != null && String(raw.activeDraftId).trim() !== ''
      ? String(raw.activeDraftId)
      : null;
  return {
    cartLines: normalizeStoredCartLines(raw.cartLines),
    selectedCustomerId:
      raw.selectedCustomerId != null && String(raw.selectedCustomerId).trim() !== ''
        ? String(raw.selectedCustomerId)
        : '',
    shipping: raw.shipping != null ? String(raw.shipping) : '',
    orderDateTime: raw.orderDateTime != null ? String(raw.orderDateTime) : '',
    extraDiscount: raw.extraDiscount != null ? String(raw.extraDiscount) : '',
    extraDiscountPercent: raw.extraDiscountPercent != null ? String(raw.extraDiscountPercent) : '',
    activeDraftId,
  };
}

export function readStoredCartSession(companyId, userId) {
  const scoped = readLocalStorageJson(posCartSessionLocalStorageKey(companyId, userId));
  if (scoped) return normalizeCartSession(scoped);
  return null;
}

export function persistCartSession(session, companyId, userId) {
  const next = normalizeCartSession(session);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        posCartSessionLocalStorageKey(companyId, userId),
        JSON.stringify(next)
      );
    } catch {
      /* ignore quota / private mode */
    }
  }
  setMeta(posCartSessionMetaKey(companyId, userId), next).catch((err) => {
    console.warn('[POS] Could not cache cart session offline', err);
  });
  return next;
}

/** Prefer localStorage; fall back to offline meta cache. */
export async function loadCachedCartSession(companyId, userId) {
  const fromLocal = readStoredCartSession(companyId, userId);
  if (fromLocal) return fromLocal;
  try {
    const fromMeta = await getMeta(posCartSessionMetaKey(companyId, userId));
    if (fromMeta) {
      const normalized = normalizeCartSession(fromMeta);
      persistCartSession(normalized, companyId, userId);
      return normalized;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Merge product lines into the POS cart session (same product ids stack qty).
 * @param {{ companyId: string, userId: string, lines: Array<{
 *   productId: string,
 *   name?: string,
 *   unitPrice?: number,
 *   quantity?: number|string,
 *   availableStock?: number,
 *   category_id?: string,
 * }> }} args
 * @returns {{ added: number, merged: number, skipped: number, cartLineCount: number }}
 */
export function appendLinesToPosCartSession({ companyId, userId, lines }) {
  const incoming = Array.isArray(lines) ? lines : [];
  const session = readStoredCartSession(companyId, userId) || normalizeCartSession(null);
  const nextLines = [...session.cartLines];
  let added = 0;
  let merged = 0;
  let skipped = 0;

  for (const line of incoming) {
    const productId = String(line?.productId || '').trim();
    const qty = parseQty(line?.quantity);
    if (!productId || qty <= 0) {
      skipped += 1;
      continue;
    }

    const existingIndex = nextLines.findIndex((row) => String(row.productId || '').trim() === productId);
    if (existingIndex >= 0) {
      const currentQty = parseQty(nextLines[existingIndex].quantity);
      nextLines[existingIndex] = {
        ...nextLines[existingIndex],
        quantity: formatQtyLabel(currentQty + qty),
      };
      merged += 1;
      continue;
    }

    const unitPrice = Number(line.unitPrice);
    nextLines.push({
      productId,
      name: String(line.name || 'Product').trim() || 'Product',
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      quantity: formatQtyLabel(qty),
      ...(line.availableStock != null && Number.isFinite(Number(line.availableStock))
        ? { availableStock: Number(line.availableStock) }
        : {}),
      addedSeq: nextCartLineSeq(nextLines),
      ...(line.category_id ? { category_id: String(line.category_id).trim() } : {}),
    });
    added += 1;
  }

  persistCartSession({ ...session, cartLines: nextLines }, companyId, userId);
  return {
    added,
    merged,
    skipped,
    cartLineCount: nextLines.length,
  };
}
