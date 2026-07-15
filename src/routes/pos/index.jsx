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
import { fetchProductByIdRequest, fetchProductActiveRequest } from '../../features/products/productsAPI.js';
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
import { CalculatorModal, openCalculatorModal } from '../../components/Calculator/index.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import OfflineStatusBadge from '../../components/OfflineStatusBadge.jsx';
import OfflineSyncPanel, { openOfflineSyncPanel } from '../../components/OfflineSyncPanel.jsx';
import { processSyncQueue } from '../../offline/syncOrders.js';
import { refreshSyncStatusCounts } from '../../offline/syncStatus.js';
import { isMasterSyncStale, runMasterSync } from '../../offline/masterSync.js';
import { OFFLINE_CATALOG_EMPTY_MESSAGE } from '../../offline/catalogRead.js';
import { saveOfflineOrder, buildOfflineSaveResult } from '../../offline/saveOfflineOrder.js';
import { getAllCategories, countCategories } from '../../offline/repositories/categoriesRepo.js';
import { getAllCustomers, countCustomers } from '../../offline/repositories/customersRepo.js';
import { toast, boldQuotedNamesInMessage } from '../../utils/toast.js';
import { formatPosOrderErrorMessage } from '../../utils/posOrderErrors.js';
import { shopName } from '../../features/orders/invoiceViewMapper.js';
import './pos-module.css';

const ADD_CUSTOMER_INITIAL = { name: '', email: '', phone: '03' };
const POS_DRAFTS_MODAL_ID = 'posDraftsModal';

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
  grandTotal,
  invoiceNo,
  publicUrl,
  companyName,
}) {
  const lines = (cartLines || []).map((line) => {
    const qty = parsePosQty(line.quantity);
    const rate = Number(line.unitPrice) || 0;
    return {
      description: line.name || 'Product',
      qtyLabel: formatPosQtyLabel(qty),
      rate,
      amount: qty * rate,
    };
  });
  const paid = Number(payment?.paid ?? 0);
  const total = Number(grandTotal) || 0;
  const balanceDue = Math.max(0, total - paid);
  return {
    shopName: companyName || shopName,
    invoiceNo: invoiceNo || '—',
    invoiceDate: moment().format('D MMM YYYY, h:mm a'),
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
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
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

function pickProductFromApiBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body.product && typeof body.product === 'object') return body.product;
  if (body._id != null || body.id != null) return body;
  return null;
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
    return { lines: cartLines, missingIds: [], variableParentIds: [], inactiveIds: [] };
  }

  const stockById = {};
  const missingIds = [];
  const variableParentIds = [];
  const inactiveIds = [];

  await Promise.all(
    uniqueIds.map(async (productId) => {
      try {
        const result = await fetchProductByIdRequest(productId);
        const product = pickProductFromApiBody(result);
        if (!product) {
          // Don't hard-block — order_save is authoritative; list may still sell this SKU
          stockById[productId] = null;
          return;
        }
        if (isVariableParentProduct(product)) {
          variableParentIds.push(productId);
        }
        if (isProductInactive(product)) {
          inactiveIds.push(productId);
        }
        stockById[productId] = getProductAvailableStock(product, { warehouseId });
      } catch (err) {
        console.warn('[POS] Could not refresh stock before payment', productId, err);
        // Soft-fail stock refresh; keep previous availableStock from catalog
        stockById[productId] = null;
      }
    })
  );

  return {
    lines: cartLines.map((line) => ({
      ...line,
      availableStock: stockById[line.productId] ?? line.availableStock,
    })),
    missingIds,
    variableParentIds,
    inactiveIds,
  };
}

/** If product/get fails or id is stale, rebind to a live get-all-active-pos match by name. */
async function rebindCartLinesToLiveCatalog(cartLines) {
  if (!Array.isArray(cartLines) || cartLines.length === 0) return cartLines;

  const nextLines = [];
  for (const line of cartLines) {
    const currentId = String(line?.productId || '').trim();
    const rawName = String(line?.name || '')
      .replace(/\s*\[\d+(?:\.\d+)?\]\s*$/, '')
      .trim();

    let resolvedId = currentId;
    let resolvedName = line?.name;
    let availableStock = line?.availableStock;

    try {
      const result = await fetchProductByIdRequest(currentId);
      const product = pickProductFromApiBody(result);
      if (product && !isVariableParentProduct(product) && !isProductInactive(product)) {
        resolvedId = sellablePosProductId(product) || currentId;
        nextLines.push({
          ...line,
          productId: resolvedId,
          name: product.product_name || product.name || resolvedName,
          availableStock: getProductAvailableStock(product) ?? availableStock,
        });
        continue;
      }
      if (product && isProductInactive(product)) {
        nextLines.push({ ...line, __inactive: true });
        continue;
      }
    } catch {
      // fall through to catalog search
    }

    if (rawName) {
      try {
        const listed = await fetchProductActiveRequest({
          search: rawName,
          searchFields: 'product_name',
          page: 1,
          limit: 50,
        });
        const rows = Array.isArray(listed?.data) ? listed.data : [];
        const exact =
          rows.find((p) => {
            const n = String(p?.product_name || p?.name || '').trim();
            return n.toLowerCase() === rawName.toLowerCase();
          }) ||
          rows.find((p) => sellablePosProductId(p) === currentId) ||
          null;

        if (exact && !isVariableParentProduct(exact) && !isProductInactive(exact)) {
          resolvedId = sellablePosProductId(exact);
          resolvedName = exact.product_name || exact.name || resolvedName;
          availableStock = getProductAvailableStock(exact) ?? availableStock;
        }
      } catch (err) {
        console.warn('[POS] Could not rebind cart line from live catalog', currentId, err);
      }
    }

    nextLines.push({
      ...line,
      productId: resolvedId,
      name: resolvedName,
      availableStock,
    });
  }

  return nextLines;
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

  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerPickerRef = useRef(null);

  const [productQuery, setProductQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const [categoriesError, setCategoriesError] = useState(null);
  const [shipping, setShipping] = useState('');
  const [extraDiscount, setExtraDiscount] = useState('');
  const [extraDiscountPercent, setExtraDiscountPercent] = useState('');
  const discountEditSourceRef = useRef(null);
  const [cartLines, setCartLines] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftDeletingId, setDraftDeletingId] = useState(null);

  const [addCustomerForm, setAddCustomerForm] = useState(ADD_CUSTOMER_INITIAL);
  const [addCustomerErrors, setAddCustomerErrors] = useState({});
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [masterSyncRunning, setMasterSyncRunning] = useState(false);
  const [masterSyncProgress, setMasterSyncProgress] = useState(null);

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
      setUsersStatus('loading');
      setUsersError(null);

      const loadUsersFromCache = async () => {
        const cached = await getAllCustomers();
        const arr = cached.filter((u) => getUserOptionValue(u));
        if ((await countCustomers()) === 0) {
          setUsers([]);
          setUsersError(OFFLINE_CATALOG_EMPTY_MESSAGE);
          setUsersStatus('failed');
          return false;
        }
        applyCustomerList(arr, selectAfter);
        return true;
      };

      if (!isOnline) {
        await loadUsersFromCache();
        return;
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
      } catch (err) {
        console.warn('[POS] Failed to load users from API, trying offline cache', err);
        const usedCache = await loadUsersFromCache();
        if (!usedCache) {
          setUsers([]);
          setUsersError(err?.message || 'Could not load users');
          setUsersStatus('failed');
        }
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

      setCartLines((prev) => {
        const i = prev.findIndex((l) => l.productId === productId);
        const currentQty = i >= 0 ? parsePosQty(prev[i].quantity) : 0;
        const nextQty = currentQty + 1;
        const stockInCart = i >= 0 ? (prev[i].availableStock ?? availableStock) : availableStock;

        const blockMsg = posStockBlocksQty({
          allowWhenInsufficient: allowAddWhenStockInsufficient,
          availableStock: stockInCart,
          requestedQty: nextQty,
          productName: name,
        });
        if (blockMsg) {
          queueMicrotask(() => showStockErrorToast(blockMsg, { delay: 5000 }));
          return prev;
        }

        if (i >= 0) {
          const next = [...prev];
          next[i] = {
            ...next[i],
            quantity: formatPosQtyLabel(nextQty),
            availableStock: stockInCart,
          };
          return next;
        }
        return [
          ...prev,
          {
            productId,
            name,
            unitPrice,
            quantity: '1',
            availableStock,
            category_id:
              String(
                product.category_id ??
                  product.categoryId ??
                  product.category?._id ??
                  product.category?.id ??
                  ''
              ).trim() || undefined,
          },
        ];
      });
    },
    [defaultWarehouseId, allowAddWhenStockInsufficient]
  );

  const bumpCartQty = useCallback(
    (productId, delta) => {
      setCartLines((prev) =>
        prev.flatMap((l) => {
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
        })
      );
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
      setCartLines((prev) =>
        prev.flatMap((l) => {
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
        })
      );
    },
    [allowAddWhenStockInsufficient]
  );

  const setCartUnitPrice = useCallback((productId, raw) => {
    const n = parseFloat(String(raw).replace(/,/g, ''));
    const unitPrice = Number.isFinite(n) && n >= 0 ? n : 0;
    setCartLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  }, []);

  const cartSubtotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + parsePosQty(l.quantity) * l.unitPrice, 0),
    [cartLines]
  );

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
      const normalized = normalizeCartLinesForCheckout(cartLines);
      if (normalized.error) {
        alert(normalized.error);
        return null;
      }

      let linesForSave = normalized.lines;
      if (isOnline) {
        try {
          linesForSave = await rebindCartLinesToLiveCatalog(linesForSave);
          const inactiveFromRebind = linesForSave
            .filter((l) => l.__inactive)
            .map((l) => String(l.productId || ''));
          linesForSave = linesForSave
            .filter((l) => !l.__inactive)
            .map(({ __inactive, ...rest }) => rest);

          if (inactiveFromRebind.length) {
            toastCartProductValidationErrors({
              missingIds: [],
              variableParentIds: [],
              inactiveIds: inactiveFromRebind,
              cartLines: normalized.lines,
            });
            return null;
          }

          const refreshed = await refreshCartLineStock(linesForSave, defaultWarehouseId);
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
        order_status: 'active',
        amount_received: payment?.paid ?? 0,
        change_given: payment?.change ?? 0,
        remaining_amount: payment?.balanceDue ?? 0,
        posPayMethod: payment?.paymentMethodId || undefined,
        payment_method_id: payment?.paymentMethodId || undefined,
        customer_id: selectedCustomerId || undefined,
      };

      const cartSnapshot = linesForSave.map((line) => ({ ...line }));
      const customerInfo = { name, email, phone };

      if (!isOnline) {
        const offlineResult = await saveOfflineOrder({
          payload: orderPayload,
          cartSnapshot,
          warehouseId: defaultWarehouseId,
        });
        return buildOfflineSaveResult(offlineResult, {
          ...customerInfo,
          cartSnapshot,
        });
      }

      try {
        const result = await createPosOrderRequest(orderPayload);
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
          const offlineResult = await saveOfflineOrder({
            payload: orderPayload,
            cartSnapshot,
            warehouseId: defaultWarehouseId,
          });
          return buildOfflineSaveResult(offlineResult, {
            ...customerInfo,
            cartSnapshot,
          });
        }
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
      defaultWarehouseId,
      isOnline,
      allowAddWhenStockInsufficient,
    ]
  );

  const handlePaymentClick = useCallback(async () => {
    const normalized = normalizeCartLinesForCheckout(cartLines);
    if (normalized.error) {
      toast.warning(normalized.error);
      return;
    }

    let linesForPayment = normalized.lines;
    setCartLines(normalized.lines);

    if (isOnline) {
      try {
        linesForPayment = await rebindCartLinesToLiveCatalog(linesForPayment);
        const inactiveFromRebind = linesForPayment
          .filter((l) => l.__inactive)
          .map((l) => String(l.productId || ''));
        linesForPayment = linesForPayment
          .filter((l) => !l.__inactive)
          .map(({ __inactive, ...rest }) => rest);

        if (inactiveFromRebind.length) {
          toastCartProductValidationErrors({
            missingIds: [],
            variableParentIds: [],
            inactiveIds: inactiveFromRebind,
            cartLines: normalized.lines,
          });
          return;
        }

        const refreshed = await refreshCartLineStock(linesForPayment, defaultWarehouseId);
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
          showStockErrorToast(formatCartStockIssueToast(stockIssues), { delay: 8000 });
          return;
        }
      }
    }

    openPosPaymentModal();
  }, [cartLines, defaultWarehouseId, isOnline, allowAddWhenStockInsufficient]);

  const clearCartAfterSale = useCallback(() => {
    setCartLines([]);
    setShipping('');
    setExtraDiscount('');
    setExtraDiscountPercent('');
    discountEditSourceRef.current = null;
    setActiveDraftId(null);
  }, []);

  const draftOrders = useMemo(
    () => normalizeCompanyDraftOrders(authCompany),
    [authCompany]
  );

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
      extraDiscount,
      extraDiscountPercent,
      grandTotal,
      savedAt: new Date().toISOString(),
    }),
    [cartLines, selectedCustomerId, shipping, extraDiscount, extraDiscountPercent, grandTotal]
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

    setDraftSaving(true);
    try {
      let result;
      if (activeDraftId) {
        result = await updateCompanyDraftOrder(companyId, activeDraftId, { payload, label });
      } else {
        result = await addCompanyDraftOrder(companyId, { payload, label });
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
      setOrderSaving(true);
      try {
        const saved = await savePosOrder(payment);
        if (!saved) return;
        if (saved.offline) {
          toast.success('Sale saved offline — will sync when online', { delay: 6000 });
        } else {
          showToast('successToast', 'Order saved successfully.');
        }
        clearCartAfterSale();
      } catch (e) {
        console.error('[POS] Failed to save order', e);
        showStockErrorToast(
          formatPosOrderErrorMessage(e?.message, {
            cartLines,
            productId: e?.productId,
            productName: e?.productName,
          }),
          { delay: 8000 }
        );
      } finally {
        setOrderSaving(false);
      }
    },
    [savePosOrder, clearCartAfterSale, cartLines]
  );

  const handlePaymentCompletePrint = useCallback(
    async (payment) => {
      setOrderSaving(true);
      try {
        const saved = await savePosOrder(payment);
        if (!saved) return;

        const invoiceNo = saved.offline
          ? saved.localInvoiceNo || saved.result?.local_invoice_no
          : pickOrderInvoiceNoFromSaveResponse(saved.result) || moment().format('YYYYMMDDHHmmss');
        const savedOrder = saved.offline ? null : pickOrderFromSaveResult(saved.result);
        const publicUrl = saved.offline ? '' : buildPublicInvoiceUrl(pickPublicInvoiceToken(savedOrder));

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
          grandTotal,
          invoiceNo,
          publicUrl,
          companyName: brand.name,
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
            toast.error('Allow pop-ups to print the thermal receipt, or configure the print bridge in Printer Settings.', { delay: 6000 });
          }
        }

        if (saved.offline) {
          toast.success('Sale saved offline — will sync when online', { delay: 6000 });
        } else {
          showToast('successToast', bridgePrinted ? 'Order saved and sent to network printer.' : 'Order saved and sent to printer.');
        }
        clearCartAfterSale();
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
      grandTotal,
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
      });
      const created = pickCreatedUserFromResponse(json);
      const newId = getUserOptionValue(created);
      await loadUsers({
        preferId: newId || undefined,
        fallbackEmail: newId ? undefined : resolvedEmail,
      });
      setAddCustomerForm(ADD_CUSTOMER_INITIAL);
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
            title={isOnline ? 'Download latest catalog for offline use' : 'Go online to refresh catalog'}
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
      <div className="row g-4">
        {/* Left: checkout */}
        <div className="col-lg-6 col-xl-5">
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
                      disabled={usersStatus === 'loading'}
                      autoComplete="off"
                      aria-label="Search customers"
                      aria-expanded={customerMenuOpen}
                      aria-controls="pos-customer-picker-list"
                    />
                  </div>
                  {customerMenuOpen && usersStatus !== 'loading' && (
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
              {usersStatus === 'loading' && (
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

              <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                <div className="pos-section-label mb-0">Cart</div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary pos-drafts-btn"
                  onClick={handleOpenDrafts}
                  disabled={!isOnline}
                  title={
                    isOnline
                      ? 'View saved draft orders'
                      : 'Connect to the internet to load drafts'
                  }
                >
                  <NavIcon icon={FaListUl} size={12} className="me-1" />
                  Drafts
                  {draftOrders.length > 0 ? ` (${draftOrders.length})` : ''}
                </button>
              </div>
              <div className="pos-cart-header">
                <div className="text-center">Sr</div>
                <div>Product</div>
                <div className="text-center">Qty</div>
                <div className="text-end">Price</div>
                <div className="text-end">Total</div>
                <div aria-hidden="true" />
              </div>
              <div className="pos-cart-body mb-3">
                {cartLines.length === 0 ? (
                  <div className="text-center text-muted text-sm py-5">No products in cart</div>
                ) : (
                  cartLines.map((line, index) => {
                    const qtyNum = parsePosQty(line.quantity);
                    const lineTotal = qtyNum * line.unitPrice;
                    const displayName = formatProductNameWithStock(line.name, line.availableStock);
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

              <div className="pos-section-label">Summary</div>
              <div className="pos-order-summary">
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
          onAddToCart={addToCart}
          onPaymentClick={handlePaymentClick}
          onSaveDraft={handleSaveDraft}
          cartLineCount={cartLines.length}
          draftSaving={draftSaving}
          orderTotal={grandTotal}
          onPaymentComplete={handlePaymentComplete}
          onPaymentCompletePrint={handlePaymentCompletePrint}
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
                    return (
                      <li
                        key={draft._id}
                        className={`pos-drafts-item${isActive ? ' pos-drafts-item--active' : ''}`}
                      >
                        <div className="pos-drafts-item__main">
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
              <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">
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
