import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  FaTrash,
  FaCalculator,
  FaFloppyDisk,
  FaListUl,
  FaFolderOpen,
  FaCloudArrowUp,
  FaArrowsRotate,
  FaGear,
  FaArrowRightArrowLeft,
} from 'react-icons/fa6';
import NavIcon from '../../components/NavIcon.jsx';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getDefaultPosCustomerUserId,
  getUserOptionValue,
  createCustomerUserRequest,
  pickCreatedUserFromResponse,
  POS_DEFAULT_CUSTOMER_PASSWORD,
  resolvePosCustomerEmail,
  digitsOnlyFromPhone,
} from '../../features/users/usersAPI.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import { fetchProductActiveRequest } from '../../features/products/productsAPI.js';
import {
  createPosOrderRequest,
  pickOrderInvoiceNoFromSaveResponse,
} from '../../features/orders/ordersAPI.js';
import {
  extractPrinterSettingsFromCompanyBody,
  extractProductSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  getCompanyIdFromUser,
  mergeCompanyRecordForSettings,
  mergePrinterSettings,
  mergeProductSettings,
  mergeDefaultPrinterSettings,
  extractDefaultPrinterSettingsFromCompanyBody,
  pickCompanyLogoUrl,
  getWarehouseIdFromCompany,
  normalizeCompanyDraftOrders,
  addCompanyDraftOrder,
  updateCompanyDraftOrder,
  removeCompanyDraftOrder,
  resolveBillCurrentUserName,
  resolveDraftSavedByName,
} from '../../features/company/companyAPI.js';
import { setCompany } from '../../features/user/userSlice.js';
import { formatProductNameWithStock, getProductAvailableStock } from '../../utils/productStock.js';
import {
  isVariableParentProduct,
  isProductInactive,
  sellablePosProductId,
} from '../../components/product/productVariationUtils.js';
import { openThermalReceiptPrint } from '../../components/ThermalReceiptPrint/index.js';
import { printPosOrderViaBridge } from '../../services/printing/posPrintIntegration.js';
import { useFetchRetryCountdown } from '../../hooks/useFetchRetryCountdown.js';
import { buildPublicInvoiceUrl, pickPublicInvoiceToken } from '../../utils/publicInvoiceUrl.js';
import PosProducts from './PosProducts.jsx';
import { openPosPaymentModal } from './PosPaymentModal.jsx';
import { posElapsedMs, posMsToSec, posLogTimingSummary } from '../../utils/posTimingDebug.js';
import { CalculatorModal, openCalculatorModal } from '../../components/Calculator/index.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import OfflineStatusBadge from '../../components/OfflineStatusBadge.jsx';
import OfflineSyncPanel, { openOfflineSyncPanel } from '../../components/OfflineSyncPanel.jsx';
import AppModal from '../../components/AppModal.jsx';
import { processSyncQueue } from '../../offline/syncOrders.js';
import { refreshSyncStatusCounts } from '../../offline/syncStatus.js';
import { isMasterSyncStale, runMasterSync } from '../../offline/masterSync.js';
import { OFFLINE_CATALOG_EMPTY_MESSAGE } from '../../offline/catalogRead.js';
import { saveOfflineOrder, buildOfflineSaveResult } from '../../offline/saveOfflineOrder.js';
import { getAllCategories, countCategories } from '../../offline/repositories/categoriesRepo.js';
import {
  getAllCustomers,
  countCustomers,
  upsertCustomers,
} from '../../offline/repositories/customersRepo.js';
import { getMeta, setMeta } from '../../offline/repositories/metaRepo.js';
import { toast, boldQuotedNamesInMessage } from '../../utils/toast.js';
import { formatPosOrderErrorMessage } from '../../utils/posOrderErrors.js';
import { playPosScanBeep, unlockPosScanAudio } from '../../utils/posScanBeep.js';
import { shopName } from '../../features/orders/invoiceViewMapper.js';
import PakistanCityStateFields from '../../components/users/PakistanCityStateFields.jsx';
import { DEFAULT_USER_CITY, DEFAULT_USER_STATE } from '../../constants/pakistanLocations.js';
import './pos-module.css';

const ADD_CUSTOMER_INITIAL = {
  name: '',
  email: '',
  phone: '03',
  area: '',
  city: DEFAULT_USER_CITY,
  state: DEFAULT_USER_STATE,
};
const POS_DRAFTS_MODAL_ID = 'posDraftsModal';
const POS_CART_ORDER_STORAGE_KEY = 'pos.cartDisplayOrder';
const POS_CART_ORDER_FIFO = 'fifo';
const POS_CART_ORDER_LIFO = 'lifo';
const POS_CART_ORDER_AMOUNT_ASC = 'amount_asc';
const POS_CART_ORDER_AMOUNT_DESC = 'amount_desc';
const POS_CART_ORDER_AMOUNT = 'amount';
const POS_CART_ORDER_PRICE_ASC = 'price_asc';
const POS_CART_ORDER_PRICE_DESC = 'price_desc';
const POS_CART_ORDER_MODES = new Set([
  POS_CART_ORDER_FIFO,
  POS_CART_ORDER_LIFO,
  POS_CART_ORDER_AMOUNT_ASC,
  POS_CART_ORDER_AMOUNT_DESC,
  POS_CART_ORDER_AMOUNT,
  POS_CART_ORDER_PRICE_ASC,
  POS_CART_ORDER_PRICE_DESC,
]);
const POS_LAYOUT_STORAGE_KEY = 'pos.layout';
const POS_LAYOUT_META_KEY = 'pos_layout';
/** Matches Bootstrap xl-5 (~41.67%) for the current-order column. */
const POS_LAYOUT_DEFAULT_ORDER_WIDTH = 42;
const POS_LAYOUT_MIN_ORDER_WIDTH = 28;
const POS_LAYOUT_MAX_ORDER_WIDTH = 72;
const POS_LAYOUT_MIN_PRODUCT_COLS = 2;
const POS_LAYOUT_MAX_PRODUCT_COLS = 6;
const POS_LAYOUT_DEFAULT_PRODUCT_COLS = 4;
const POS_LAYOUT_DEFAULT = {
  orderWidth: POS_LAYOUT_DEFAULT_ORDER_WIDTH,
  swapped: false,
  productCols: POS_LAYOUT_DEFAULT_PRODUCT_COLS,
};

function isPosCartAmountOrder(order) {
  return (
    order === POS_CART_ORDER_AMOUNT_ASC ||
    order === POS_CART_ORDER_AMOUNT_DESC ||
    order === POS_CART_ORDER_AMOUNT
  );
}

function isPosCartPriceOrder(order) {
  return order === POS_CART_ORDER_PRICE_ASC || order === POS_CART_ORDER_PRICE_DESC;
}

function isPosCartValueOrder(order) {
  return isPosCartAmountOrder(order) || isPosCartPriceOrder(order);
}

/** Load cart display-order preference from localStorage cache. */
function readStoredCartDisplayOrder() {
  if (typeof window === 'undefined') return POS_CART_ORDER_FIFO;
  try {
    const value = window.localStorage.getItem(POS_CART_ORDER_STORAGE_KEY);
    if (value === POS_CART_ORDER_AMOUNT) return POS_CART_ORDER_AMOUNT_DESC;
    if (POS_CART_ORDER_MODES.has(value)) return value;
  } catch {
    /* ignore */
  }
  return POS_CART_ORDER_FIFO;
}

/** Persist cart display-order preference to localStorage cache. */
function persistCartDisplayOrder(order) {
  if (typeof window === 'undefined') return;
  if (!POS_CART_ORDER_MODES.has(order)) return;
  try {
    window.localStorage.setItem(POS_CART_ORDER_STORAGE_KEY, order);
  } catch {
    /* ignore quota / private mode */
  }
}

function clampOrderPanelWidth(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return POS_LAYOUT_DEFAULT_ORDER_WIDTH;
  return Math.min(POS_LAYOUT_MAX_ORDER_WIDTH, Math.max(POS_LAYOUT_MIN_ORDER_WIDTH, n));
}

function clampProductCols(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return POS_LAYOUT_DEFAULT_PRODUCT_COLS;
  return Math.min(POS_LAYOUT_MAX_PRODUCT_COLS, Math.max(POS_LAYOUT_MIN_PRODUCT_COLS, n));
}

function normalizePosLayout(raw) {
  if (!raw || typeof raw !== 'object') return { ...POS_LAYOUT_DEFAULT };
  return {
    orderWidth: clampOrderPanelWidth(raw.orderWidth ?? POS_LAYOUT_DEFAULT_ORDER_WIDTH),
    swapped: Boolean(raw.swapped),
    productCols: clampProductCols(raw.productCols ?? POS_LAYOUT_DEFAULT_PRODUCT_COLS),
  };
}

function posLayoutLocalStorageKey(companyId) {
  const id = String(companyId || '').trim();
  return id ? `${POS_LAYOUT_STORAGE_KEY}.${id}` : POS_LAYOUT_STORAGE_KEY;
}

function posLayoutMetaKey(companyId) {
  const id = String(companyId || '').trim();
  return id ? `${POS_LAYOUT_META_KEY}.${id}` : POS_LAYOUT_META_KEY;
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

/** Load POS panel width / swap preference from localStorage cache. */
function readStoredPosLayout(companyId) {
  const scopedKey = posLayoutLocalStorageKey(companyId);
  const scoped = readLocalStorageJson(scopedKey);
  if (scoped) return normalizePosLayout(scoped);
  // Migrate legacy unscoped key into the company-scoped cache.
  const legacy = readLocalStorageJson(POS_LAYOUT_STORAGE_KEY);
  if (legacy) {
    const normalized = normalizePosLayout(legacy);
    if (typeof window !== 'undefined' && String(companyId || '').trim()) {
      try {
        window.localStorage.setItem(scopedKey, JSON.stringify(normalized));
      } catch {
        /* ignore */
      }
    }
    return normalized;
  }
  return { ...POS_LAYOUT_DEFAULT };
}

/** Persist POS layout to localStorage + offline IndexedDB meta cache. */
function persistPosLayout(layout, companyId) {
  const next = normalizePosLayout(layout);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(posLayoutLocalStorageKey(companyId), JSON.stringify(next));
      // Keep legacy key in sync for older builds / missing company id.
      if (!String(companyId || '').trim()) {
        window.localStorage.setItem(POS_LAYOUT_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      /* ignore quota / private mode */
    }
  }
  setMeta(posLayoutMetaKey(companyId), next).catch((err) => {
    console.warn('[POS] Could not cache layout settings offline', err);
  });
  return next;
}

/** Prefer localStorage; fall back to offline meta cache. */
async function loadCachedPosLayout(companyId) {
  const fromLocal = readStoredPosLayout(companyId);
  const hasScopedLocal = Boolean(readLocalStorageJson(posLayoutLocalStorageKey(companyId)));
  const hasLegacyLocal = Boolean(readLocalStorageJson(POS_LAYOUT_STORAGE_KEY));
  if (hasScopedLocal || hasLegacyLocal) return fromLocal;
  try {
    const fromMeta = await getMeta(posLayoutMetaKey(companyId));
    if (fromMeta) {
      const normalized = normalizePosLayout(fromMeta);
      persistPosLayout(normalized, companyId);
      return normalized;
    }
  } catch {
    /* ignore */
  }
  return fromLocal;
}

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

function normalizeStoredCartLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.filter(
    (line) => line && typeof line === 'object' && String(line.productId || '').trim()
  );
}

function normalizeCartSession(raw) {
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

function readStoredCartSession(companyId, userId) {
  const scoped = readLocalStorageJson(posCartSessionLocalStorageKey(companyId, userId));
  if (scoped) return normalizeCartSession(scoped);
  return null;
}

function persistCartSession(session, companyId, userId) {
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
async function loadCachedCartSession(companyId, userId) {
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

/** Value for `<input type="datetime-local">` (local wall clock). */
function nowDatetimeLocalValue() {
  return moment().format('YYYY-MM-DDTHH:mm');
}

/** Normalize stored / ISO values into `datetime-local` input format. */
function toDatetimeLocalValue(raw) {
  if (raw == null || String(raw).trim() === '') return nowDatetimeLocalValue();
  const m = moment(raw);
  return m.isValid() ? m.format('YYYY-MM-DDTHH:mm') : nowDatetimeLocalValue();
}

function formatPosOrderDateTime(raw) {
  const m = moment(raw);
  return m.isValid() ? m.format('D MMM YYYY, h:mm a') : moment().format('D MMM YYYY, h:mm a');
}

function defaultDraftLabel(total = 0) {
  const amount = Number(total);
  const totalLabel = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
  return `Draft ${moment().format('D MMM YYYY, h:mm a')} — PKR ${totalLabel}`;
}

function countDraftPayloadItems(payload) {
  const lines = payload?.cartLines;
  return Array.isArray(lines) ? lines.length : 0;
}

function draftPayloadGrandTotal(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.grandTotal != null) {
    const n = Number(payload.grandTotal);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  const lines = Array.isArray(payload.cartLines) ? payload.cartLines : [];
  const subtotal = lines.reduce((sum, line) => {
    const qty = parsePosQty(line?.quantity);
    const price = Number(line?.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const shipping = Number(payload.shipping) || 0;
  const discount = Number(payload.extraDiscount) || 0;
  const total = subtotal + shipping - discount;
  return Number.isFinite(total) ? Math.max(0, total) : null;
}

function formatDraftMoney(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return `PKR ${Number(amount).toFixed(2)}`;
}

function formatDraftUpdatedAt(value) {
  if (!value) return '—';
  const m = moment(value);
  return m.isValid() ? m.format('D MMM YYYY, h:mm a') : '—';
}

/** Prefer a short title; amount is shown separately in the drafts list. */
function draftDisplayTitle(label) {
  const raw = String(label || '').trim() || 'Draft';
  return raw.replace(/\s*[—–-]\s*PKR\s*[\d,]+\.?\d*\s*$/i, '').trim() || raw;
}

/** Client/customer label stored on a draft or resolved from the users list. */
function resolveDraftClientName(draft, users = []) {
  if (!draft || typeof draft !== 'object') return '';
  const payload = draft.payload && typeof draft.payload === 'object' ? draft.payload : {};
  const stored = String(
    payload.customerName ||
      payload.selectedCustomerName ||
      draft.customerName ||
      draft.customer_name ||
      ''
  ).trim();
  if (stored) return stored;

  const customerId = String(
    payload.selectedCustomerId ?? payload.customer_id ?? draft.customer_id ?? ''
  ).trim();
  if (!customerId) return 'Walk in';

  const list = Array.isArray(users) ? users : [];
  const match = list.find((u) => getUserOptionValue(u) === customerId);
  if (match) return formatUserOptionLabel(match) || 'Customer';
  return 'Customer';
}

function openPosDraftsModal() {
  const el = document.getElementById(POS_DRAFTS_MODAL_ID);
  if (el && window.bootstrap?.Modal) {
    const M = window.bootstrap.Modal;
    const instance =
      typeof M.getOrCreateInstance === 'function'
        ? M.getOrCreateInstance(el)
        : M.getInstance(el) || new M(el);
    instance.show();
  }
}

function closePosDraftsModal() {
  const el = document.getElementById(POS_DRAFTS_MODAL_ID);
  if (el && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getInstance(el)?.hide();
  }
}

function pickOrderFromSaveResult(result) {
  if (!result || typeof result !== 'object') return null;
  const data = result.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.order && typeof data.order === 'object') return data.order;
    if (data._id != null || data.id != null) return data;
  }
  if (result.order && typeof result.order === 'object') return result.order;
  if (result._id != null || result.id != null) return result;
  return null;
}

function buildCompanyBrandFromRecord(company) {
  const name = company?.company_name || company?.name || shopName;
  return {
    name: String(name || shopName).trim() || shopName,
    phone: String(company?.company_phone || company?.phone || '').trim(),
    email: String(company?.company_email || company?.email || '').trim(),
    address: String(company?.company_address || company?.address || '').trim(),
    logoUrl: pickCompanyLogoUrl(company),
  };
}

function buildThermalReceiptFromCart({
  cartLines,
  customerName,
  customerEmail,
  customerPhone,
  payment,
  cartSubtotal,
  shippingNum,
  extraDiscountNum,
  extraDiscountPercentNum,
  grandTotal,
  invoiceNo,
  publicUrl,
  companyName,
  orderDateTime,
}) {
  const discountPct = Number(extraDiscountPercentNum) || 0;
  const resolvedDiscountPct =
    discountPct > 0
      ? discountPct
      : Number(cartSubtotal) > 0 && Number(extraDiscountNum) > 0
        ? Math.round((Number(extraDiscountNum) / Number(cartSubtotal)) * 10000) / 100
        : 0;
  const lines = (cartLines || []).map((line) => {
    const qty = parsePosQty(line.quantity);
    const rate = Number(line.unitPrice) || 0;
    const amount = qty * rate;
    const discountSaved =
      resolvedDiscountPct > 0 && amount > 0
        ? Math.round(amount * (resolvedDiscountPct / 100) * 100) / 100
        : 0;
    return {
      description: line.name || 'Product',
      qtyLabel: formatPosQtyLabel(qty),
      rate,
      amount,
      discountSaved,
    };
  });
  const paid = Number(payment?.paid ?? 0);
  const total = Number(grandTotal) || 0;
  const balanceDue = Math.max(0, total - paid);
  return {
    shopName: companyName || shopName,
    invoiceNo: invoiceNo || '—',
    invoiceDate: formatPosOrderDateTime(orderDateTime),
    paymentMethod: payment?.paymentMethod || '—',
    paymentStatus: balanceDue <= 0 ? 'Paid' : 'Partial',
    billTo: {
      name: customerName || 'Walk-in Client',
      phone: customerPhone || '',
      email: customerEmail || '',
    },
    lines,
    grossAmount: total,
    publicUrl: publicUrl || '',
    summary: {
      subTotal: Number(cartSubtotal) || 0,
      tax: 0,
      discount: Number(extraDiscountNum) || 0,
      discountPercentage: resolvedDiscountPct,
      shipping: Number(shippingNum) || 0,
      total,
      paymentMade: paid,
      balanceDue,
    },
    terms: shippingNum > 0 ? `Shipping: PKR ${Number(shippingNum).toFixed(2)}` : '',
  };
}

const parsePosUnitPrice = (product) => {
  const v = product?.price ?? product?.product_price;
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const POS_QTY_MIN = 0.01;

function roundPosQty(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Parse cart / order line quantity (supports decimals e.g. 2.45). */
function parsePosQty(raw) {
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? roundPosQty(n) : 0;
}

function cartLineAmount(line) {
  return parsePosQty(line?.quantity) * (Number(line?.unitPrice) || 0);
}

function cartLinePrice(line) {
  return Number(line?.unitPrice) || 0;
}

function nextCartLineSeq(lines) {
  let max = -1;
  for (const line of lines) {
    const n = Number(line?.addedSeq);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Fill missing insertion order so FIFO/LIFO still work after amount sorts. */
function ensureCartLineSeq(lines, currentOrder) {
  if (!Array.isArray(lines) || lines.length === 0) return lines || [];
  if (lines.every((line) => Number.isFinite(Number(line?.addedSeq)))) return lines;
  const n = lines.length;
  return lines.map((line, i) => {
    if (Number.isFinite(Number(line?.addedSeq))) return line;
    const addedSeq = currentOrder === POS_CART_ORDER_LIFO ? n - 1 - i : i;
    return { ...line, addedSeq };
  });
}

function sortCartLinesByOrder(lines, order) {
  if (!Array.isArray(lines) || lines.length <= 1) return lines;
  const copy = [...lines];
  const seq = (line) => Number(line?.addedSeq) || 0;
  if (order === POS_CART_ORDER_AMOUNT_ASC) {
    copy.sort((a, b) => cartLineAmount(a) - cartLineAmount(b) || seq(a) - seq(b));
    return copy;
  }
  if (order === POS_CART_ORDER_AMOUNT_DESC || order === POS_CART_ORDER_AMOUNT) {
    copy.sort((a, b) => cartLineAmount(b) - cartLineAmount(a) || seq(a) - seq(b));
    return copy;
  }
  if (order === POS_CART_ORDER_PRICE_ASC) {
    copy.sort((a, b) => cartLinePrice(a) - cartLinePrice(b) || seq(a) - seq(b));
    return copy;
  }
  if (order === POS_CART_ORDER_PRICE_DESC) {
    copy.sort((a, b) => cartLinePrice(b) - cartLinePrice(a) || seq(a) - seq(b));
    return copy;
  }
  if (order === POS_CART_ORDER_LIFO) {
    copy.sort((a, b) => seq(b) - seq(a));
    return copy;
  }
  copy.sort((a, b) => seq(a) - seq(b));
  return copy;
}

/** While typing qty — digits with optional single decimal, max 2 fractional digits. */
function sanitizePosQtyInput(value) {
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

function formatPosQtyLabel(qty) {
  const q = roundPosQty(qty);
  if (!Number.isFinite(q) || q <= 0) return '0';
  return Number.isInteger(q) ? String(q) : q.toFixed(2);
}

function parsePosMoneyInput(raw) {
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : null;
}

function formatPosMoneyInput(n) {
  if (!Number.isFinite(n) || n < 0) return '';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatPosPercentInput(n) {
  if (!Number.isFinite(n) || n < 0) return '';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function amountFromDiscountPercent(subtotal, percentRaw) {
  const pct = parsePosMoneyInput(percentRaw);
  if (pct == null || pct <= 0) return '';
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return '';
  return formatPosMoneyInput((sub * pct) / 100);
}

function percentFromDiscountAmount(subtotal, amountRaw) {
  const amt = parsePosMoneyInput(amountRaw);
  if (amt == null || amt <= 0) return '';
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return '';
  return formatPosPercentInput((amt / sub) * 100);
}

function isPartialDiscountInput(value) {
  const s = String(value ?? '').trim();
  return !s || s === '.' || s.endsWith('.');
}

/** True while user is mid-edit (e.g. ".", ".5", "2."). */
function isPartialPosQtyInput(value) {
  const s = String(value ?? '').trim();
  if (!s) return true;
  if (s === '.') return true;
  if (s.endsWith('.')) return true;
  return false;
}

function posStockBlocksQty({ allowWhenInsufficient, availableStock, requestedQty, productName }) {
  if (allowWhenInsufficient) return null;

  if (availableStock == null || !Number.isFinite(availableStock)) {
    const name = String(productName || 'Product').trim() || 'Product';
    return `Cannot verify stock for "${name}". Reload POS or check warehouse inventory.`;
  }

  if (requestedQty <= availableStock) return null;
  const name = String(productName || 'Product').trim() || 'Product';
  return `Insufficient stock for "${name}": requested ${formatPosQtyLabel(requestedQty)}, available ${formatPosQtyLabel(availableStock)}.`;
}

function productIdsForLookup(product) {
  const ids = new Set();
  const sellable = sellablePosProductId(product);
  if (sellable) ids.add(String(sellable));
  const raw = product?._id ?? product?.id ?? product?.product_id;
  if (raw != null && String(raw).trim()) ids.add(String(raw).trim());
  return ids;
}

function normalizeCartLinesForCheckout(cartLines) {
  if (!Array.isArray(cartLines) || cartLines.length === 0) {
    return { error: 'Cart is empty. Add at least one product before payment.', lines: null };
  }

  const normalized = [];
  for (const line of cartLines) {
    const q = parsePosQty(line.quantity);
    if (q < POS_QTY_MIN) {
      const name = String(line.name || 'Product').trim() || 'Product';
      return {
        error: `Each line needs quantity of at least ${POS_QTY_MIN}. Check "${name}".`,
        lines: null,
      };
    }
    normalized.push({ ...line, quantity: formatPosQtyLabel(q) });
  }

  return { error: null, lines: normalized };
}

function collectCartStockIssues(cartLines, { allowWhenInsufficient = false } = {}) {
  if (!Array.isArray(cartLines)) return [];
  const issues = [];
  for (const line of cartLines) {
    const msg = posStockBlocksQty({
      allowWhenInsufficient,
      availableStock: line.availableStock,
      requestedQty: parsePosQty(line.quantity),
      productName: line.name,
    });
    if (msg) issues.push(msg);
  }
  return issues;
}

async function refreshCartLineStock(cartLines, warehouseId) {
  const uniqueIds = [
    ...new Set(cartLines.map((line) => String(line.productId || '').trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return { lines: cartLines, missingIds: [], variableParentIds: [], inactiveIds: [], ms: 0 };
  }

  const tAll = performance.now();
  console.log('[POS] refreshCartLineStock → GET product/get-all-active-pos?_id=…', {
    productIds: uniqueIds,
    warehouseId,
  });

  const stockById = {};
  const missingIds = [];
  const variableParentIds = [];
  const inactiveIds = [];

  try {
    const listed = await fetchProductActiveRequest({
      _id: uniqueIds,
      limit: Math.max(uniqueIds.length, 1),
      page: 1,
      includeInactive: true,
    });
    const rows = Array.isArray(listed?.data) ? listed.data : [];
    const productById = new Map();

    for (const product of rows) {
      for (const id of productIdsForLookup(product)) {
        if (!productById.has(id)) productById.set(id, product);
      }
    }

    for (const productId of uniqueIds) {
      const product = productById.get(productId) || null;
      if (!product) {
        // Soft-fail — keep previous availableStock; order_save is authoritative
        stockById[productId] = null;
        console.log('[POS] batch product missing', { productId });
        continue;
      }
      if (isVariableParentProduct(product)) {
        variableParentIds.push(productId);
      }
      if (isProductInactive(product)) {
        inactiveIds.push(productId);
      }
      stockById[productId] = getProductAvailableStock(product, { warehouseId });
      console.log('[POS] batch product ok', {
        productId,
        availableStock: stockById[productId],
        inactive: isProductInactive(product),
        variableParent: isVariableParentProduct(product),
      });
    }
  } catch (err) {
    console.warn('[POS] Could not refresh stock before payment (batch)', err);
    for (const productId of uniqueIds) {
      stockById[productId] = null;
    }
  }

  const ms = posElapsedMs(tAll);
  console.log('[POS] refreshCartLineStock done', {
    sec: posMsToSec(ms),
    ms,
    missingIds,
    variableParentIds,
    inactiveIds,
    stockById,
  });
  posLogTimingSummary('refreshCartLineStock', [
    { name: 'GET product/get-all-active-pos (_id batch)', ms },
    { name: 'TOTAL', ms },
  ]);

  return {
    lines: cartLines.map((line) => ({
      ...line,
      availableStock: stockById[line.productId] ?? line.availableStock,
    })),
    missingIds,
    variableParentIds,
    inactiveIds,
    ms,
  };
}

function formatCartStockIssueToast(issues) {
  if (!issues.length) return '';
  if (issues.length === 1) return issues[0];
  return `${issues.length} items have insufficient stock:\n${issues.join('\n')}`;
}

function showStockErrorToast(message, opts = {}) {
  toast.error(boldQuotedNamesInMessage(message), { ...opts, html: true });
}

function cartLineNamesForIds(cartLines, ids) {
  const idSet = new Set((ids || []).map((id) => String(id)));
  return (cartLines || [])
    .filter((line) => idSet.has(String(line?.productId ?? '')))
    .map((line) => String(line?.name ?? '').trim() || 'Product');
}

function toastCartProductValidationErrors({
  missingIds,
  variableParentIds,
  inactiveIds,
  cartLines,
}) {
  const variableNames = cartLineNamesForIds(cartLines, variableParentIds);
  if (variableNames.length) {
    showStockErrorToast(
      variableNames.length === 1
        ? `"${variableNames[0]}" is a variable parent and cannot be sold. Add a size/color variation instead.`
        : `These variable parents cannot be sold: ${variableNames
            .map((n) => `"${n}"`)
            .join(', ')}. Add size/color variations instead.`,
      { delay: 8000 }
    );
    return true;
  }

  const inactiveNames = cartLineNamesForIds(cartLines, inactiveIds);
  if (inactiveNames.length) {
    showStockErrorToast(
      inactiveNames.length === 1
        ? `"${inactiveNames[0]}" is inactive. Turn its Status on under Products, then add it again.`
        : `These products are inactive: ${inactiveNames
            .map((n) => `"${n}"`)
            .join(', ')}. Turn Status on under Products, then add them again.`,
      { delay: 8000 }
    );
    return true;
  }

  const missingNames = cartLineNamesForIds(cartLines, missingIds);
  if (missingNames.length) {
    showStockErrorToast(
      missingNames.length === 1
        ? `Product not available: "${missingNames[0]}". Remove it and add it again from the product grid.`
        : `Products not available: ${missingNames
            .map((n) => `"${n}"`)
            .join(', ')}. Remove them and add again from the product grid.`,
      { delay: 8000 }
    );
    return true;
  }

  return false;
}

function isLikelyNetworkError(err) {
  if (!err) return false;
  if (err.name === 'TypeError') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('networkerror')
  );
}

const OFFLINE_RECEIPT_FOOTER = 'Offline invoice — will sync when online';

const Pos = () => {
  useRequireModuleAccess('pos');
  const isOnline = useOnlineStatus();
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.user.user);
  const authUserName = useSelector((state) => state.user.name);
  const authCompany = useSelector((state) => state.user.company);

  const companyId = useMemo(
    () =>
      getCompanyIdFromUser(authUser) || String(authCompany?._id ?? authCompany?.id ?? '').trim(),
    [authUser, authCompany]
  );

  const userId = useMemo(
    () => String(authUser?._id ?? authUser?.id ?? '').trim(),
    [authUser]
  );

  const defaultWarehouseId = useMemo(() => getWarehouseIdFromCompany(authCompany), [authCompany]);

  const authCompanyRef = useRef(authCompany);
  authCompanyRef.current = authCompany;
  const prevCompanyIdRef = useRef(companyId);

  useEffect(() => {
    if (!companyId) return undefined;

    let cancelled = false;
    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) return;
        dispatch(setCompany(mergeCompanyRecordForSettings(fetched, authCompanyRef.current)));
      })
      .catch((err) => {
        console.warn('[POS] Could not refresh company product settings', err);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, dispatch]);

  const printerSettings = useMemo(() => {
    const parsed = extractPrinterSettingsFromCompanyBody({ data: authCompany });
    return mergePrinterSettings(parsed);
  }, [authCompany]);

  const productSettings = useMemo(() => {
    const parsed = extractProductSettingsFromCompanyBody({ data: authCompany });
    return mergeProductSettings(parsed);
  }, [authCompany]);

  const defaultPrinterSettings = useMemo(() => {
    const parsed = extractDefaultPrinterSettingsFromCompanyBody({ data: authCompany });
    return mergeDefaultPrinterSettings(parsed);
  }, [authCompany]);

  const allowAddWhenStockInsufficient = Boolean(
    productSettings.allow_add_to_cart_when_stock_insufficient
  );

  const companyBrand = useMemo(() => buildCompanyBrandFromRecord(authCompany), [authCompany]);

  const initialCartSessionRef = useRef(undefined);
  if (initialCartSessionRef.current === undefined) {
    initialCartSessionRef.current = readStoredCartSession(companyId, userId);
  }
  const initialCartSession = initialCartSessionRef.current;

  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    () => initialCartSession?.selectedCustomerId || ''
  );
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerPickerRef = useRef(null);

  const [productQuery, setProductQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const [categoriesError, setCategoriesError] = useState(null);
  const [shipping, setShipping] = useState(() => initialCartSession?.shipping || '');
  const [orderDateTime, setOrderDateTime] = useState(() =>
    initialCartSession?.orderDateTime
      ? toDatetimeLocalValue(initialCartSession.orderDateTime)
      : nowDatetimeLocalValue()
  );
  const [extraDiscount, setExtraDiscount] = useState(() => initialCartSession?.extraDiscount || '');
  const [extraDiscountPercent, setExtraDiscountPercent] = useState(
    () => initialCartSession?.extraDiscountPercent || ''
  );
  const discountEditSourceRef = useRef(null);
  const [cartLines, setCartLines] = useState(() =>
    Array.isArray(initialCartSession?.cartLines) ? initialCartSession.cartLines : []
  );
  const [cartDisplayOrder, setCartDisplayOrder] = useState(readStoredCartDisplayOrder);
  const [posLayout, setPosLayout] = useState(() => readStoredPosLayout(companyId));
  const [layoutSettingsOpen, setLayoutSettingsOpen] = useState(false);
  const cartDisplayOrderRef = useRef(cartDisplayOrder);
  cartDisplayOrderRef.current = cartDisplayOrder;
  const posLayoutCompanyIdRef = useRef(companyId);
  posLayoutCompanyIdRef.current = companyId;
  const cartSessionScopeRef = useRef(`${companyId}:${userId}`);
  const cartSessionHydratedScopeRef = useRef(
    initialCartSession != null ? `${companyId}:${userId}` : ''
  );
  const [cartProductFilter, setCartProductFilter] = useState('');
  const [activeDraftId, setActiveDraftId] = useState(() => initialCartSession?.activeDraftId || null);
  const [cartSessionReady, setCartSessionReady] = useState(() => initialCartSession != null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftDeletingId, setDraftDeletingId] = useState(null);

  const [addCustomerForm, setAddCustomerForm] = useState(ADD_CUSTOMER_INITIAL);
  const [addCustomerErrors, setAddCustomerErrors] = useState({});
  const [showAddCustomerLocation, setShowAddCustomerLocation] = useState(false);
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [paymentPreparing, setPaymentPreparing] = useState(false);
  const [masterSyncRunning, setMasterSyncRunning] = useState(false);
  const [masterSyncProgress, setMasterSyncProgress] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadCachedPosLayout(companyId).then((layout) => {
      if (!cancelled) setPosLayout(layout);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const applyCartSession = useCallback((session) => {
    const data = session && typeof session === 'object' ? session : {};
    setCartLines(Array.isArray(data.cartLines) ? data.cartLines : []);
    setSelectedCustomerId(
      data.selectedCustomerId != null && String(data.selectedCustomerId).trim() !== ''
        ? String(data.selectedCustomerId)
        : ''
    );
    setShipping(data.shipping != null ? String(data.shipping) : '');
    setOrderDateTime(
      data.orderDateTime ? toDatetimeLocalValue(data.orderDateTime) : nowDatetimeLocalValue()
    );
    setExtraDiscount(data.extraDiscount != null ? String(data.extraDiscount) : '');
    setExtraDiscountPercent(
      data.extraDiscountPercent != null ? String(data.extraDiscountPercent) : ''
    );
    setActiveDraftId(
      data.activeDraftId != null && String(data.activeDraftId).trim() !== ''
        ? String(data.activeDraftId)
        : null
    );
    discountEditSourceRef.current = null;
  }, []);

  useEffect(() => {
    const scope = `${companyId}:${userId}`;
    const scopeChanged = cartSessionScopeRef.current !== scope;
    cartSessionScopeRef.current = scope;

    const fromLocal = readStoredCartSession(companyId, userId);
    if (fromLocal && !scopeChanged) {
      cartSessionHydratedScopeRef.current = scope;
      setCartSessionReady(true);
      return undefined;
    }

    let cancelled = false;
    if (scopeChanged) setCartSessionReady(false);

    loadCachedCartSession(companyId, userId).then((session) => {
      if (cancelled) return;
      if (session) {
        applyCartSession(session);
      } else if (scopeChanged) {
        applyCartSession(null);
      }
      cartSessionHydratedScopeRef.current = scope;
      setCartSessionReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, userId, applyCartSession]);

  useEffect(() => {
    if (!cartSessionReady) return undefined;
    const scope = `${companyId}:${userId}`;
    if (cartSessionHydratedScopeRef.current !== scope) return undefined;
    persistCartSession(
      {
        cartLines,
        selectedCustomerId,
        shipping,
        orderDateTime,
        extraDiscount,
        extraDiscountPercent,
        activeDraftId,
      },
      companyId,
      userId
    );
    return undefined;
  }, [
    cartSessionReady,
    cartLines,
    selectedCustomerId,
    shipping,
    orderDateTime,
    extraDiscount,
    extraDiscountPercent,
    activeDraftId,
    companyId,
    userId,
  ]);

  const runPosMasterSync = useCallback(
    async ({ force = false, showSuccessToast = false } = {}) => {
      if (!isOnline) {
        toast.error('Connect to the internet to download catalog');
        return null;
      }
      if (!companyId) return null;

      setMasterSyncRunning(true);
      try {
        const summary = await runMasterSync({
          companyId,
          warehouseId: defaultWarehouseId,
          companyRecord: authCompany,
          force,
          onProgress: setMasterSyncProgress,
        });
        if (showSuccessToast) {
          toast.success('Catalog downloaded for offline use');
        }
        return summary;
      } catch (err) {
        console.error('[POS] Master sync failed', err);
        toast.error(err?.message || 'Catalog download failed');
        return null;
      } finally {
        setMasterSyncRunning(false);
        setMasterSyncProgress(null);
      }
    },
    [isOnline, companyId, defaultWarehouseId, authCompany]
  );

  const handleRefreshCatalog = useCallback(() => {
    runPosMasterSync({ force: true, showSuccessToast: true });
  }, [runPosMasterSync]);

  useEffect(() => {
    if (!isOnline || !companyId) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const stale = await isMasterSyncStale();
        if (!stale || cancelled) return;
        setMasterSyncRunning(true);
        await runMasterSync({
          companyId,
          warehouseId: defaultWarehouseId,
          companyRecord: authCompany,
          onProgress: (progress) => {
            if (!cancelled) setMasterSyncProgress(progress);
          },
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('[POS] Background master sync failed', err);
        }
      } finally {
        if (!cancelled) {
          setMasterSyncRunning(false);
          setMasterSyncProgress(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, companyId, defaultWarehouseId, authCompany]);

  useEffect(() => {
    if (!isOnline || !companyId) return undefined;
    refreshSyncStatusCounts().catch(() => {});
    processSyncQueue().catch((err) => {
      console.warn('[POS] Order sync on mount failed', err);
    });
    return undefined;
  }, [isOnline, companyId]);

  useEffect(() => {
    if (!companyId || !isOnline) {
      prevCompanyIdRef.current = companyId;
      return undefined;
    }
    if (prevCompanyIdRef.current && prevCompanyIdRef.current !== companyId) {
      runPosMasterSync({ force: true });
    }
    prevCompanyIdRef.current = companyId;
    return undefined;
  }, [companyId, isOnline, runPosMasterSync]);

  const showToast = (toastId, body) => {
    const toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }
    if (body) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = body;
    }
    if (window.bootstrap?.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
    }
  };

  const applyCustomerList = useCallback((arr, selectAfter) => {
    setUsers(arr);
    setUsersStatus('succeeded');
    if (selectAfter?.preferId) {
      setSelectedCustomerId(String(selectAfter.preferId));
    } else if (selectAfter?.fallbackEmail) {
      const em = selectAfter.fallbackEmail.trim().toLowerCase();
      const match = arr.find((u) => (u.email || '').toLowerCase() === em);
      if (match) {
        setSelectedCustomerId(getUserOptionValue(match));
      }
    } else {
      const defaultId = getDefaultPosCustomerUserId(arr);
      if (defaultId) setSelectedCustomerId(defaultId);
    }
  }, []);

  const loadUsers = useCallback(
    async (selectAfter) => {
      setUsersError(null);

      const readCachedCustomers = async () => {
        const cached = await getAllCustomers();
        return cached.filter((u) => getUserOptionValue(u));
      };

      if (!isOnline) {
        setUsersStatus('loading');
        try {
          const arr = await readCachedCustomers();
          if (arr.length === 0 || (await countCustomers()) === 0) {
            setUsers([]);
            setUsersError(OFFLINE_CATALOG_EMPTY_MESSAGE);
            setUsersStatus('failed');
            return;
          }
          applyCustomerList(arr, selectAfter);
        } catch (err) {
          console.warn('[POS] Failed to load customers from offline cache', err);
          setUsers([]);
          setUsersError(err?.message || OFFLINE_CATALOG_EMPTY_MESSAGE);
          setUsersStatus('failed');
        }
        return;
      }

      // Online: paint from IndexedDB first so a slow API never blocks the picker.
      let hadCache = false;
      try {
        const cached = await readCachedCustomers();
        if (cached.length > 0) {
          hadCache = true;
          applyCustomerList(cached, selectAfter);
        } else {
          setUsersStatus('loading');
        }
      } catch (err) {
        console.warn('[POS] Failed to read customer cache', err);
        setUsersStatus('loading');
      }

      // Fresh offline catalog is enough for the picker; skip the slow 2k user list
      // unless we must pick a just-created customer (selectAfter).
      if (hadCache && !selectAfter) {
        try {
          const stale = await isMasterSyncStale();
          if (!stale) return;
        } catch {
          /* fall through to network refresh */
        }
      }

      try {
        const list = await fetchUsersListRequest({
          limit: 2000,
          skip: 0,
          role: 'CUSTOMER',
          sortBy: 'createdAt',
          sortOrder: 'asc',
        });
        const arr = (Array.isArray(list) ? list : []).filter((u) => getUserOptionValue(u));
        applyCustomerList(arr, selectAfter);
        // Keep the offline catalog warm for the next visit (do not wipe extras beyond this page).
        upsertCustomers(arr).catch((cacheErr) => {
          console.warn('[POS] Failed to cache customers', cacheErr);
        });
      } catch (err) {
        console.warn('[POS] Failed to load users from API, trying offline cache', err);
        if (hadCache) return;
        try {
          const cached = await readCachedCustomers();
          if (cached.length > 0) {
            applyCustomerList(cached, selectAfter);
            return;
          }
        } catch (cacheErr) {
          console.warn('[POS] Offline customer fallback failed', cacheErr);
        }
        setUsers([]);
        setUsersError(err?.message || 'Could not load users');
        setUsersStatus('failed');
      }
    },
    [isOnline, applyCustomerList]
  );

  const loadCategories = useCallback(async () => {
    setCategoriesStatus('loading');
    setCategoriesError(null);

    const loadCategoriesFromCache = async () => {
      const cached = await getAllCategories();
      if ((await countCategories()) === 0) {
        setCategories([]);
        setCategoriesError(OFFLINE_CATALOG_EMPTY_MESSAGE);
        setCategoriesStatus('failed');
        return false;
      }
      setCategories(cached);
      setCategoriesStatus('succeeded');
      return true;
    };

    if (!isOnline) {
      await loadCategoriesFromCache();
      return;
    }

    try {
      const result = await fetchCategoriesRequest({ page: 1, limit: 2000 });
      const arr = Array.isArray(result?.data) ? result.data : [];
      setCategories(arr);
      setCategoriesStatus('succeeded');
    } catch (err) {
      console.warn('[POS] Failed to load categories from API, trying offline cache', err);
      const usedCache = await loadCategoriesFromCache();
      if (!usedCache) {
        setCategories([]);
        setCategoriesError(err?.message || 'Could not load categories');
        setCategoriesStatus('failed');
      }
    }
  }, [isOnline]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleRetryLookups = useCallback(() => {
    if (usersStatus === 'failed') loadUsers();
    if (categoriesStatus === 'failed') loadCategories();
  }, [usersStatus, categoriesStatus, loadUsers, loadCategories]);

  // Same as products list: 5→1 countdown then auto-retry while online.
  const { countdown: lookupsRetryCountdown, isRetrying: isRetryingLookups } =
    useFetchRetryCountdown({
      isFailed: usersStatus === 'failed' || categoriesStatus === 'failed',
      onRetry: handleRetryLookups,
      seconds: 5,
      enabled: isOnline,
    });

  useEffect(() => {
    const onDoc = (e) => {
      if (!customerPickerRef.current?.contains(e.target)) {
        setCustomerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredCustomers = useMemo(() => {
    const withId = users.filter((u) => getUserOptionValue(u));
    const q = customerFilter.trim().toLowerCase();
    const qDigits = digitsOnlyFromPhone(customerFilter);
    let list = withId;
    if (q || qDigits) {
      list = withId.filter((u) => {
        const label = formatUserOptionLabel(u).toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const phoneDigits = digitsOnlyFromPhone(u.mobile || u.phone || u.phoneNumber || '');
        if (label.includes(q)) return true;
        if (email && email.includes(q)) return true;
        if (qDigits && phoneDigits.includes(qDigits)) return true;
        return false;
      });
    }
    const cap = 150;
    return { rows: list.slice(0, cap), capped: list.length > cap };
  }, [users, customerFilter]);

  useEffect(() => {
    const defaultCustomerId = getDefaultPosCustomerUserId(users);
    if (!defaultCustomerId) return;
    const selectedStillExists = users.some((u) => getUserOptionValue(u) === selectedCustomerId);
    if (!selectedCustomerId || !selectedStillExists) {
      setSelectedCustomerId(defaultCustomerId);
    }
  }, [users, selectedCustomerId]);

  const addToCart = useCallback(
    (product) => {
      if (!product || typeof product !== 'object') return;
      if (isVariableParentProduct(product)) {
        toast.warning(
          'This is a variable product. Add a size/color variation from the product list instead.'
        );
        return;
      }
      const productId = sellablePosProductId(product);
      if (!productId) return;
      const name = product.name || product.product_name || 'Product';
      const unitPrice = parsePosUnitPrice(product);
      const availableStock = getProductAvailableStock(product, {
        warehouseId: defaultWarehouseId,
      });

      unlockPosScanAudio();
      let added = false;
      let blockMsg = '';

      setCartLines((prev) => {
        const i = prev.findIndex((l) => l.productId === productId);
        const currentQty = i >= 0 ? parsePosQty(prev[i].quantity) : 0;
        const nextQty = currentQty + 1;
        const stockInCart = i >= 0 ? (prev[i].availableStock ?? availableStock) : availableStock;

        const stockBlock = posStockBlocksQty({
          allowWhenInsufficient: allowAddWhenStockInsufficient,
          availableStock: stockInCart,
          requestedQty: nextQty,
          productName: name,
        });
        if (stockBlock) {
          blockMsg = stockBlock;
          return prev;
        }

        added = true;
        const order = cartDisplayOrderRef.current;
        if (i >= 0) {
          const next = [...prev];
          next[i] = {
            ...next[i],
            quantity: formatPosQtyLabel(nextQty),
            availableStock: stockInCart,
          };
          return isPosCartAmountOrder(order) ? sortCartLinesByOrder(next, order) : next;
        }
        const newLine = {
          productId,
          name,
          unitPrice,
          quantity: '1',
          availableStock,
          addedSeq: nextCartLineSeq(prev),
          category_id:
            String(
              product.category_id ??
                product.categoryId ??
                product.category?._id ??
                product.category?.id ??
                ''
            ).trim() || undefined,
        };
        if (isPosCartValueOrder(order)) {
          return sortCartLinesByOrder([...prev, newLine], order);
        }
        // FIFO: oldest first (append). LIFO: newest first (prepend).
        return order === POS_CART_ORDER_LIFO ? [newLine, ...prev] : [...prev, newLine];
      });

      if (blockMsg) {
        playPosScanBeep('error');
        queueMicrotask(() => showStockErrorToast(blockMsg, { delay: 5000 }));
        return;
      }
      if (added) playPosScanBeep('success');
    },
    [defaultWarehouseId, allowAddWhenStockInsufficient]
  );

  const setCartOrderMode = useCallback((nextOrder) => {
    if (!POS_CART_ORDER_MODES.has(nextOrder)) return;
    const prevOrder = cartDisplayOrderRef.current;
    if (prevOrder === nextOrder) {
      if (isPosCartValueOrder(nextOrder)) {
        setCartLines((lines) => sortCartLinesByOrder(lines, nextOrder));
      }
      return;
    }

    cartDisplayOrderRef.current = nextOrder;
    setCartDisplayOrder(nextOrder);
    setCartLines((lines) => sortCartLinesByOrder(ensureCartLineSeq(lines, prevOrder), nextOrder));
    persistCartDisplayOrder(nextOrder);
  }, []);

  const handleAmountOrderClick = useCallback(() => {
    const current = cartDisplayOrderRef.current;
    const next =
      current === POS_CART_ORDER_AMOUNT_ASC
        ? POS_CART_ORDER_AMOUNT_DESC
        : POS_CART_ORDER_AMOUNT_ASC;
    setCartOrderMode(next);
  }, [setCartOrderMode]);

  const handlePriceOrderClick = useCallback(() => {
    const current = cartDisplayOrderRef.current;
    const next =
      current === POS_CART_ORDER_PRICE_ASC ? POS_CART_ORDER_PRICE_DESC : POS_CART_ORDER_PRICE_ASC;
    setCartOrderMode(next);
  }, [setCartOrderMode]);

  const updatePosLayout = useCallback((patch) => {
    setPosLayout((prev) => {
      const next = {
        orderWidth: clampOrderPanelWidth(
          patch.orderWidth !== undefined ? patch.orderWidth : prev.orderWidth
        ),
        swapped: patch.swapped !== undefined ? Boolean(patch.swapped) : prev.swapped,
        productCols: clampProductCols(
          patch.productCols !== undefined ? patch.productCols : prev.productCols
        ),
      };
      persistPosLayout(next, posLayoutCompanyIdRef.current);
      return next;
    });
  }, []);

  const handleOrderPanelWidthChange = useCallback(
    (e) => {
      updatePosLayout({ orderWidth: e.target.value });
    },
    [updatePosLayout]
  );

  const handleProductColsChange = useCallback(
    (e) => {
      updatePosLayout({ productCols: e.target.value });
    },
    [updatePosLayout]
  );

  const handleSwapPanels = useCallback(() => {
    setPosLayout((prev) => {
      const next = { ...prev, swapped: !prev.swapped };
      persistPosLayout(next, posLayoutCompanyIdRef.current);
      return next;
    });
  }, []);

  const handleResetPosLayout = useCallback(() => {
    const next = persistPosLayout({ ...POS_LAYOUT_DEFAULT }, posLayoutCompanyIdRef.current);
    setPosLayout(next);
  }, []);

  const closeLayoutSettings = useCallback(() => {
    setPosLayout((prev) => {
      persistPosLayout(prev, posLayoutCompanyIdRef.current);
      return prev;
    });
    setLayoutSettingsOpen(false);
  }, []);

  const bumpCartQty = useCallback(
    (productId, delta) => {
      setCartLines((prev) => {
        const nextLines = prev.flatMap((l) => {
          if (l.productId !== productId) return [l];
          const next = roundPosQty(parsePosQty(l.quantity) + delta);
          if (next < POS_QTY_MIN) return [];

          if (delta > 0) {
            const blockMsg = posStockBlocksQty({
              allowWhenInsufficient: allowAddWhenStockInsufficient,
              availableStock: l.availableStock,
              requestedQty: next,
              productName: l.name,
            });
            if (blockMsg) {
              queueMicrotask(() => showStockErrorToast(blockMsg, { delay: 5000 }));
              return [l];
            }
          }

          return [{ ...l, quantity: formatPosQtyLabel(next) }];
        });
        const order = cartDisplayOrderRef.current;
        return isPosCartAmountOrder(order) ? sortCartLinesByOrder(nextLines, order) : nextLines;
      });
    },
    [allowAddWhenStockInsufficient]
  );

  const removeCartLine = useCallback((productId) => {
    setCartLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const setCartQty = useCallback((productId, raw) => {
    const sanitized = sanitizePosQtyInput(raw);
    setCartLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: sanitized } : l))
    );
  }, []);

  const commitCartQty = useCallback(
    (productId) => {
      setCartLines((prev) => {
        const nextLines = prev.flatMap((l) => {
          if (l.productId !== productId) return [l];
          const q = parsePosQty(l.quantity);
          if (q < POS_QTY_MIN) return [];

          const blockMsg = posStockBlocksQty({
            allowWhenInsufficient: allowAddWhenStockInsufficient,
            availableStock: l.availableStock,
            requestedQty: q,
            productName: l.name,
          });
          if (blockMsg) {
            queueMicrotask(() => showStockErrorToast(blockMsg, { delay: 5000 }));
            if (
              l.availableStock != null &&
              Number.isFinite(l.availableStock) &&
              l.availableStock >= POS_QTY_MIN
            ) {
              return [{ ...l, quantity: formatPosQtyLabel(Math.min(q, l.availableStock)) }];
            }
            return [];
          }

          return [{ ...l, quantity: formatPosQtyLabel(q) }];
        });
        const order = cartDisplayOrderRef.current;
        return isPosCartAmountOrder(order) ? sortCartLinesByOrder(nextLines, order) : nextLines;
      });
    },
    [allowAddWhenStockInsufficient]
  );

  const setCartUnitPrice = useCallback((productId, raw) => {
    const n = parseFloat(String(raw).replace(/,/g, ''));
    const unitPrice = Number.isFinite(n) && n >= 0 ? n : 0;
    setCartLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  }, []);

  const commitCartUnitPrice = useCallback(() => {
    const order = cartDisplayOrderRef.current;
    if (!isPosCartValueOrder(order)) return;
    setCartLines((lines) => sortCartLinesByOrder(lines, order));
  }, []);

  const cartSubtotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + parsePosQty(l.quantity) * l.unitPrice, 0),
    [cartLines]
  );

  const cartTotalQty = useMemo(
    () => cartLines.reduce((sum, l) => sum + parsePosQty(l.quantity), 0),
    [cartLines]
  );

  const filteredCartLines = useMemo(() => {
    const q = String(cartProductFilter ?? '')
      .trim()
      .toLowerCase();
    if (!q) return cartLines;
    return cartLines.filter((line) => {
      const name = String(line?.name ?? '').toLowerCase();
      const productId = String(line?.productId ?? '').toLowerCase();
      return name.includes(q) || productId.includes(q);
    });
  }, [cartLines, cartProductFilter]);

  const shippingNum = useMemo(() => {
    const n = parseFloat(String(shipping).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [shipping]);

  const extraDiscountNum = useMemo(() => {
    const n = parseFloat(String(extraDiscount).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [extraDiscount]);

  const extraDiscountPercentNum = useMemo(() => {
    const n = parseFloat(String(extraDiscountPercent).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [extraDiscountPercent]);

  useEffect(() => {
    if (discountEditSourceRef.current === 'percent') {
      const pct = String(extraDiscountPercent).trim();
      if (!pct) {
        setExtraDiscount('');
        return;
      }
      if (isPartialDiscountInput(pct)) return;
      setExtraDiscount(amountFromDiscountPercent(cartSubtotal, pct));
      return;
    }
    if (discountEditSourceRef.current === 'amount') {
      const amt = String(extraDiscount).trim();
      if (!amt) {
        setExtraDiscountPercent('');
        return;
      }
      if (isPartialDiscountInput(amt)) return;
      setExtraDiscountPercent(percentFromDiscountAmount(cartSubtotal, amt));
    }
  }, [cartSubtotal, extraDiscountPercent, extraDiscount]);

  const handleExtraDiscountPercentChange = useCallback(
    (e) => {
      const raw = e.target.value;
      discountEditSourceRef.current = 'percent';
      setExtraDiscountPercent(raw);
      if (!raw.trim() || isPartialDiscountInput(raw)) {
        if (!raw.trim()) setExtraDiscount('');
        return;
      }
      setExtraDiscount(amountFromDiscountPercent(cartSubtotal, raw));
    },
    [cartSubtotal]
  );

  const handleExtraDiscountChange = useCallback(
    (e) => {
      const raw = e.target.value;
      discountEditSourceRef.current = 'amount';
      setExtraDiscount(raw);
      if (!raw.trim() || isPartialDiscountInput(raw)) {
        if (!raw.trim()) setExtraDiscountPercent('');
        return;
      }
      setExtraDiscountPercent(percentFromDiscountAmount(cartSubtotal, raw));
    },
    [cartSubtotal]
  );

  const grandTotal = useMemo(() => {
    const v = cartSubtotal + shippingNum - extraDiscountNum;
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }, [cartSubtotal, shippingNum, extraDiscountNum]);

  const savePosOrder = useCallback(
    async (payment) => {
      const tAll = performance.now();
      const timingSteps = [];
      console.log('[POS] savePosOrder start', {
        payment,
        isOnline,
        cartLineCount: cartLines.length,
      });
      const normalized = normalizeCartLinesForCheckout(cartLines);
      if (normalized.error) {
        console.log('[POS] savePosOrder blocked: cart invalid', normalized.error);
        alert(normalized.error);
        return null;
      }

      let linesForSave = normalized.lines;
      if (isOnline) {
        try {
          console.log('[POS] savePosOrder → refresh stock');
          const tStock = performance.now();
          const refreshed = await refreshCartLineStock(linesForSave, defaultWarehouseId);
          timingSteps.push({
            name: 'refreshCartLineStock',
            ms: refreshed.ms ?? posElapsedMs(tStock),
          });
          linesForSave = refreshed.lines;
          setCartLines(linesForSave);
          if (
            toastCartProductValidationErrors({
              missingIds: refreshed.missingIds,
              variableParentIds: refreshed.variableParentIds,
              inactiveIds: refreshed.inactiveIds,
              cartLines: linesForSave,
            })
          ) {
            console.log('[POS] savePosOrder blocked: product validation', {
              missingIds: refreshed.missingIds,
              variableParentIds: refreshed.variableParentIds,
              inactiveIds: refreshed.inactiveIds,
            });
            posLogTimingSummary('savePosOrder (blocked)', timingSteps);
            return null;
          }
        } catch (err) {
          console.warn('[POS] Could not refresh stock before saving order', err);
        }

        // When allow is ON, insufficient stock may be sold. When OFF, enforce before save.
        if (!allowAddWhenStockInsufficient) {
          const stockIssues = collectCartStockIssues(linesForSave, {
            allowWhenInsufficient: false,
          });
          if (stockIssues.length) {
            console.log('[POS] savePosOrder blocked: insufficient stock', stockIssues);
            posLogTimingSummary('savePosOrder (blocked)', timingSteps);
            showStockErrorToast(formatCartStockIssueToast(stockIssues), { delay: 5000 });
            return null;
          }
        }
      }

      const customer = users.find((u) => getUserOptionValue(u) === selectedCustomerId) || null;
      const name = customer?.name || customer?.fullName || customer?.username || 'Walk-in Client';
      const email = customer?.email || 'test@gmail.com';
      const phone = customer?.mobile || customer?.phone || customer?.phoneNumber || '0000000000';
      const address = '';

      const lines = linesForSave.map((line) => ({
        productId: line.productId,
        qty: parsePosQty(line.quantity),
        price: line.unitPrice,
      }));

      const invalidQty = lines.find((line) => line.qty < POS_QTY_MIN);
      if (invalidQty) {
        alert(`Each line needs quantity of at least ${POS_QTY_MIN} (e.g. 2.45).`);
        return null;
      }

      const orderPayload = {
        name,
        email,
        phone,
        address,
        lines,
        shipping: shippingNum || 0,
        shipment: shippingNum || 0,
        discount: extraDiscountNum || 0,
        discount_percentage: extraDiscountPercentNum || 0,
        order_status: 'placed',
        amount_received: payment?.paid ?? 0,
        change_given: payment?.change ?? 0,
        remaining_amount: payment?.balanceDue ?? 0,
        posPayMethod: payment?.paymentMethodId || undefined,
        payment_method_id: payment?.paymentMethodId || undefined,
        customer_id: selectedCustomerId || undefined,
        createdAt: moment(orderDateTime).isValid()
          ? moment(orderDateTime).toISOString()
          : moment().toISOString(),
      };

      console.log('[POS] savePosOrder payload', orderPayload);

      const cartSnapshot = linesForSave.map((line) => ({ ...line }));
      const customerInfo = { name, email, phone };

      if (!isOnline) {
        console.log('[POS] savePosOrder → offline IndexedDB save');
        const tOffline = performance.now();
        const offlineResult = await saveOfflineOrder({
          payload: orderPayload,
          cartSnapshot,
          warehouseId: defaultWarehouseId,
        });
        timingSteps.push({ name: 'saveOfflineOrder', ms: posElapsedMs(tOffline) });
        console.log('[POS] savePosOrder offline ok', {
          sec: posMsToSec(posElapsedMs(tOffline)),
          ms: posElapsedMs(tOffline),
          offlineResult,
        });
        posLogTimingSummary('savePosOrder', [
          ...timingSteps,
          { name: 'TOTAL', ms: posElapsedMs(tAll) },
        ]);
        return buildOfflineSaveResult(offlineResult, {
          ...customerInfo,
          cartSnapshot,
        });
      }

      try {
        console.log('[POS] API → POST order/order_save');
        const tSave = performance.now();
        const result = await createPosOrderRequest(orderPayload);
        timingSteps.push({ name: 'POST order/order_save', ms: posElapsedMs(tSave) });
        console.log('[POS] order/order_save ok', {
          sec: posMsToSec(posElapsedMs(tSave)),
          ms: posElapsedMs(tSave),
          result,
        });
        posLogTimingSummary('savePosOrder', [
          ...timingSteps,
          { name: 'TOTAL', ms: posElapsedMs(tAll) },
        ]);
        return {
          result,
          offline: false,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          cartSnapshot,
        };
      } catch (err) {
        if (isLikelyNetworkError(err)) {
          console.warn('[POS] Online save failed, saving offline instead', err);
          const tOffline = performance.now();
          const offlineResult = await saveOfflineOrder({
            payload: orderPayload,
            cartSnapshot,
            warehouseId: defaultWarehouseId,
          });
          timingSteps.push({ name: 'saveOfflineOrder (fallback)', ms: posElapsedMs(tOffline) });
          console.log('[POS] savePosOrder fallback offline ok', offlineResult);
          posLogTimingSummary('savePosOrder', [
            ...timingSteps,
            { name: 'TOTAL', ms: posElapsedMs(tAll) },
          ]);
          return buildOfflineSaveResult(offlineResult, {
            ...customerInfo,
            cartSnapshot,
          });
        }
        posLogTimingSummary('savePosOrder (error)', [
          ...timingSteps,
          { name: 'TOTAL', ms: posElapsedMs(tAll) },
        ]);
        throw err;
      }
    },
    [
      cartLines,
      users,
      selectedCustomerId,
      shippingNum,
      extraDiscountNum,
      extraDiscountPercentNum,
      orderDateTime,
      defaultWarehouseId,
      isOnline,
      allowAddWhenStockInsufficient,
    ]
  );

  const handlePaymentClick = useCallback(async () => {
    const tAll = performance.now();
    const timingSteps = [];
    console.log('[POS] Payment button clicked', {
      paymentPreparing,
      orderSaving,
      isOnline,
      cartLineCount: cartLines.length,
      allowAddWhenStockInsufficient,
    });
    if (paymentPreparing || orderSaving) {
      console.log('[POS] Payment click ignored (busy)');
      return;
    }

    const normalized = normalizeCartLinesForCheckout(cartLines);
    if (normalized.error) {
      console.log('[POS] Payment blocked: cart invalid', normalized.error);
      toast.warning(normalized.error);
      return;
    }

    let linesForPayment = normalized.lines;
    setCartLines(normalized.lines);
    setPaymentPreparing(true);
    console.log('[POS] Payment preparing…', { lines: linesForPayment });

    try {
      if (isOnline) {
        try {
          console.log('[POS] Payment → refresh stock');
          const tStock = performance.now();
          const refreshed = await refreshCartLineStock(linesForPayment, defaultWarehouseId);
          timingSteps.push({
            name: 'refreshCartLineStock',
            ms: refreshed.ms ?? posElapsedMs(tStock),
          });
          linesForPayment = refreshed.lines;
          setCartLines(linesForPayment);
          if (
            toastCartProductValidationErrors({
              missingIds: refreshed.missingIds,
              variableParentIds: refreshed.variableParentIds,
              inactiveIds: refreshed.inactiveIds,
              cartLines: linesForPayment,
            })
          ) {
            console.log('[POS] Payment blocked: product validation', {
              missingIds: refreshed.missingIds,
              variableParentIds: refreshed.variableParentIds,
              inactiveIds: refreshed.inactiveIds,
            });
            posLogTimingSummary('Payment button click (blocked)', [
              ...timingSteps,
              { name: 'TOTAL', ms: posElapsedMs(tAll) },
            ]);
            return;
          }
        } catch (err) {
          console.warn('[POS] Could not refresh stock before payment', err);
        }

        // When allow is ON, insufficient stock may be sold. When OFF, enforce before payment.
        if (!allowAddWhenStockInsufficient) {
          const stockIssues = collectCartStockIssues(linesForPayment, {
            allowWhenInsufficient: false,
          });
          if (stockIssues.length) {
            console.log('[POS] Payment blocked: insufficient stock', stockIssues);
            posLogTimingSummary('Payment button click (blocked)', [
              ...timingSteps,
              { name: 'TOTAL', ms: posElapsedMs(tAll) },
            ]);
            showStockErrorToast(formatCartStockIssueToast(stockIssues), { delay: 8000 });
            return;
          }
        }
      } else {
        console.log('[POS] Payment offline — skip stock APIs');
      }

      console.log('[POS] Opening Make Payment modal');
      openPosPaymentModal();
    } finally {
      setPaymentPreparing(false);
      console.log('[POS] Payment preparing finished', {
        sec: posMsToSec(posElapsedMs(tAll)),
        ms: posElapsedMs(tAll),
      });
      posLogTimingSummary('Payment button click', [
        ...timingSteps,
        { name: 'TOTAL', ms: posElapsedMs(tAll) },
      ]);
    }
  }, [
    cartLines,
    defaultWarehouseId,
    isOnline,
    allowAddWhenStockInsufficient,
    paymentPreparing,
    orderSaving,
  ]);

  const clearCartAfterSale = useCallback(() => {
    const nextDateTime = nowDatetimeLocalValue();
    setCartLines([]);
    setShipping('');
    setOrderDateTime(nextDateTime);
    setExtraDiscount('');
    setExtraDiscountPercent('');
    discountEditSourceRef.current = null;
    setActiveDraftId(null);
    persistCartSession(
      {
        cartLines: [],
        selectedCustomerId,
        shipping: '',
        orderDateTime: nextDateTime,
        extraDiscount: '',
        extraDiscountPercent: '',
        activeDraftId: null,
      },
      companyId,
      userId
    );
  }, [selectedCustomerId, companyId, userId]);

  const draftOrders = useMemo(() => normalizeCompanyDraftOrders(authCompany), [authCompany]);

  const refreshCompanyAfterDraftMutate = useCallback(
    async (apiBody) => {
      const fromResponse = getCompanyFromApiBody(apiBody);
      if (fromResponse) {
        dispatch(setCompany(mergeCompanyRecordForSettings(fromResponse, authCompanyRef.current)));
        return fromResponse;
      }
      if (!companyId) return null;
      const body = await fetchCompanyById(companyId);
      const fetched = getCompanyFromApiBody(body);
      if (fetched) {
        dispatch(setCompany(mergeCompanyRecordForSettings(fetched, authCompanyRef.current)));
      }
      return fetched;
    },
    [companyId, dispatch]
  );

  const buildDraftPayload = useCallback(
    () => ({
      cartLines,
      selectedCustomerId,
      shipping,
      orderDateTime,
      extraDiscount,
      extraDiscountPercent,
      grandTotal,
      savedAt: new Date().toISOString(),
    }),
    [
      cartLines,
      selectedCustomerId,
      shipping,
      orderDateTime,
      extraDiscount,
      extraDiscountPercent,
      grandTotal,
    ]
  );

  const handleSaveDraft = useCallback(async () => {
    if (!isOnline) {
      toast.error('Connect to the internet to save drafts');
      return;
    }
    if (!companyId) {
      toast.error('Company not found — cannot save draft');
      return;
    }
    if (cartLines.length === 0) {
      toast.warning('Cart is empty — add items before saving a draft');
      return;
    }

    const suggested = defaultDraftLabel(grandTotal);
    const entered = window.prompt('Draft label', suggested);
    if (entered === null) return;
    const label = String(entered).trim() || suggested;
    const payload = buildDraftPayload();
    const selectedCustomer = selectedCustomerId
      ? users.find((u) => getUserOptionValue(u) === selectedCustomerId)
      : null;
    payload.customerName = selectedCustomer
      ? formatUserOptionLabel(selectedCustomer) || 'Customer'
      : 'Walk in';
    const currentUserName = resolveBillCurrentUserName(authUser, null, authUserName);
    const currentUserId =
      authUser?._id != null
        ? String(authUser._id)
        : authUser?.id != null
          ? String(authUser.id)
          : '';
    const existingDraft =
      activeDraftId != null
        ? draftOrders.find((d) => String(d._id) === String(activeDraftId))
        : null;
    const existingSavedBy = existingDraft ? resolveDraftSavedByName(existingDraft) : '';
    const savedByName = existingSavedBy || currentUserName;
    if (savedByName) {
      payload.savedByName = savedByName;
      payload.created_by_name = savedByName;
    }
    if (currentUserId && !payload.savedById && !existingDraft?.payload?.savedById) {
      payload.savedById = currentUserId;
    } else if (existingDraft?.payload?.savedById) {
      payload.savedById = existingDraft.payload.savedById;
    }

    const draftMeta = {
      payload,
      label,
      created_by: existingDraft?.created_by || currentUserId || undefined,
      created_by_name: savedByName || undefined,
      saved_by_name: savedByName || undefined,
    };

    setDraftSaving(true);
    try {
      let result;
      if (activeDraftId) {
        result = await updateCompanyDraftOrder(companyId, activeDraftId, draftMeta);
      } else {
        result = await addCompanyDraftOrder(companyId, draftMeta);
      }
      await refreshCompanyAfterDraftMutate(result);
      clearCartAfterSale();
      toast.success(activeDraftId ? 'Draft updated' : 'Draft saved');
    } catch (err) {
      console.error('[POS] Failed to save draft', err);
      toast.error(err?.message || 'Failed to save draft');
    } finally {
      setDraftSaving(false);
    }
  }, [
    isOnline,
    companyId,
    cartLines.length,
    grandTotal,
    buildDraftPayload,
    activeDraftId,
    draftOrders,
    authUser,
    authUserName,
    selectedCustomerId,
    users,
    refreshCompanyAfterDraftMutate,
    clearCartAfterSale,
  ]);

  const applyDraftPayload = useCallback((payload) => {
    const data = payload && typeof payload === 'object' ? payload : {};
    setCartLines(Array.isArray(data.cartLines) ? data.cartLines : []);
    if (data.selectedCustomerId != null && data.selectedCustomerId !== '') {
      setSelectedCustomerId(String(data.selectedCustomerId));
    }
    setShipping(data.shipping != null ? String(data.shipping) : '');
    setOrderDateTime(toDatetimeLocalValue(data.orderDateTime ?? data.createdAt));
    setExtraDiscount(data.extraDiscount != null ? String(data.extraDiscount) : '');
    setExtraDiscountPercent(
      data.extraDiscountPercent != null ? String(data.extraDiscountPercent) : ''
    );
    discountEditSourceRef.current = null;
  }, []);

  const handleOpenDrafts = useCallback(() => {
    if (!isOnline) {
      toast.error('Connect to the internet to load drafts');
      return;
    }
    openPosDraftsModal();
  }, [isOnline]);

  const handleLoadDraft = useCallback(
    (draft) => {
      if (!isOnline) {
        toast.error('Connect to the internet to load drafts');
        return;
      }
      if (!draft) return;
      if (cartLines.length > 0) {
        const ok = window.confirm(
          'Replace the current cart with this draft? Unsaved cart changes will be lost.'
        );
        if (!ok) return;
      }
      applyDraftPayload(draft.payload);
      setActiveDraftId(String(draft._id));
      closePosDraftsModal();
      toast.success(`Loaded draft "${draft.label || 'Draft'}"`);
    },
    [isOnline, cartLines.length, applyDraftPayload]
  );

  const handleDeleteDraft = useCallback(
    async (draft) => {
      if (!isOnline) {
        toast.error('Connect to the internet to delete drafts');
        return;
      }
      if (!companyId || !draft?._id) return;
      const ok = window.confirm(`Delete draft "${draft.label || 'Draft'}"?`);
      if (!ok) return;

      setDraftDeletingId(String(draft._id));
      try {
        const result = await removeCompanyDraftOrder(companyId, draft._id);
        await refreshCompanyAfterDraftMutate(result);
        if (activeDraftId && String(activeDraftId) === String(draft._id)) {
          setActiveDraftId(null);
        }
        toast.success('Draft deleted');
      } catch (err) {
        console.error('[POS] Failed to delete draft', err);
        toast.error(err?.message || 'Failed to delete draft');
      } finally {
        setDraftDeletingId(null);
      }
    },
    [isOnline, companyId, activeDraftId, refreshCompanyAfterDraftMutate]
  );

  const handlePaymentComplete = useCallback(
    async (payment) => {
      const tAll = performance.now();
      console.log('[POS] Pay Now clicked', payment);
      setOrderSaving(true);
      try {
        const saved = await savePosOrder(payment);
        if (!saved) {
          console.log('[POS] Pay Now aborted (save returned null)', {
            sec: posMsToSec(posElapsedMs(tAll)),
            ms: posElapsedMs(tAll),
          });
          return false;
        }
        console.log('[POS] Pay Now save result', {
          sec: posMsToSec(posElapsedMs(tAll)),
          ms: posElapsedMs(tAll),
          offline: saved.offline,
          invoiceHint: saved.offline
            ? saved.localInvoiceNo || saved.result?.local_invoice_no
            : saved.result,
        });
        if (saved.offline) {
          toast.success('Sale saved offline — will sync when online', { delay: 6000 });
        } else {
          showToast('successToast', 'Order saved successfully.');
        }
        clearCartAfterSale();
        console.log('[POS] Pay Now complete — cart cleared', {
          sec: posMsToSec(posElapsedMs(tAll)),
          ms: posElapsedMs(tAll),
        });
        return true;
      } catch (e) {
        console.error('[POS] Failed to save order', e, {
          sec: posMsToSec(posElapsedMs(tAll)),
          ms: posElapsedMs(tAll),
        });
        showStockErrorToast(
          formatPosOrderErrorMessage(e?.message, {
            cartLines,
            productId: e?.productId,
            productName: e?.productName,
          }),
          { delay: 8000 }
        );
        return false;
      } finally {
        setOrderSaving(false);
      }
    },
    [savePosOrder, clearCartAfterSale, cartLines]
  );

  const handlePaymentCompletePrint = useCallback(
    async (payment) => {
      const tAll = performance.now();
      console.log('[POS] Pay Now & Print clicked', payment);
      setOrderSaving(true);
      try {
        const saved = await savePosOrder(payment);
        if (!saved) {
          console.log('[POS] Pay Now & Print aborted (save returned null)', {
            sec: posMsToSec(posElapsedMs(tAll)),
            ms: posElapsedMs(tAll),
          });
          return false;
        }

        const invoiceNo = saved.offline
          ? saved.localInvoiceNo || saved.result?.local_invoice_no
          : pickOrderInvoiceNoFromSaveResponse(saved.result) || moment().format('YYYYMMDDHHmmss');
        const savedOrder = saved.offline ? null : pickOrderFromSaveResult(saved.result);
        const publicUrl = saved.offline
          ? ''
          : buildPublicInvoiceUrl(pickPublicInvoiceToken(savedOrder));

        let settings = printerSettings;
        let brand = companyBrand;
        if (isOnline) {
          const companyId =
            getCompanyIdFromUser(authUser) ||
            String(authCompany?._id ?? authCompany?.id ?? '').trim();
          if (companyId) {
            try {
              const body = await fetchCompanyById(companyId);
              const company = getCompanyFromApiBody(body);
              if (company && typeof company === 'object') {
                const merged = mergeCompanyRecordForSettings(company, authCompany);
                settings = mergePrinterSettings(
                  extractPrinterSettingsFromCompanyBody({ data: merged })
                );
                brand = buildCompanyBrandFromRecord(merged);
              }
            } catch {
              // print with last known settings
            }
          }
        }

        const receipt = buildThermalReceiptFromCart({
          cartLines: saved.cartSnapshot,
          customerName: saved.customerName,
          customerEmail: saved.customerEmail,
          customerPhone: saved.customerPhone,
          payment,
          cartSubtotal,
          shippingNum,
          extraDiscountNum,
          extraDiscountPercentNum,
          grandTotal,
          invoiceNo,
          publicUrl,
          companyName: brand.name,
          orderDateTime,
        });
        const cashierName = resolveBillCurrentUserName(authUser, null, authUserName);
        if (cashierName) {
          receipt.cashier = cashierName;
          receipt.currentUserName = cashierName;
        }
        if (saved.offline) {
          receipt.terms = OFFLINE_RECEIPT_FOOTER;
        }

        const bridgePrinted = await printPosOrderViaBridge({
          receipt,
          payment,
          companyBrand: brand,
          cartLines: saved.cartSnapshot,
          invoiceNo,
          defaultPrinter: defaultPrinterSettings,
        });

        let printed = bridgePrinted;
        if (!bridgePrinted) {
          printed = await openThermalReceiptPrint(receipt, {
            documentTitlePrefix: 'Receipt',
            invoiceNumberPrefix: saved.offline ? 'OFF#' : 'POS#',
            printerSettings: settings,
            companyBrand: brand,
            footerThankYou: saved.offline ? OFFLINE_RECEIPT_FOOTER : undefined,
            sourceOrder: {
              amount_received: payment?.paid ?? 0,
              change_given: payment?.change ?? 0,
            },
          });
          if (!printed) {
            toast.error(
              'Allow pop-ups to print the thermal receipt, or configure the print bridge in Printer Settings.',
              { delay: 6000 }
            );
          }
        }

        if (saved.offline) {
          toast.success('Sale saved offline — will sync when online', { delay: 6000 });
        } else {
          showToast(
            'successToast',
            bridgePrinted
              ? 'Order saved and sent to network printer.'
              : 'Order saved and sent to printer.'
          );
        }
        clearCartAfterSale();
        return true;
      } catch (e) {
        console.error('[POS] Failed to save order for print', e);
        showStockErrorToast(
          formatPosOrderErrorMessage(e?.message, {
            cartLines,
            productId: e?.productId,
            productName: e?.productName,
          }),
          { delay: 8000 }
        );
        return false;
      } finally {
        setOrderSaving(false);
      }
    },
    [
      savePosOrder,
      clearCartAfterSale,
      cartLines,
      cartSubtotal,
      shippingNum,
      extraDiscountNum,
      extraDiscountPercentNum,
      grandTotal,
      orderDateTime,
      printerSettings,
      defaultPrinterSettings,
      companyBrand,
      authUser,
      authUserName,
      authCompany,
      isOnline,
    ]
  );

  const openAddCustomerModal = () => {
    const qDigits = digitsOnlyFromPhone(customerFilter).slice(0, 11);
    setAddCustomerForm(
      qDigits ? { ...ADD_CUSTOMER_INITIAL, phone: qDigits } : ADD_CUSTOMER_INITIAL
    );
    setAddCustomerErrors({});
    setCreateCustomerError('');
    setShowAddCustomerLocation(false);
    setCustomerMenuOpen(false);
    const el = document.getElementById('posAddCustomerModal');
    if (el && window.bootstrap?.Modal) {
      const M = window.bootstrap.Modal;
      const instance =
        typeof M.getOrCreateInstance === 'function'
          ? M.getOrCreateInstance(el)
          : M.getInstance(el) || new M(el);
      instance.show();
    }
  };

  const closeAddCustomerModal = () => {
    const el = document.getElementById('posAddCustomerModal');
    if (el && window.bootstrap?.Modal) {
      const instance = window.bootstrap.Modal.getInstance(el);
      instance?.hide();
    }
  };

  const validateAddCustomer = () => {
    const next = {};
    if (!addCustomerForm.name.trim()) {
      next.name = 'Name is required';
    }
    const emailTrim = addCustomerForm.email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      next.email = 'Enter a valid email';
    }
    if (!addCustomerForm.phone.trim()) {
      next.phone = 'Phone is required';
    } else {
      const phoneDigits = digitsOnlyFromPhone(addCustomerForm.phone);
      if (phoneDigits.length < 7) {
        next.phone = 'Enter a valid phone number (at least 7 digits)';
      } else if (phoneDigits.length > 11) {
        next.phone = 'Phone number must be 11 digits or less';
      }
    }
    setAddCustomerErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddCustomerFieldChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' ? digitsOnlyFromPhone(value).slice(0, 11) : value;
    setAddCustomerForm((prev) => ({ ...prev, [name]: nextValue }));
    if (addCustomerErrors[name]) {
      setAddCustomerErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setCreateCustomerError('');
  };

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    setCreateCustomerError('');
    if (!validateAddCustomer()) {
      return;
    }
    setCreateCustomerSubmitting(true);
    try {
      const resolvedEmail = resolvePosCustomerEmail(addCustomerForm.email, addCustomerForm.phone);
      const json = await createCustomerUserRequest({
        name: addCustomerForm.name,
        email: addCustomerForm.email,
        phone: addCustomerForm.phone,
        password: POS_DEFAULT_CUSTOMER_PASSWORD,
        role: ['CUSTOMER'],
        city: showAddCustomerLocation ? addCustomerForm.city : '',
        state: showAddCustomerLocation ? addCustomerForm.state : '',
        area: showAddCustomerLocation ? addCustomerForm.area : '',
      });
      const created = pickCreatedUserFromResponse(json);
      const newId = getUserOptionValue(created);
      await loadUsers({
        preferId: newId || undefined,
        fallbackEmail: newId ? undefined : resolvedEmail,
      });
      setAddCustomerForm(ADD_CUSTOMER_INITIAL);
      setShowAddCustomerLocation(false);
      closeAddCustomerModal();
    } catch (err) {
      console.error('[POS] Create customer failed', err);
      setCreateCustomerError(err?.message || 'Could not create customer');
    } finally {
      setCreateCustomerSubmitting(false);
    }
  };

  return (
    <div className="pos-page container-fluid py-4 px-3 px-lg-4">
      <OfflineSyncPanel />
      <AppModal
        open={layoutSettingsOpen}
        onClose={closeLayoutSettings}
        title="Layout settings"
        subtitle="Resize panels, swap sides, and change product card size."
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn-link btn-sm mb-0"
              onClick={handleResetPosLayout}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm mb-0"
              onClick={closeLayoutSettings}
            >
              Done
            </button>
          </>
        }
      >
        <div className="pos-layout-settings">
          <label className="pos-layout-settings__label" htmlFor="posOrderPanelWidth">
            <span>Current order</span>
            <span className="pos-layout-settings__value">{posLayout.orderWidth}%</span>
          </label>
          <input
            id="posOrderPanelWidth"
            type="range"
            className="pos-layout-settings__range"
            min={POS_LAYOUT_MIN_ORDER_WIDTH}
            max={POS_LAYOUT_MAX_ORDER_WIDTH}
            step={1}
            value={posLayout.orderWidth}
            onChange={handleOrderPanelWidthChange}
            aria-valuemin={POS_LAYOUT_MIN_ORDER_WIDTH}
            aria-valuemax={POS_LAYOUT_MAX_ORDER_WIDTH}
            aria-valuenow={posLayout.orderWidth}
            aria-label="Current order panel width"
          />
          <div className="pos-layout-settings__meta">
            <span>Products {100 - posLayout.orderWidth}%</span>
            <span>{posLayout.swapped ? 'Products left' : 'Order left'}</span>
          </div>

          <label className="pos-layout-settings__label" htmlFor="posProductCols">
            <span>Product size</span>
            <span className="pos-layout-settings__value">{posLayout.productCols} / row</span>
          </label>
          <input
            id="posProductCols"
            type="range"
            className="pos-layout-settings__range"
            min={POS_LAYOUT_MIN_PRODUCT_COLS}
            max={POS_LAYOUT_MAX_PRODUCT_COLS}
            step={1}
            value={posLayout.productCols}
            onChange={handleProductColsChange}
            aria-valuemin={POS_LAYOUT_MIN_PRODUCT_COLS}
            aria-valuemax={POS_LAYOUT_MAX_PRODUCT_COLS}
            aria-valuenow={posLayout.productCols}
            aria-label="Products per row"
          />
          <div className="pos-layout-settings__meta">
            <span>Bigger cards</span>
            <span>Smaller cards</span>
          </div>

          <button type="button" className="pos-layout-settings__swap" onClick={handleSwapPanels}>
            <NavIcon icon={FaArrowRightArrowLeft} size={12} />
            {posLayout.swapped ? 'Unswap sections' : 'Swap sections'}
          </button>
        </div>
      </AppModal>
      <div className="pos-page-header">
        <div className="pos-master-sync-status">
          {masterSyncProgress?.message ? (
            <span role="status" aria-live="polite">
              {masterSyncRunning && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
              )}
              {masterSyncProgress.message}
            </span>
          ) : (
            <span>Offline catalog ready</span>
          )}
        </div>
        <div className="pos-page-header__actions">
          <button
            type="button"
            className="pos-toolbar-btn"
            id="posLayoutSettingsBtn"
            aria-haspopup="dialog"
            aria-expanded={layoutSettingsOpen}
            title="Layout settings"
            onClick={() => setLayoutSettingsOpen(true)}
          >
            <NavIcon icon={FaGear} size={12} />
            Settings
          </button>
          <button
            type="button"
            className="pos-toolbar-btn pos-toolbar-btn--accent"
            onClick={() => openOfflineSyncPanel()}
          >
            <NavIcon icon={FaCloudArrowUp} size={12} />
            Pending sync
          </button>
          <button
            type="button"
            className="pos-toolbar-btn"
            onClick={handleRefreshCatalog}
            disabled={masterSyncRunning || !isOnline}
            title={
              isOnline ? 'Download latest catalog for offline use' : 'Go online to refresh catalog'
            }
          >
            <NavIcon
              icon={FaArrowsRotate}
              size={12}
              className={masterSyncRunning ? 'pos-toolbar-btn__spin' : undefined}
            />
            {masterSyncRunning ? 'Downloading…' : 'Refresh catalog'}
          </button>
          <OfflineStatusBadge />
        </div>
      </div>
      <div
        className={`row g-4 pos-layout-row${posLayout.swapped ? ' is-swapped' : ''}`}
        style={{
          '--pos-order-width': `${posLayout.orderWidth}%`,
          '--pos-products-width': `${100 - posLayout.orderWidth}%`,
        }}
      >
        {/* Left: checkout */}
        <div className="pos-layout-col pos-layout-col--order">
          <div className="card shadow-sm pos-panel-card h-100">
            <div className="pos-panel-header">
              <h5>Current order</h5>
              <p>Customer, cart lines, and totals</p>
            </div>
            <div className="pos-panel-body">
              <div className="pos-section-label">Customer</div>
              <div className="d-flex gap-2 align-items-start mb-1">
                <div className="flex-grow-1 position-relative" ref={customerPickerRef}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0 text-muted">
                      <SearchInputIcon />
                    </span>
                    <input
                      type="search"
                      className="form-control border-start-0"
                      placeholder="Search name, phone, or email…"
                      value={customerFilter}
                      onChange={(e) => {
                        setCustomerFilter(e.target.value);
                        setCustomerMenuOpen(true);
                      }}
                      onFocus={() => setCustomerMenuOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setCustomerMenuOpen(false);
                      }}
                      disabled={usersStatus === 'loading' && users.length === 0}
                      autoComplete="off"
                      aria-label="Search customers"
                      aria-expanded={customerMenuOpen}
                      aria-controls="pos-customer-picker-list"
                    />
                  </div>
                  {customerMenuOpen && !(usersStatus === 'loading' && users.length === 0) && (
                    <div
                      id="pos-customer-picker-list"
                      className="list-group position-absolute w-100 mt-1 shadow-sm border rounded overflow-hidden bg-white pos-customer-menu"
                      role="listbox"
                    >
                      <button
                        type="button"
                        className={`list-group-item list-group-item-action py-2 px-3 border-0 rounded-0 text-start small ${
                          !selectedCustomerId ? 'active' : ''
                        }`}
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerFilter('');
                          setCustomerMenuOpen(false);
                        }}
                      >
                        Walk In (no customer)
                      </button>
                      {filteredCustomers.rows.map((u) => {
                        const value = getUserOptionValue(u);
                        const selected = selectedCustomerId === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`list-group-item list-group-item-action py-2 px-3 border-0 border-top rounded-0 text-start small ${
                              selected ? 'active' : ''
                            }`}
                            onClick={() => {
                              setSelectedCustomerId(value);
                              setCustomerFilter('');
                              setCustomerMenuOpen(false);
                            }}
                          >
                            {formatUserOptionLabel(u)}
                          </button>
                        );
                      })}
                      {filteredCustomers.rows.length === 0 && (
                        <div className="px-3 py-2 text-muted small">No matching customers</div>
                      )}
                      {filteredCustomers.capped && (
                        <div className="px-3 py-2 text-muted small border-top bg-light">
                          Showing first {filteredCustomers.rows.length} — type to narrow results
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-sm pos-add-customer-btn px-3"
                  type="button"
                  title="Add new customer"
                  onClick={openAddCustomerModal}
                >
                  Add
                </button>
              </div>
              {usersStatus === 'loading' && users.length === 0 && (
                <p className="text-xs text-muted mb-2">
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Loading customers…
                </p>
              )}
              {usersStatus !== 'loading' && isRetryingLookups && usersStatus === 'failed' && (
                <p className="text-xs text-muted mb-2" role="status" aria-live="polite">
                  we are trying to load please wait.{' '}
                  {lookupsRetryCountdown != null && lookupsRetryCountdown > 0
                    ? `Retrying in ${lookupsRetryCountdown}…`
                    : 'Retrying…'}
                </p>
              )}
              {usersError && !(isRetryingLookups && usersStatus === 'failed') && (
                <p className="text-xs text-warning mb-2" role="alert">
                  {usersError}.{' '}
                  {isOnline ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-warning p-0 align-baseline"
                      onClick={handleRetryLookups}
                    >
                      Retry now
                    </button>
                  ) : (
                    <>
                      Check API route in <code className="text-xs">usersAPI.js</code>.
                    </>
                  )}
                </p>
              )}
              <div className="pos-customer-selected mb-3">
                {(() => {
                  if (!selectedCustomerId)
                    return (
                      <span>
                        Default: <strong>Walk In</strong>
                      </span>
                    );
                  const u = users.find((row) => getUserOptionValue(row) === selectedCustomerId);
                  return u ? (
                    <span>
                      Selected: <strong>{formatUserOptionLabel(u)}</strong>
                    </span>
                  ) : (
                    <span>Customer selected</span>
                  );
                })()}
              </div>

              <div className="pos-cart-shell">
                <div className="pos-cart-toolbar">
                  <div className="pos-cart-toolbar__left">
                    <span className="pos-cart-toolbar__title">Cart</span>
                    <span className="pos-cart-toolbar__qty" title="Total quantity in cart">
                      <strong>{formatPosQtyLabel(cartTotalQty)}</strong>
                      <span>qty</span>
                    </span>
                    {cartLines.length > 0 ? (
                      <span className="pos-cart-toolbar__lines">
                        {cartLines.length} {cartLines.length === 1 ? 'line' : 'lines'}
                      </span>
                    ) : null}
                  </div>
                  <div className="pos-cart-toolbar__search">
                    <span className="pos-cart-toolbar__search-icon" aria-hidden="true">
                      <SearchInputIcon />
                    </span>
                    <input
                      type="search"
                      className="pos-cart-toolbar__search-input"
                      placeholder="Search cart…"
                      value={cartProductFilter}
                      onChange={(e) => setCartProductFilter(e.target.value)}
                      disabled={cartLines.length === 0}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Search products in cart"
                    />
                  </div>
                  <div className="pos-cart-toolbar__actions">
                    <div className="pos-segment" role="group" aria-label="Cart display order">
                      <button
                        type="button"
                        className={`pos-segment__btn${
                          cartDisplayOrder === POS_CART_ORDER_FIFO ? ' is-active' : ''
                        }`}
                        onClick={() => setCartOrderMode(POS_CART_ORDER_FIFO)}
                        title="First in, first out — oldest products at the top"
                        aria-pressed={cartDisplayOrder === POS_CART_ORDER_FIFO}
                      >
                        FIFO
                      </button>
                      <button
                        type="button"
                        className={`pos-segment__btn${
                          cartDisplayOrder === POS_CART_ORDER_LIFO ? ' is-active' : ''
                        }`}
                        onClick={() => setCartOrderMode(POS_CART_ORDER_LIFO)}
                        title="Last in, first out — newest products at the top"
                        aria-pressed={cartDisplayOrder === POS_CART_ORDER_LIFO}
                      >
                        LIFO
                      </button>
                      <button
                        type="button"
                        className={`pos-segment__btn${
                          isPosCartPriceOrder(cartDisplayOrder) ? ' is-active' : ''
                        }`}
                        onClick={handlePriceOrderClick}
                        title="Click to toggle sort by price: ascending, then descending, and so on."
                        aria-pressed={isPosCartPriceOrder(cartDisplayOrder)}
                        aria-label={
                          cartDisplayOrder === POS_CART_ORDER_PRICE_DESC
                            ? 'Sort by price descending. Click again for ascending.'
                            : cartDisplayOrder === POS_CART_ORDER_PRICE_ASC
                              ? 'Sort by price ascending. Click again for descending.'
                              : 'Sort by price. Click for ascending, click again for descending.'
                        }
                      >
                        Price
                        {cartDisplayOrder === POS_CART_ORDER_PRICE_ASC
                          ? ' ↑'
                          : cartDisplayOrder === POS_CART_ORDER_PRICE_DESC
                            ? ' ↓'
                            : ''}
                      </button>
                      <button
                        type="button"
                        className={`pos-segment__btn${
                          isPosCartAmountOrder(cartDisplayOrder) ? ' is-active' : ''
                        }`}
                        onClick={handleAmountOrderClick}
                        title="Click to toggle sort by amount: ascending, then descending, and so on."
                        aria-pressed={isPosCartAmountOrder(cartDisplayOrder)}
                        aria-label={
                          cartDisplayOrder === POS_CART_ORDER_AMOUNT_DESC
                            ? 'Sort by amount descending. Click again for ascending.'
                            : cartDisplayOrder === POS_CART_ORDER_AMOUNT_ASC
                              ? 'Sort by amount ascending. Click again for descending.'
                              : 'Sort by amount. Click for ascending, click again for descending.'
                        }
                      >
                        Amount
                        {cartDisplayOrder === POS_CART_ORDER_AMOUNT_ASC
                          ? ' ↑'
                          : cartDisplayOrder === POS_CART_ORDER_AMOUNT_DESC ||
                              cartDisplayOrder === POS_CART_ORDER_AMOUNT
                            ? ' ↓'
                            : ''}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="pos-toolbar-action"
                      onClick={handleOpenDrafts}
                      disabled={!isOnline}
                      title={
                        isOnline
                          ? 'View saved draft orders'
                          : 'Connect to the internet to load drafts'
                      }
                    >
                      <NavIcon icon={FaListUl} size={11} />
                      <span>Drafts</span>
                      {draftOrders.length > 0 ? (
                        <span className="pos-toolbar-action__count">{draftOrders.length}</span>
                      ) : null}
                    </button>
                  </div>
                </div>
                <div className="pos-cart-header">
                  <div className="text-center">Sr</div>
                  <div>Product</div>
                  <div className="text-center">Qty</div>
                  <div className="text-end">Price</div>
                  <div className="text-end">Total</div>
                  <div className="text-center" aria-hidden="true" />
                </div>
                <div className="pos-cart-body mb-3">
                  {cartLines.length === 0 ? (
                    <div className="text-center text-muted text-sm py-5">No products in cart</div>
                  ) : filteredCartLines.length === 0 ? (
                    <div className="text-center text-muted text-sm py-5">
                      No cart products match “{cartProductFilter.trim()}”
                    </div>
                  ) : (
                    filteredCartLines.map((line, index) => {
                      const qtyNum = parsePosQty(line.quantity);
                      const lineTotal = qtyNum * line.unitPrice;
                      const displayName = formatProductNameWithStock(
                        line.name,
                        line.availableStock
                      );
                      return (
                        <div key={line.productId} className="pos-cart-row">
                          <div className="pos-cart-serial text-center">{index + 1}</div>
                          <div className="pos-cart-product-name" title={displayName}>
                            {displayName}
                          </div>
                          <div className="d-flex justify-content-center">
                            <div className="pos-qty-group">
                              <button
                                type="button"
                                className="pos-qty-btn"
                                aria-label="Decrease quantity"
                                onClick={() => bumpCartQty(line.productId, -1)}
                              >
                                −
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="pos-qty-input"
                                value={line.quantity}
                                onChange={(e) => setCartQty(line.productId, e.target.value)}
                                onBlur={() => commitCartQty(line.productId)}
                                aria-label={`Quantity for ${line.name}`}
                              />
                              <button
                                type="button"
                                className="pos-qty-btn"
                                aria-label="Increase quantity"
                                onClick={() => bumpCartQty(line.productId, 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="form-control form-control-sm pos-price-input"
                              value={line.unitPrice}
                              onChange={(e) => setCartUnitPrice(line.productId, e.target.value)}
                              onBlur={commitCartUnitPrice}
                              aria-label={`Unit price for ${line.name}`}
                            />
                          </div>
                          <div className="pos-line-total">PKR {lineTotal.toFixed(2)}</div>
                          <div className="pos-cart-delete-cell">
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0 pos-cart-delete-btn"
                              aria-label={`Remove ${line.name}`}
                              onClick={() => removeCartLine(line.productId)}
                            >
                              <NavIcon icon={FaTrash} size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pos-section-label">Summary</div>
              <div className="pos-order-summary">
                <div className="pos-field-row mb-2 pos-field-row--datetime">
                  <label htmlFor="pos-order-date">Date / time</label>
                  <div className="pos-datetime">
                    <input
                      id="pos-order-date"
                      type="date"
                      className="form-control form-control-sm pos-datetime__date"
                      value={orderDateTime.slice(0, 10)}
                      onChange={(e) => {
                        const date = e.target.value || moment().format('YYYY-MM-DD');
                        const time = orderDateTime.slice(11, 16) || moment().format('HH:mm');
                        setOrderDateTime(`${date}T${time}`);
                      }}
                      aria-label="Order date"
                    />
                    <input
                      id="pos-order-time"
                      type="time"
                      className="form-control form-control-sm pos-datetime__time"
                      value={orderDateTime.slice(11, 16)}
                      onChange={(e) => {
                        const time = e.target.value || moment().format('HH:mm');
                        const date = orderDateTime.slice(0, 10) || moment().format('YYYY-MM-DD');
                        setOrderDateTime(`${date}T${time}`);
                      }}
                      aria-label="Order time"
                    />
                    <button
                      type="button"
                      className="pos-datetime__now"
                      onClick={() => setOrderDateTime(nowDatetimeLocalValue())}
                      title="Use current date and time"
                    >
                      Now
                    </button>
                  </div>
                </div>
                <div className="pos-field-row mb-2">
                  <label htmlFor="pos-shipping">Shipping</label>
                  <input
                    id="pos-shipping"
                    type="text"
                    className="form-control form-control-sm"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                  />
                </div>
                <div className="pos-field-row mb-2">
                  <label htmlFor="pos-extra-discount-percent">Discount in %</label>
                  <input
                    id="pos-extra-discount-percent"
                    type="text"
                    inputMode="decimal"
                    className="form-control form-control-sm"
                    value={extraDiscountPercent}
                    onChange={handleExtraDiscountPercentChange}
                    placeholder="0"
                    aria-label="Discount in percent"
                  />
                </div>
                <div className="pos-field-row mb-0">
                  <label htmlFor="pos-extra-discount">Extra discount</label>
                  <input
                    id="pos-extra-discount"
                    type="text"
                    inputMode="decimal"
                    className="form-control form-control-sm"
                    value={extraDiscount}
                    onChange={handleExtraDiscountChange}
                    placeholder="0"
                    aria-label="Extra discount amount"
                  />
                </div>
                <div className="pos-summary-row mt-3">
                  <span>Total tax</span>
                  <span className="pos-summary-value">PKR 0.00</span>
                </div>
                <div className="pos-summary-row">
                  <span>Total discount</span>
                  <span className="pos-summary-value">PKR 0.00</span>
                </div>
                <div className="pos-grand-total-row">
                  <div className="pos-grand-total-row__left">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary mb-0 pos-calc-btn"
                      onClick={() => openCalculatorModal()}
                      aria-label="Open calculator"
                      title="Calculator"
                    >
                      <FaCalculator aria-hidden="true" />
                      <span className="pos-calc-btn__label">Calculator</span>
                    </button>
                    <span className="label">Grand total</span>
                  </div>
                  <span className="pos-grand-total">PKR {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {orderSaving && (
                <p className="text-xs text-muted mt-2 mb-0">
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Saving order…
                </p>
              )}
            </div>
          </div>
        </div>

        <PosProducts
          productQuery={productQuery}
          setProductQuery={setProductQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          categoriesStatus={categoriesStatus}
          categoriesError={categoriesError}
          warehouseId={defaultWarehouseId}
          companyLogoUrl={companyBrand.logoUrl}
          onAddToCart={addToCart}
          onPaymentClick={handlePaymentClick}
          onSaveDraft={handleSaveDraft}
          cartLineCount={cartLines.length}
          draftSaving={draftSaving}
          paymentBusy={paymentPreparing || orderSaving}
          orderSaving={orderSaving}
          orderTotal={grandTotal}
          onPaymentComplete={handlePaymentComplete}
          onPaymentCompletePrint={handlePaymentCompletePrint}
          columnClassName="pos-layout-col pos-layout-col--products"
          productCols={posLayout.productCols}
        />
      </div>

      <div
        className="modal fade"
        id="posAddCustomerModal"
        tabIndex="-1"
        aria-labelledby="posAddCustomerModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="posAddCustomerModalLabel">
                Add customer
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleAddCustomerSubmit}>
              <div className="modal-body">
                <input type="hidden" name="role" value="customer" readOnly />
                <input
                  type="hidden"
                  name="password"
                  value={POS_DEFAULT_CUSTOMER_PASSWORD}
                  readOnly
                  autoComplete="new-password"
                />
                <div className="mb-3">
                  <label htmlFor="pos_customer_name" className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pos_customer_name"
                    name="name"
                    type="text"
                    className={`form-control ${addCustomerErrors.name ? 'is-invalid' : ''}`}
                    value={addCustomerForm.name}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="name"
                  />
                  {addCustomerErrors.name && (
                    <div className="invalid-feedback">{addCustomerErrors.name}</div>
                  )}
                </div>
                <div className="mb-0">
                  <label htmlFor="pos_customer_phone" className="form-label">
                    Phone <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pos_customer_phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    className={`form-control ${addCustomerErrors.phone ? 'is-invalid' : ''}`}
                    value={addCustomerForm.phone}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="tel"
                    placeholder="Digits only"
                  />
                  {addCustomerErrors.phone && (
                    <div className="invalid-feedback">{addCustomerErrors.phone}</div>
                  )}
                </div>
                <div className="mb-3">
                  <label htmlFor="pos_customer_email" className="form-label">
                    Email <span className="text-muted font-weight-normal">(optional)</span>
                  </label>
                  <input
                    id="pos_customer_email"
                    name="email"
                    type="email"
                    className={`form-control ${addCustomerErrors.email ? 'is-invalid' : ''}`}
                    value={addCustomerForm.email}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="email"
                    placeholder="Leave empty to use phone@gmail.com"
                  />
                  <small className="text-muted text-xs">
                    If empty, the saved email is your phone digits + @gmail.com (e.g.
                    03001234567@gmail.com).
                  </small>
                  {addCustomerErrors.email && (
                    <div className="invalid-feedback d-block">{addCustomerErrors.email}</div>
                  )}
                </div>
                <PakistanCityStateFields
                  city={addCustomerForm.city}
                  state={addCustomerForm.state}
                  area={addCustomerForm.area}
                  includeArea
                  idPrefix="pos_customer"
                  disabled={createCustomerSubmitting}
                  className="mb-0"
                  showToggle
                  showFields={showAddCustomerLocation}
                  onShowFieldsChange={setShowAddCustomerLocation}
                  onChange={({ city, state, area }) =>
                    setAddCustomerForm((prev) => ({
                      ...prev,
                      city,
                      state,
                      ...(area !== undefined ? { area } : {}),
                    }))
                  }
                />

                {createCustomerError && (
                  <div className="alert alert-danger text-sm mt-3 mb-0 py-2" role="alert">
                    {createCustomerError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn pos-add-customer-btn"
                  disabled={createCustomerSubmitting}
                >
                  {createCustomerSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Saving…
                    </>
                  ) : (
                    'Create customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div
        className="modal fade"
        id={POS_DRAFTS_MODAL_ID}
        tabIndex="-1"
        aria-labelledby="posDraftsModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
          <div className="modal-content pos-drafts-modal">
            <div className="modal-header pos-drafts-modal__header">
              <div>
                <h5 className="modal-title mb-0" id="posDraftsModalLabel">
                  Draft orders
                </h5>
                <p className="pos-drafts-modal__subtitle mb-0">
                  {isOnline
                    ? draftOrders.length === 0
                      ? 'Saved carts appear here for later checkout'
                      : `${draftOrders.length} saved draft${draftOrders.length === 1 ? '' : 's'}`
                    : 'Drafts require an internet connection'}
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body pos-drafts-modal__body">
              {!isOnline ? (
                <div className="pos-drafts-empty">
                  <p className="mb-0">Connect to the internet to manage drafts.</p>
                </div>
              ) : draftOrders.length === 0 ? (
                <div className="pos-drafts-empty">
                  <NavIcon icon={FaFloppyDisk} size={28} className="pos-drafts-empty__icon" />
                  <p className="pos-drafts-empty__title mb-1">No drafts yet</p>
                  <p className="mb-0">
                    Add items to the cart and tap <strong>Draft</strong> to save an order for later.
                  </p>
                </div>
              ) : (
                <ul className="pos-drafts-list list-unstyled mb-0">
                  {draftOrders.map((draft) => {
                    const itemCount = countDraftPayloadItems(draft.payload);
                    const total = draftPayloadGrandTotal(draft.payload);
                    const totalLabel = formatDraftMoney(total);
                    const deleting = draftDeletingId === String(draft._id);
                    const isActive = activeDraftId === String(draft._id);
                    const savedByName = draft.savedByName || resolveDraftSavedByName(draft);
                    const clientName = resolveDraftClientName(draft, users);
                    return (
                      <li
                        key={draft._id}
                        className={`pos-drafts-item${isActive ? ' pos-drafts-item--active' : ''}`}
                      >
                        <div className="pos-drafts-item__main">
                          {clientName ? (
                            <div
                              className="pos-drafts-item__client"
                              title={`Client: ${clientName}`}
                            >
                              {clientName}
                            </div>
                          ) : null}
                          <div className="pos-drafts-item__title-row">
                            <span className="pos-drafts-item__title" title={draft.label}>
                              {draftDisplayTitle(draft.label)}
                            </span>
                            {isActive ? (
                              <span className="pos-drafts-item__badge">Active</span>
                            ) : null}
                          </div>
                          <div className="pos-drafts-item__meta">
                            <span>{formatDraftUpdatedAt(draft.updated_at)}</span>
                            <span className="pos-drafts-item__dot" aria-hidden="true">
                              ·
                            </span>
                            <span>
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>
                        <div className="pos-drafts-item__side">
                          {totalLabel ? (
                            <div className="pos-drafts-item__amount">{totalLabel}</div>
                          ) : null}
                          {savedByName ? (
                            <div
                              className="pos-drafts-item__user"
                              title={`Saved by ${savedByName}`}
                            >
                              {savedByName}
                            </div>
                          ) : null}
                          <div className="pos-drafts-item__actions">
                            <button
                              type="button"
                              className="btn btn-sm pos-drafts-item__load"
                              onClick={() => handleLoadDraft(draft)}
                              disabled={deleting}
                            >
                              <NavIcon icon={FaFolderOpen} size={12} className="me-1" />
                              Load
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-danger pos-drafts-item__delete"
                              onClick={() => handleDeleteDraft(draft)}
                              disabled={deleting}
                              aria-label={`Delete ${draft.label}`}
                              title="Delete draft"
                            >
                              {deleting ? (
                                <span
                                  className="spinner-border spinner-border-sm"
                                  role="status"
                                  aria-hidden="true"
                                />
                              ) : (
                                <NavIcon icon={FaTrash} size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="modal-footer pos-drafts-modal__footer">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Order saved successfully.</div>
        </div>
      </div>

      <CalculatorModal initialValue={grandTotal} title="Calculator" />
    </div>
  );
};

export default Pos;
