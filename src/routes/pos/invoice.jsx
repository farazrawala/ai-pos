import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { openThermalReceiptPrint } from '../../components/ThermalReceiptPrint/index.js';
import { openNormalInvoicePrint } from '../../components/NormalInvoicePrint/index.js';
import {
  fetchOrderForInvoiceRequest,
  fetchDeletedOrderForInvoiceRequest,
  getOrderLineItems,
  updatePosOrderRequest,
} from '../../features/orders/ordersAPI.js';
import {
  mapOrderToInvoiceView,
  resolvePaymentMethodLabel,
  shopName,
  formatInvoiceMoney,
} from '../../features/orders/invoiceViewMapper.js';
import { fetchProductActiveRequest } from '../../features/products/productsAPI.js';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
  createCustomerUserRequest,
  pickCreatedUserFromResponse,
  POS_DEFAULT_CUSTOMER_PASSWORD,
  resolvePosCustomerEmail,
  digitsOnlyFromPhone,
} from '../../features/users/usersAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import {
  extractPrinterSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  mergeCompanyRecordForSettings,
  mergePrinterSettings,
  pickCompanyLogoUrl,
  resolveBillCurrentUserName,
} from '../../features/company/companyAPI.js';
import { selectAuthUser, selectCompany, selectCompanyId } from '../../features/user/userSlice.js';
import InvoiceQrCode from '../../components/invoice/InvoiceQrCode.jsx';
import { toast } from '../../utils/toast.js';
import { formatPosOrderErrorMessage } from '../../utils/posOrderErrors.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { FaTrash, FaWhatsapp } from 'react-icons/fa6';
import { buildWhatsAppUrl } from '../../features/bigCommerce/marketplaceUtils.js';
import { poStatusBadgeClass } from '../purchase_order/poFormConstants.js';
import './pos-invoice-module.css';

/** Demo payload — replace with API data later */
const DEMO_INVOICE = {
  shopName,
  invoiceNo: '42693',
  transactionNumber: 'TXN-000001',
  reference: '',
  grossAmount: 922.5,
  billTo: {
    name: 'Walk-in Client',
    phone: '+92 300 0000000',
    email: 'example@example.com',
  },
  invoiceDate: '11-04-2026',
  dueDate: '11-04-2026',
  terms: 'Payment On Receipt',
  lines: [
    {
      description: 'SUGAR-01',
      rate: 145,
      qtyLabel: '5.00kg',
      tax: { amount: 0, pct: 0 },
      discount: { amount: 0, pct: 0 },
      amount: 725,
    },
    {
      description: 'MASH-33',
      rate: 395,
      qtyLabel: '0.50kg',
      tax: { amount: 0, pct: 0 },
      discount: { amount: 0, pct: 0 },
      amount: 197.5,
    },
  ],
  summary: {
    subTotal: 0,
    tax: 0,
    discount: 0,
    discountPercentage: 0,
    shipping: 0,
    total: 0,
    paymentMade: 0,
    balanceDue: 0,
  },
  paymentStatus: 'Paid',
  paymentMethod: 'Cash',
  note: '',
  authorizedPerson: {
    name: 'Aslam Qadri',
    title: 'Sales Manager',
  },
  creditRows: [
    {
      date: '2026-04-11',
      method: 'Cash',
      debit: 0,
      credit: 922.5,
      note: '#42693-Cash',
    },
  ],
  publicUrl: 'https://example.com/invoice/view/abc123token',
  termsBody: [
    'Payment On Receipt',
    'Early payment discounts may apply as per store policy.',
    'Late payments may incur fees after the due date.',
  ],
};

const fmt = formatInvoiceMoney;

const ADD_CUSTOMER_INITIAL = { name: '', email: '', phone: '03' };
const INVOICE_ADD_CUSTOMER_MODAL_ID = 'posInvoiceAddCustomerModal';

function parseInvoiceMoneyInput(raw) {
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function formatInvoicePercentInput(n) {
  if (!Number.isFinite(n) || n < 0) return '';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function amountFromDiscountPercent(subtotal, percentRaw) {
  const pct = parseInvoiceMoneyInput(percentRaw);
  if (pct == null || pct <= 0) return '';
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return '';
  const amt = Math.round(((sub * pct) / 100) * 100) / 100;
  return Number.isInteger(amt) ? String(amt) : amt.toFixed(2);
}

function percentFromDiscountAmount(subtotal, amountRaw) {
  const amt = parseInvoiceMoneyInput(amountRaw);
  if (amt == null || amt <= 0) return '';
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return '';
  return formatInvoicePercentInput((amt / sub) * 100);
}

function isPartialDiscountInput(value) {
  const s = String(value ?? '').trim();
  return !s || s === '.' || s.endsWith('.');
}

function pickOrderDiscountPercent(order) {
  if (!order || typeof order !== 'object') return 0;
  const raw = order.discount_percentage ?? order.discountPercentage ?? 0;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const lineProductIdFromOrderLine = (line) => {
  if (!line || typeof line !== 'object') return '';
  const p = line.product_id;
  if (p && typeof p === 'object') {
    return String(p._id ?? p.id ?? '').trim();
  }
  if (p != null && String(p).trim() !== '') return String(p).trim();
  return String(line.productId ?? line.product_id_str ?? '').trim();
};

const describeOrderLineItem = (line) => {
  if (!line || typeof line !== 'object') return 'Item';
  const product = line.product_id && typeof line.product_id === 'object' ? line.product_id : null;
  return product?.product_name || product?.product_code || line.name || 'Item';
};

const productPickerLabel = (p) => {
  if (!p || typeof p !== 'object') return 'Product';
  return p.product_name || p.name || p.product_code || 'Product';
};

const productPickerUnitPrice = (p) => {
  if (!p || typeof p !== 'object') return 0;
  const v = p.product_price ?? p.price;
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Matches backend `order_status` enum (default on server: placed). */
const ORDER_STATUS_OPTIONS = [
  'active',
  'placed',
  'confirmed',
  'shipped',
  'delivered',
  'drafted',
  'pending',
  'completed',
  'cancelled',
  'refunded',
  'failed',
];

const DEFAULT_ORDER_STATUS = 'placed';

const normalizeOrderStatus = (value) => {
  if (value == null || value === '') return DEFAULT_ORDER_STATUS;
  const s = String(value).trim().toLowerCase();
  return ORDER_STATUS_OPTIONS.includes(s) ? s : DEFAULT_ORDER_STATUS;
};

const orderSnapshotMatchesId = (row, invoiceId) => {
  if (!row || typeof row !== 'object' || !invoiceId) return false;
  const id = String(invoiceId).trim();
  const candidates = [
    row._id,
    row.id,
    row.order_id,
    row.orderId,
    row.order_no,
    row.orderNo,
  ]
    .map((v) => (v != null ? String(v).trim() : ''))
    .filter(Boolean);
  return candidates.includes(id);
};

const PosInvoice = () => {
  const { invoiceId: invoiceIdParam } = useParams();
  const location = useLocation();
  const invoiceId = invoiceIdParam ? decodeURIComponent(invoiceIdParam) : '';
  const searchParams = new URLSearchParams(location.search || '');
  const locationState =
    location.state && typeof location.state === 'object' ? location.state : null;
  const isDeletedOrderView =
    searchParams.get('deleted') === '1' ||
    searchParams.get('deleted') === 'true' ||
    Boolean(locationState?.deleted);
  const isReadOnlyView =
    searchParams.get('readonly') === '1' ||
    searchParams.get('readonly') === 'true' ||
    searchParams.get('view') === '1' ||
    Boolean(locationState?.readonly) ||
    isDeletedOrderView;
  const orderSnapshot =
    locationState?.orderRow && typeof locationState.orderRow === 'object'
      ? locationState.orderRow
      : null;
  const authCompany = useSelector(selectCompany);
  const companyId = useSelector(selectCompanyId);
  const authUser = useSelector(selectAuthUser);
  const authUserName = useSelector((state) => state.user?.name || '');
  const [invoiceCompany, setInvoiceCompany] = useState(null);

  useEffect(() => {
    if (!companyId) {
      setInvoiceCompany(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const body = await fetchCompanyById(companyId);
        if (cancelled) return;
        const company = getCompanyFromApiBody(body);
        setInvoiceCompany(
          company && typeof company === 'object'
            ? mergeCompanyRecordForSettings(company, authCompany)
            : null
        );
      } catch {
        if (!cancelled) setInvoiceCompany(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, authCompany]);

  const activeCompany = useMemo(
    () => mergeCompanyRecordForSettings(invoiceCompany, authCompany),
    [invoiceCompany, authCompany]
  );

  const printerSettings = useMemo(() => {
    const parsed = extractPrinterSettingsFromCompanyBody({ data: activeCompany });
    return mergePrinterSettings(parsed);
  }, [activeCompany]);

  const companyBrand = useMemo(() => {
    const name = activeCompany?.company_name || activeCompany?.name || shopName;
    return {
      name: String(name || shopName).trim() || shopName,
      phone: String(activeCompany?.company_phone || activeCompany?.phone || '').trim(),
      email: String(activeCompany?.company_email || activeCompany?.email || '').trim(),
      address: String(activeCompany?.company_address || activeCompany?.address || '').trim(),
      logoUrl: pickCompanyLogoUrl(activeCompany),
    };
  }, [activeCompany]);

  const [view, setView] = useState(() => (invoiceId ? null : { ...DEMO_INVOICE, shopName }));
  const [fetchStatus, setFetchStatus] = useState(() => (invoiceId ? 'loading' : 'succeeded'));
  const [fetchError, setFetchError] = useState(null);
  const [sourceOrder, setSourceOrder] = useState(null);
  const billCurrentUserName = useMemo(
    () => resolveBillCurrentUserName(authUser, sourceOrder, authUserName),
    [authUser, sourceOrder, authUserName]
  );
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceSaveMessage, setInvoiceSaveMessage] = useState({ type: null, text: '' });
  /** Editable invoice lines: qty, rate, optional add/remove; synced from order on load. */
  const [invoiceDraftLines, setInvoiceDraftLines] = useState([]);
  const [addProductQuery, setAddProductQuery] = useState('');
  const [addProductResults, setAddProductResults] = useState([]);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductError, setAddProductError] = useState('');
  const [invoiceOrderStatus, setInvoiceOrderStatus] = useState(DEFAULT_ORDER_STATUS);
  const [invoiceDiscountInput, setInvoiceDiscountInput] = useState('');
  const [invoiceDiscountPercentInput, setInvoiceDiscountPercentInput] = useState('');
  const [invoiceShippingInput, setInvoiceShippingInput] = useState('');
  const discountEditSourceRef = useRef(null);
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [invoiceCity, setInvoiceCity] = useState('');
  const [invoiceState, setInvoiceState] = useState('');
  const [invoiceZip, setInvoiceZip] = useState('');
  const [invoiceCountry, setInvoiceCountry] = useState('');
  const [invoicePosPayMethod, setInvoicePosPayMethod] = useState('');
  const [addCustomerForm, setAddCustomerForm] = useState(ADD_CUSTOMER_INITIAL);
  const [addCustomerErrors, setAddCustomerErrors] = useState({});
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState('');
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsStatus, setPaymentMethodsStatus] = useState('idle');
  const [paymentMethodsError, setPaymentMethodsError] = useState('');

  useLayoutEffect(() => {
    if (!sourceOrder) {
      setInvoiceDraftLines([]);
      setInvoiceOrderStatus(DEFAULT_ORDER_STATUS);
      return;
    }
    const rawStatus = sourceOrder.order_status ?? sourceOrder.orderStatus ?? sourceOrder.status;
    setInvoiceOrderStatus(normalizeOrderStatus(rawStatus));
    const items = getOrderLineItems(sourceOrder);
    setInvoiceDraftLines(
      items.map((line, idx) => {
        const product =
          line.product_id && typeof line.product_id === 'object' ? line.product_id : null;
        const qty = parseFloat(String(line.qty ?? line.quantity ?? '0').replace(/,/g, ''));
        const rate = parseFloat(String(line.price ?? line.unit_price ?? '0').replace(/,/g, ''));
        const pid = lineProductIdFromOrderLine(line);
        return {
          key: String(line._id ?? line.id ?? `row-${idx}-${pid || 'x'}`),
          productId: pid,
          label: describeOrderLineItem(line),
          taxPct: Number(product?.tax_rate) || 0,
          qty: Number.isFinite(qty) ? String(qty) : '0',
          rate: Number.isFinite(rate) ? String(rate) : '0',
        };
      })
    );
  }, [sourceOrder]);

  useEffect(() => {
    if (!sourceOrder || typeof sourceOrder !== 'object') return;
    const disc = sourceOrder.discount ?? sourceOrder.discount_amount ?? 0;
    const d = parseFloat(String(disc).replace(/,/g, ''));
    setInvoiceDiscountInput(String(Number.isFinite(d) ? d : 0));
    const discPct = pickOrderDiscountPercent(sourceOrder);
    setInvoiceDiscountPercentInput(discPct > 0 ? formatInvoicePercentInput(discPct) : '0');
    const shipRaw = sourceOrder.shipping ?? sourceOrder.shipment ?? 0;
    const s = parseFloat(String(shipRaw).replace(/,/g, ''));
    setInvoiceShippingInput(String(Number.isFinite(s) ? s : 0));
    const cid = sourceOrder.customer_id ?? sourceOrder.customerId ?? '';
    setInvoiceCustomerId(cid != null && String(cid).trim() !== '' ? String(cid).trim() : '');
    setInvoiceAddress(sourceOrder.address != null ? String(sourceOrder.address) : '');
    setInvoiceCity(sourceOrder.city != null ? String(sourceOrder.city) : '');
    setInvoiceState(sourceOrder.state != null ? String(sourceOrder.state) : '');
    setInvoiceZip(sourceOrder.zip != null ? String(sourceOrder.zip) : '');
    setInvoiceCountry(sourceOrder.country != null ? String(sourceOrder.country) : '');
    const rawPm = sourceOrder.payment_method_accounts_id;
    const pm =
      (rawPm && typeof rawPm === 'object' ? (rawPm._id ?? rawPm.id) : rawPm) ??
      sourceOrder.posPayMethod ??
      sourceOrder.payment_method_id ??
      sourceOrder.account_id ??
      '';
    setInvoicePosPayMethod(pm != null && String(pm).trim() !== '' ? String(pm).trim() : '');
  }, [sourceOrder]);

  useEffect(() => {
    if (!invoiceId) return undefined;
    let cancelled = false;
    setUsersStatus('loading');
    setUsersError(null);
    (async () => {
      try {
        const list = await fetchUsersListRequest({ limit: 2000, skip: 0 });
        if (cancelled) return;
        setUsers(Array.isArray(list) ? list : []);
        setUsersStatus('succeeded');
      } catch (e) {
        if (!cancelled) {
          setUsers([]);
          setUsersError(e?.message || 'Could not load customers');
          setUsersStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId) return undefined;
    let cancelled = false;
    setPaymentMethodsStatus('loading');
    setPaymentMethodsError('');
    (async () => {
      try {
        const result = await fetchAccountsRequest({
          limit: 2000,
          skip: 0,
          account_type: 'current_asset',
          sortBy: 'createdAt',
          sortOrder: 'asc',
        });
        if (cancelled) return;
        setPaymentMethods(Array.isArray(result?.data) ? result.data : []);
        setPaymentMethodsStatus('succeeded');
      } catch (e) {
        if (!cancelled) {
          setPaymentMethods([]);
          setPaymentMethodsError(e?.message || 'Could not load accounts');
          setPaymentMethodsStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId) {
      setSourceOrder(null);
      setView({ ...DEMO_INVOICE, shopName });
      setFetchStatus('succeeded');
      setFetchError(null);
      setInvoiceSaveMessage({ type: null, text: '' });
      return undefined;
    }

    let cancelled = false;
    setFetchStatus('loading');
    setFetchError(null);
    setView(null);
    setSourceOrder(null);
    setInvoiceSaveMessage({ type: null, text: '' });
    setInvoiceDraftLines([]);
    setInvoiceCustomerId('');
    setInvoiceAddress('');
    setInvoiceCity('');
    setInvoiceState('');
    setInvoiceZip('');
    setInvoiceCountry('');
    setInvoicePosPayMethod('');
    setInvoiceDiscountInput('');
    setInvoiceDiscountPercentInput('');
    setInvoiceShippingInput('');
    discountEditSourceRef.current = null;

    (async () => {
      const requestedId = invoiceId;
      try {
        let order = null;
        let lastError = null;

        if (isDeletedOrderView) {
          try {
            order = await fetchDeletedOrderForInvoiceRequest(requestedId);
          } catch (e) {
            lastError = e;
          }
        } else {
          try {
            order = await fetchOrderForInvoiceRequest(requestedId);
          } catch (e) {
            lastError = e;
            // Soft-deleted orders may still be opened with ?readonly=1 from history.
            try {
              order = await fetchDeletedOrderForInvoiceRequest(requestedId);
              lastError = null;
            } catch {
              /* keep original error */
            }
          }
        }

        if (!order && orderSnapshot && orderSnapshotMatchesId(orderSnapshot, requestedId)) {
          order = orderSnapshot;
          lastError = null;
        }

        if (cancelled) return;

        if (!order) {
          throw lastError || new Error('Failed to load invoice');
        }

        setSourceOrder(order);
        setView(mapOrderToInvoiceView(order, { origin: window.location.origin }));
        setFetchStatus('succeeded');
      } catch (e) {
        if (cancelled) return;
        setFetchError(e?.message || 'Failed to load invoice');
        setFetchStatus('failed');
        setView(null);
        setSourceOrder(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoiceId, isDeletedOrderView, orderSnapshot]);

  const data = (() => {
    const base = view || {
      ...DEMO_INVOICE,
      shopName,
      invoiceNo: invoiceId || DEMO_INVOICE.invoiceNo,
    };
    const lines = Array.isArray(base.lines) ? base.lines : [];
    const termsBody = Array.isArray(base.termsBody) ? base.termsBody : DEMO_INVOICE.termsBody || [];
    const billTo =
      base.billTo && typeof base.billTo === 'object' ? base.billTo : DEMO_INVOICE.billTo;
    const summary =
      base.summary && typeof base.summary === 'object' ? base.summary : DEMO_INVOICE.summary;
    const authorizedPerson =
      base.authorizedPerson && typeof base.authorizedPerson === 'object'
        ? base.authorizedPerson
        : DEMO_INVOICE.authorizedPerson;
    return { ...base, lines, termsBody, billTo, summary, authorizedPerson };
  })();

  const paymentMethodDisplay = useMemo(
    () => resolvePaymentMethodLabel(sourceOrder, paymentMethods, invoicePosPayMethod),
    [sourceOrder, paymentMethods, invoicePosPayMethod]
  );

  const buildOrderUpdatePayload = useCallback((order, draftLines = [], orderStatus = null) => {
    if (!order || typeof order !== 'object') {
      return {
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        lines: [],
        discount: 0,
        discount_percentage: 0,
        order_status: normalizeOrderStatus(orderStatus),
        amount_received: '',
        change_given: '',
      };
    }
    const lines = (draftLines || [])
      .map((d) => {
        const productId = String(d?.productId ?? '').trim();
        const qtyNum = parseFloat(String(d?.qty ?? '0').replace(/,/g, ''));
        const rateNum = parseFloat(String(d?.rate ?? '0').replace(/,/g, ''));
        const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
        const price = Number.isFinite(rateNum) ? rateNum : 0;
        return { productId, qty, price };
      })
      .filter((l) => l.productId);

    const discountRaw = order.discount ?? order.discount_amount ?? 0;
    const discountNum = parseFloat(String(discountRaw).replace(/,/g, ''));
    const discount = Number.isFinite(discountNum) ? discountNum : 0;
    const discount_percentage = pickOrderDiscountPercent(order);

    const order_status = normalizeOrderStatus(
      orderStatus ?? order.order_status ?? order.orderStatus ?? order.status
    );

    const amount_received =
      order.amount_received != null && order.amount_received !== '' ? order.amount_received : '';
    const change_given =
      order.change_given != null && order.change_given !== '' ? order.change_given : '';

    return {
      name: order.name ?? '',
      email: order.email ?? '',
      phone: order.phone ?? '',
      address: order.address ?? '',
      city: order.city ?? '',
      state: order.state ?? '',
      zip: order.zip ?? '',
      country: order.country ?? '',
      lines,
      discount,
      discount_percentage,
      order_status,
      amount_received,
      change_given,
    };
  }, []);

  const handleUpdateInvoice = useCallback(async () => {
    const oid = sourceOrder?._id ?? sourceOrder?.id;
    if (!oid) return;
    const hasLines = invoiceDraftLines.some((d) => String(d?.productId ?? '').trim());
    if (!hasLines) {
      setInvoiceSaveMessage({
        type: 'danger',
        text: 'Add at least one product line before updating.',
      });
      return;
    }
    setInvoiceSaving(true);
    setInvoiceSaveMessage({ type: null, text: '' });
    try {
      const base = buildOrderUpdatePayload(sourceOrder, invoiceDraftLines, invoiceOrderStatus);
      const discNum = parseFloat(String(invoiceDiscountInput).replace(/,/g, ''));
      const discPctNum = parseFloat(String(invoiceDiscountPercentInput).replace(/,/g, ''));
      const shipNum = parseFloat(String(invoiceShippingInput).replace(/,/g, ''));
      const discount = Number.isFinite(discNum) ? discNum : 0;
      const discount_percentage = Number.isFinite(discPctNum) ? discPctNum : 0;
      const shipping = Number.isFinite(shipNum) ? shipNum : 0;
      const customer = invoiceCustomerId
        ? users.find((u) => getUserOptionValue(u) === invoiceCustomerId)
        : null;
      const payload = {
        ...base,
        name: customer?.name || customer?.fullName || customer?.username || base.name,
        email: customer?.email || base.email,
        phone: customer?.mobile || customer?.phone || customer?.phoneNumber || base.phone,
        address: invoiceAddress.trim(),
        city: invoiceCity.trim(),
        state: invoiceState.trim(),
        zip: invoiceZip.trim(),
        country: invoiceCountry.trim(),
        discount,
        discount_percentage,
        shipping,
        shipment: shipping,
        customer_id: invoiceCustomerId || undefined,
        posPayMethod: invoicePosPayMethod || undefined,
        payment_method_id: invoicePosPayMethod || undefined,
        payment_method_accounts_id: invoicePosPayMethod || undefined,
      };
      await updatePosOrderRequest(String(oid), payload);
      const refreshed = await fetchOrderForInvoiceRequest(invoiceId);
      setSourceOrder(refreshed);
      setView(mapOrderToInvoiceView(refreshed, { origin: window.location.origin }));
      setInvoiceSaveMessage({ type: 'success', text: 'Invoice updated successfully.' });
      toast.success('Invoice updated successfully.');
    } catch (e) {
      console.error('[POS invoice] Failed to update invoice', e);
      const cartLines = invoiceDraftLines.map((line) => ({
        productId: line?.productId,
        name: line?.label,
      }));
      toast.error(
        formatPosOrderErrorMessage(e?.message, {
          cartLines,
          productId: e?.productId,
          productName: e?.productName,
        }),
        { delay: 8000 }
      );
    } finally {
      setInvoiceSaving(false);
    }
  }, [
    sourceOrder,
    buildOrderUpdatePayload,
    invoiceId,
    invoiceDraftLines,
    invoiceOrderStatus,
    invoiceDiscountInput,
    invoiceDiscountPercentInput,
    invoiceShippingInput,
    invoiceCustomerId,
    invoiceAddress,
    invoiceCity,
    invoiceState,
    invoiceZip,
    invoiceCountry,
    invoicePosPayMethod,
    users,
  ]);

  const canUpdateInvoice =
    !isReadOnlyView &&
    Boolean(sourceOrder) &&
    (sourceOrder._id != null || sourceOrder.id != null);

  const customerOptions = useMemo(() => {
    const walkIn = { value: '', label: 'Walk in (no customer)' };
    const rows = users
      .filter((u) => getUserOptionValue(u))
      .map((u) => {
        const email = u.email || '';
        const phone = u.mobile || u.phone || u.phoneNumber || '';
        return {
          value: getUserOptionValue(u),
          label: formatUserOptionLabel(u),
          subLabel: [email, phone].filter(Boolean).join(' · '),
        };
      });
    return [walkIn, ...rows];
  }, [users]);

  const openAddCustomerModal = useCallback(() => {
    setAddCustomerForm(ADD_CUSTOMER_INITIAL);
    setAddCustomerErrors({});
    setCreateCustomerError('');
    const el = document.getElementById(INVOICE_ADD_CUSTOMER_MODAL_ID);
    if (el && window.bootstrap?.Modal) {
      const M = window.bootstrap.Modal;
      const instance =
        typeof M.getOrCreateInstance === 'function'
          ? M.getOrCreateInstance(el)
          : M.getInstance(el) || new M(el);
      instance.show();
    }
  }, []);

  const closeAddCustomerModal = useCallback(() => {
    const el = document.getElementById(INVOICE_ADD_CUSTOMER_MODAL_ID);
    if (el && window.bootstrap?.Modal) {
      const instance = window.bootstrap.Modal.getInstance(el);
      instance?.hide();
    }
  }, []);

  const validateAddCustomer = useCallback(() => {
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
  }, [addCustomerForm]);

  const handleAddCustomerFieldChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      const nextValue = name === 'phone' ? digitsOnlyFromPhone(value).slice(0, 11) : value;
      setAddCustomerForm((prev) => ({ ...prev, [name]: nextValue }));
      if (addCustomerErrors[name]) {
        setAddCustomerErrors((prev) => ({ ...prev, [name]: '' }));
      }
      setCreateCustomerError('');
    },
    [addCustomerErrors]
  );

  const handleAddCustomerSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setCreateCustomerError('');
      if (!validateAddCustomer()) return;
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
        let list = [];
        try {
          list = await fetchUsersListRequest({ limit: 2000, skip: 0 });
        } catch {
          list = Array.isArray(users) ? [...users] : [];
          if (created && newId) list = [created, ...list];
        }
        setUsers(Array.isArray(list) ? list : []);
        setUsersStatus('succeeded');
        setUsersError(null);

        let selectedId = newId || '';
        if (!selectedId && resolvedEmail) {
          const match = (Array.isArray(list) ? list : []).find(
            (u) => String(u?.email || '').trim().toLowerCase() === resolvedEmail.toLowerCase()
          );
          selectedId = getUserOptionValue(match) || '';
        }
        if (selectedId) setInvoiceCustomerId(selectedId);

        setAddCustomerForm(ADD_CUSTOMER_INITIAL);
        closeAddCustomerModal();
        toast.success('Customer added successfully.');
      } catch (err) {
        setCreateCustomerError(err?.message || 'Could not create customer');
      } finally {
        setCreateCustomerSubmitting(false);
      }
    },
    [addCustomerForm, closeAddCustomerModal, users, validateAddCustomer]
  );

  const billToDisplay = useMemo(() => {
    const fallback =
      view?.billTo && typeof view.billTo === 'object' ? view.billTo : DEMO_INVOICE.billTo;
    if (!canUpdateInvoice) return fallback;
    const addressFields = {
      address: invoiceAddress || '',
      city: invoiceCity || '',
      state: invoiceState || '',
      zip: invoiceZip || '',
      country: invoiceCountry || '',
    };
    if (!invoiceCustomerId) {
      const o = sourceOrder;
      if (o) {
        return {
          name: o.name || '—',
          phone: o.phone || '—',
          email: o.email || '—',
          ...addressFields,
        };
      }
      return { ...fallback, ...addressFields };
    }
    const u = users.find((row) => getUserOptionValue(row) === invoiceCustomerId);
    if (!u) return { ...fallback, ...addressFields };
    return {
      name: u.name || u.fullName || u.username || fallback.name,
      phone: u.mobile || u.phone || u.phoneNumber || fallback.phone,
      email: u.email || fallback.email,
      ...addressFields,
    };
  }, [
    canUpdateInvoice,
    invoiceCustomerId,
    invoiceAddress,
    invoiceCity,
    invoiceState,
    invoiceZip,
    invoiceCountry,
    users,
    sourceOrder,
    view,
  ]);

  const invoiceHasSaveableLines = useMemo(
    () => invoiceDraftLines.some((d) => String(d?.productId ?? '').trim()),
    [invoiceDraftLines]
  );

  useEffect(() => {
    if (!canUpdateInvoice) {
      setAddProductResults([]);
      setAddProductError('');
      return undefined;
    }
    const q = addProductQuery.trim();
    if (q.length < 2) {
      setAddProductResults([]);
      setAddProductError('');
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setAddProductLoading(true);
      setAddProductError('');
      try {
        const res = await fetchProductActiveRequest({ search: q, page: 1, limit: 30 });
        if (cancelled) return;
        setAddProductResults(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) {
          setAddProductError(e?.message || 'Search failed');
          setAddProductResults([]);
        }
      } finally {
        if (!cancelled) setAddProductLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addProductQuery, canUpdateInvoice]);

  const handleDraftLineEdit = useCallback((key, field, rawValue) => {
    setInvoiceDraftLines((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: rawValue } : row))
    );
  }, []);

  const removeDraftLine = useCallback((key) => {
    setInvoiceDraftLines((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const appendDraftProduct = useCallback((product) => {
    if (!product || typeof product !== 'object') return;
    const id = String(product._id ?? product.id ?? '').trim();
    if (!id) return;
    const rate = productPickerUnitPrice(product);
    const taxPct = Number(product.tax_rate) || 0;
    setInvoiceDraftLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        productId: id,
        label: productPickerLabel(product),
        taxPct,
        qty: '1',
        rate: String(rate),
      },
    ]);
    setAddProductQuery('');
    setAddProductResults([]);
    setAddProductError('');
  }, []);

  const invoiceLineTotals = useMemo(() => {
    let subTotal = 0;
    let taxTotal = 0;
    let totalQty = 0;
    invoiceDraftLines.forEach((d) => {
      if (!String(d?.productId ?? '').trim()) return;
      const qtyNum = parseFloat(String(d?.qty ?? '0').replace(/,/g, ''));
      const rateNum = parseFloat(String(d?.rate ?? '0').replace(/,/g, ''));
      const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
      const rate = Number.isFinite(rateNum) ? rateNum : 0;
      const taxPct = Number(d.taxPct) || 0;
      const lineSub = qty * rate;
      const taxAmount = (lineSub * taxPct) / 100;
      subTotal += lineSub;
      taxTotal += taxAmount;
      totalQty += qty;
    });
    return { subTotal, taxTotal, totalQty, totalBeforeAdjust: subTotal + taxTotal };
  }, [invoiceDraftLines]);

  useEffect(() => {
    const base = invoiceLineTotals.totalBeforeAdjust;
    const pct = String(invoiceDiscountPercentInput ?? '').trim();
    const amt = String(invoiceDiscountInput ?? '').trim();
    const mode =
      discountEditSourceRef.current ||
      (pct !== '' ? 'percent' : amt !== '' ? 'amount' : null);

    if (mode === 'percent') {
      const pct = String(invoiceDiscountPercentInput).trim();
      if (!pct) {
        setInvoiceDiscountInput('');
        return;
      }
      if (isPartialDiscountInput(pct)) return;
      setInvoiceDiscountInput(amountFromDiscountPercent(base, pct));
      return;
    }
    if (mode === 'amount') {
      const amt = String(invoiceDiscountInput).trim();
      if (!amt) {
        setInvoiceDiscountPercentInput('');
        return;
      }
      if (isPartialDiscountInput(amt)) return;
      setInvoiceDiscountPercentInput(percentFromDiscountAmount(base, amt));
    }
  }, [invoiceLineTotals.totalBeforeAdjust, invoiceDiscountPercentInput, invoiceDiscountInput]);

  const handleInvoiceDiscountPercentChange = useCallback(
    (e) => {
      const raw = e.target.value;
      discountEditSourceRef.current = 'percent';
      setInvoiceDiscountPercentInput(raw);
      if (!raw.trim() || isPartialDiscountInput(raw)) {
        if (!raw.trim()) setInvoiceDiscountInput('');
        return;
      }
      setInvoiceDiscountInput(amountFromDiscountPercent(invoiceLineTotals.totalBeforeAdjust, raw));
    },
    [invoiceLineTotals.totalBeforeAdjust]
  );

  const handleInvoiceDiscountChange = useCallback(
    (e) => {
      const raw = e.target.value;
      discountEditSourceRef.current = 'amount';
      setInvoiceDiscountInput(raw);
      if (!raw.trim() || isPartialDiscountInput(raw)) {
        if (!raw.trim()) setInvoiceDiscountPercentInput('');
        return;
      }
      setInvoiceDiscountPercentInput(
        percentFromDiscountAmount(invoiceLineTotals.totalBeforeAdjust, raw)
      );
    },
    [invoiceLineTotals.totalBeforeAdjust]
  );

  const liveSummaryFromDraft = useMemo(() => {
    const hasOrder =
      sourceOrder &&
      typeof sourceOrder === 'object' &&
      (sourceOrder._id != null || sourceOrder.id != null);
    if (!hasOrder || !view?.summary) return null;
    const { subTotal, taxTotal, totalBeforeAdjust } = invoiceLineTotals;
    const pctRaw = String(invoiceDiscountPercentInput ?? '').trim();
    const pctParsed = parseFloat(pctRaw.replace(/,/g, ''));
    const hasPctInput =
      pctRaw !== '' && !isPartialDiscountInput(pctRaw) && Number.isFinite(pctParsed);
    const discountPercentage = hasPctInput ? Math.max(0, pctParsed) : 0;

    const amtRaw = String(invoiceDiscountInput ?? '').trim();
    const amtParsed = parseFloat(amtRaw.replace(/,/g, ''));
    const hasAmtInput =
      amtRaw !== '' && !isPartialDiscountInput(amtRaw) && Number.isFinite(amtParsed);

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    // Use the last edited field as the source of truth:
    // - If user typed discount amount last, use that exact number (prevents 49.98 vs 50 drift).
    // - If user typed discount % last, compute from % (0% means no discount).
    // - If neither is actively edited, default to 0 for live recalculation.
    let discount = 0;
    const lastEdit = discountEditSourceRef.current;
    if (lastEdit === 'amount' && hasAmtInput) {
      discount = Math.max(0, round2(amtParsed));
    } else if (hasPctInput) {
      discount = Math.max(
        0,
        round2((Number(totalBeforeAdjust) || 0) * (discountPercentage / 100))
      );
    } else if (hasAmtInput) {
      discount = Math.max(0, round2(amtParsed));
    } else {
      discount = 0;
    }
    const shippingParsed = parseFloat(String(invoiceShippingInput).replace(/,/g, ''));
    const shipping = Number.isFinite(shippingParsed)
      ? shippingParsed
      : Number(view.summary.shipping) || 0;
    const total = Math.max(0, totalBeforeAdjust - discount + shipping);
    const paymentMade = Number(view.summary.paymentMade) || 0;
    return {
      subTotal,
      tax: taxTotal,
      discount,
      discountPercentage,
      shipping,
      total,
      paymentMade,
      balanceDue: Math.max(0, total - paymentMade),
    };
  }, [
    sourceOrder,
    invoiceDraftLines,
    invoiceLineTotals,
    view,
    invoiceDiscountInput,
    invoiceDiscountPercentInput,
    invoiceShippingInput,
  ]);

  const summaryDisplay = liveSummaryFromDraft ?? data.summary;
  const grossDisplay = liveSummaryFromDraft != null ? liveSummaryFromDraft.total : data.grossAmount;

  const totalQtyDisplay = useMemo(() => {
    if (canUpdateInvoice) {
      return Number(invoiceLineTotals.totalQty) || 0;
    }
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    return lines.reduce((sum, line) => {
      const raw = line?.qtyLabel ?? line?.qty ?? line?.quantity ?? 0;
      const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [canUpdateInvoice, invoiceLineTotals.totalQty, data?.lines]);

  const formatTotalQty = useCallback((n) => {
    const qty = Number(n) || 0;
    if (!Number.isFinite(qty)) return '0';
    const rounded = Math.round(qty * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  }, []);

  const originalTotal = useMemo(() => {
    const base = data?.summary?.total ?? data?.grossAmount ?? 0;
    const n = Number(base);
    return Number.isFinite(n) ? n : 0;
  }, [data]);

  const totalDifference = useMemo(() => {
    if (!canUpdateInvoice) return 0;
    // Only meaningful when editing an existing invoice.
    if (!liveSummaryFromDraft) return 0;
    const editedTotal = Number(liveSummaryFromDraft.total) || 0;
    const diff = editedTotal - originalTotal;
    // Avoid noisy -0.00
    return Math.abs(diff) < 0.005 ? 0 : diff;
    // Depend on draft inputs explicitly so delete/add always recalculates.
  }, [
    canUpdateInvoice,
    liveSummaryFromDraft,
    originalTotal,
    invoiceDraftLines,
    invoiceDiscountInput,
    invoiceDiscountPercentInput,
    invoiceShippingInput,
  ]);

  const formatSignedMoney = useCallback(
    (diff) => {
      const n = Number(diff) || 0;
      if (n === 0) return fmt(0);
      const sign = n > 0 ? '+' : '-';
      return `${sign} ${fmt(Math.abs(n))}`;
    },
    [fmt]
  );

  const printLines = useMemo(() => {
    if (canUpdateInvoice && invoiceDraftLines.length > 0) {
      return invoiceDraftLines
        .filter((d) => String(d?.productId ?? '').trim())
        .map((row) => {
          const qtyNum = parseFloat(String(row.qty ?? '0').replace(/,/g, ''));
          const rateNum = parseFloat(String(row.rate ?? '0').replace(/,/g, ''));
          const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
          const rate = Number.isFinite(rateNum) ? rateNum : 0;
          const taxPct = Number(row.taxPct) || 0;
          const lineSub = qty * rate;
          const taxAmount = (lineSub * taxPct) / 100;
          const amount = lineSub + taxAmount;
          const qtyLabel = Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
          return { description: row.label, rate, qtyLabel, amount };
        });
    }
    return (data.lines || []).map((line) => ({
      description: line.description,
      rate: line.rate,
      qtyLabel: line.qtyLabel,
      amount: line.amount,
    }));
  }, [canUpdateInvoice, invoiceDraftLines, data.lines]);

  const buildBrandFromCompany = useCallback((company) => {
    const name = company?.company_name || company?.name || shopName;
    return {
      name: String(name || shopName).trim() || shopName,
      phone: String(company?.company_phone || company?.phone || '').trim(),
      email: String(company?.company_email || company?.email || '').trim(),
      address: String(company?.company_address || company?.address || '').trim(),
      logoUrl: pickCompanyLogoUrl(company),
    };
  }, []);

  const handleNormalPrint = useCallback(async () => {
    let settings = printerSettings;
    let brand = companyBrand;

    if (companyId) {
      try {
        const body = await fetchCompanyById(companyId);
        const company = getCompanyFromApiBody(body);
        if (company && typeof company === 'object') {
          const merged = mergeCompanyRecordForSettings(company, authCompany);
          setInvoiceCompany(merged);
          settings = mergePrinterSettings(extractPrinterSettingsFromCompanyBody({ data: merged }));
          brand = buildBrandFromCompany(merged);
        }
      } catch {
        // print with last known settings
      }
    }

    await openNormalInvoicePrint(
      {
        printerSettings: settings,
        companyBrand: brand,
        invoiceNo: data.invoiceNo,
        invoiceDate: data.invoiceDate,
        terms: data.terms,
        note: data.note,
        termsBody: data.termsBody,
        publicUrl: data.publicUrl,
        billTo: billToDisplay,
        lines: printLines,
        summary: summaryDisplay,
        grossAmount: grossDisplay,
        paymentMethod: paymentMethodDisplay,
        amountReceived: sourceOrder?.amount_received,
        changeGiven: sourceOrder?.change_given,
        currentUserName: billCurrentUserName,
      },
      { documentTitlePrefix: 'Invoice POS' }
    );
  }, [
    companyId,
    printerSettings,
    companyBrand,
    authCompany,
    buildBrandFromCompany,
    data,
    billToDisplay,
    printLines,
    summaryDisplay,
    grossDisplay,
    paymentMethodDisplay,
    sourceOrder,
    billCurrentUserName,
  ]);

  const handleShareWhatsApp = useCallback(() => {
    const publicUrl = String(data?.publicUrl || '').trim();
    if (!publicUrl) {
      toast.error('Public invoice link is not available yet.');
      return;
    }

    const clientName = String(billToDisplay?.name || '').trim();
    const clientPhone = String(billToDisplay?.phone || '').trim();
    const invoiceLabel = data?.invoiceNo ? `POS# ${data.invoiceNo}` : 'your invoice';
    const companyLabel = companyBrand?.name || shopName;
    const totalLabel = fmt(grossDisplay);

    const greeting =
      clientName && clientName !== '—' ? `Hello ${clientName},` : 'Hello,';
    const message = [
      greeting,
      '',
      `Here is ${invoiceLabel} from ${companyLabel}.`,
      `Total: ${totalLabel}`,
      '',
      publicUrl,
    ].join('\n');

    const url = buildWhatsAppUrl(clientPhone !== '—' ? clientPhone : '', message);
    if (!url) {
      toast.error('Could not open WhatsApp.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [data, billToDisplay, companyBrand, grossDisplay]);

  const handleThermalPrint = useCallback(async () => {
    if (!view) return;

    let settings = printerSettings;
    let brand = companyBrand;

    if (companyId) {
      try {
        const body = await fetchCompanyById(companyId);
        const company = getCompanyFromApiBody(body);
        if (company && typeof company === 'object') {
          const merged = mergeCompanyRecordForSettings(company, authCompany);
          setInvoiceCompany(merged);
          settings = mergePrinterSettings(extractPrinterSettingsFromCompanyBody({ data: merged }));
          brand = buildBrandFromCompany(merged);
        }
      } catch {
        // print with last known settings
      }
    }

    await openThermalReceiptPrint(
      {
        shopName: brand.name,
        invoiceNo: data.invoiceNo,
        invoiceDate: data.invoiceDate,
        paymentMethod: paymentMethodDisplay,
        paymentStatus: view.paymentStatus,
        billTo: billToDisplay,
        lines: printLines,
        summary: summaryDisplay,
        grossAmount: grossDisplay,
        terms: data.terms,
        publicUrl: data.publicUrl,
        currentUserName: billCurrentUserName,
        cashier: billCurrentUserName,
      },
      {
        documentTitlePrefix: 'Receipt POS',
        printerSettings: settings,
        companyBrand: brand,
        sourceOrder,
      }
    );
  }, [
    view,
    companyId,
    printerSettings,
    companyBrand,
    authCompany,
    buildBrandFromCompany,
    data,
    paymentMethodDisplay,
    billToDisplay,
    printLines,
    summaryDisplay,
    grossDisplay,
    sourceOrder,
    billCurrentUserName,
  ]);

  if (fetchStatus === 'loading') {
    return (
      <div className="pos-invoice-page container-fluid py-4">
        <div className="card shadow-sm pos-invoice-card mx-auto" style={{ maxWidth: 1200 }}>
          <div className="card-body py-5 text-center text-muted">
            <div className="spinner-border text-primary mb-3" role="status" aria-label="Loading" />
            Loading invoice…
          </div>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="pos-invoice-page container-fluid py-4">
        <div className="card shadow-sm pos-invoice-card mx-auto" style={{ maxWidth: 1200 }}>
          <div className="card-body">
            <Link to="/pos" className="pos-inv-back d-inline-flex mb-3">
              <i className="fas fa-arrow-left" aria-hidden="true" />
              Back to POS
            </Link>
            <div className="alert alert-danger mb-0" role="alert">
              {fetchError || 'Could not load this invoice.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel = invoiceOrderStatus
    ? invoiceOrderStatus.charAt(0).toUpperCase() + invoiceOrderStatus.slice(1)
    : '—';

  return (
    <div className="pos-invoice-page container-fluid py-4 px-0">
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm pos-invoice-card">
            <div className="card-header pb-3 pos-inv-no-print">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-6">
                  <Link to="/pos" className="pos-inv-back">
                    <i className="fas fa-arrow-left" aria-hidden="true" />
                    Back to POS
                  </Link>
                  <h5 className="pos-inv-header-title mb-0">Invoice</h5>
                  <div className="pos-inv-meta mt-2">
                    {printerSettings.show_invoice_no ? (
                      <span className="pos-inv-ref-badge">POS# {data.invoiceNo}</span>
                    ) : null}
                    {canUpdateInvoice ? (
                      <span className={`badge text-xxs ${poStatusBadgeClass(invoiceOrderStatus)}`}>
                        {statusLabel}
                      </span>
                    ) : sourceOrder ? (
                      <span className={`badge text-xxs ${poStatusBadgeClass(invoiceOrderStatus)}`}>
                        {statusLabel}
                        {isDeletedOrderView || isReadOnlyView ? ' · View only' : ''}
                      </span>
                    ) : null}
                    {printerSettings.show_gross_amount ? (
                      <span className="pos-inv-total-pill">Total {fmt(grossDisplay)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="pos-inv-header-actions mt-2 mt-lg-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleThermalPrint}
                      title="80mm thermal receipt"
                    >
                      <i className="fas fa-receipt me-1" aria-hidden="true" />
                      Thermal
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={handleNormalPrint}
                      title="A4 / normal invoice print"
                    >
                      <i className="fas fa-print me-1" aria-hidden="true" />
                      Print
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={handleShareWhatsApp}
                      disabled={!data?.publicUrl}
                      title={
                        data?.publicUrl
                          ? 'Share invoice link on client WhatsApp'
                          : 'Public invoice link unavailable'
                      }
                    >
                      <NavIcon icon={FaWhatsapp} size={14} className="me-1" />
                      WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body pt-3">
              {invoiceSaveMessage.type && invoiceSaveMessage.text ? (
                <div
                  className={`alert alert-${invoiceSaveMessage.type === 'success' ? 'success' : 'danger'} py-2 px-3 mb-3 pos-inv-no-print`}
                  role="alert"
                >
                  {invoiceSaveMessage.text}
                </div>
              ) : null}

              <div className="pos-inv-doc-strip">
                <div className="pos-inv-company">
                  {printerSettings.show_logo ? (
                    companyBrand.logoUrl ? (
                      <img
                        src={companyBrand.logoUrl}
                        alt={`${companyBrand.name} logo`}
                        className="pos-inv-company-logo"
                      />
                    ) : (
                      <div className="pos-inv-company-logo-fallback">
                        {companyBrand.name.charAt(0).toUpperCase()}
                      </div>
                    )
                  ) : null}
                  <div className="min-w-0">
                    {printerSettings.show_company_name ? (
                      <div className="pos-inv-company-name">{companyBrand.name}</div>
                    ) : null}
                    <div className="pos-inv-company-meta">
                      {[
                        printerSettings.show_email && companyBrand.email
                          ? companyBrand.email
                          : null,
                        printerSettings.show_phone && companyBrand.phone
                          ? companyBrand.phone
                          : null,
                        printerSettings.show_address && companyBrand.address
                          ? companyBrand.address
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Point of sale invoice'}
                    </div>
                  </div>
                </div>
                <div className="text-md-end">
                  <div className="pos-inv-doc-label">Invoice</div>
                  {printerSettings.show_invoice_no ? (
                    <div className="fw-bold text-dark mb-1">POS# {data.invoiceNo}</div>
                  ) : null}
                  {printerSettings.show_gross_amount ? (
                    <>
                      <div className="pos-inv-doc-label mt-2">Amount</div>
                      <div className="pos-inv-doc-total">{fmt(grossDisplay)}</div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="pos-inv-section">
                <div className="row g-3">
                  <div className="col-lg-6">
                    <div className="pos-inv-section-title">Bill to</div>
                    {canUpdateInvoice ? (
                      <>
                        <label className="form-label" htmlFor="posInvCustomer">
                          Customer
                        </label>
                        <div className="d-flex gap-2 align-items-start mb-2 pos-inv-no-print">
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <SearchableSelect
                              options={customerOptions}
                              value={invoiceCustomerId}
                              placeholder="Walk in (no customer)"
                              disabled={usersStatus === 'loading'}
                              onChange={setInvoiceCustomerId}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm pos-inv-add-customer-btn px-3"
                            title="Add new customer"
                            onClick={openAddCustomerModal}
                          >
                            Add
                          </button>
                        </div>
                        {usersError ? (
                          <div className="small text-danger mb-2 pos-inv-no-print">
                            {usersError}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div className="pos-inv-billto-name">{billToDisplay.name}</div>
                    {printerSettings.show_customer_phone && billToDisplay.phone ? (
                      <div className="pos-inv-billto-meta">{billToDisplay.phone}</div>
                    ) : null}
                    {printerSettings.show_customer_email && billToDisplay.email ? (
                      <div className="pos-inv-billto-meta">{billToDisplay.email}</div>
                    ) : null}
                    {canUpdateInvoice ? (
                      <div className="row g-2 mt-2 pos-inv-no-print">
                        <div className="col-12">
                          <label className="form-label" htmlFor="posInvAddress">
                            Address
                          </label>
                          <textarea
                            id="posInvAddress"
                            className="form-control form-control-sm"
                            rows={2}
                            value={invoiceAddress}
                            onChange={(e) => setInvoiceAddress(e.target.value)}
                            placeholder="Street address"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label" htmlFor="posInvCity">
                            City
                          </label>
                          <input
                            id="posInvCity"
                            type="text"
                            className="form-control form-control-sm"
                            value={invoiceCity}
                            onChange={(e) => setInvoiceCity(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label" htmlFor="posInvState">
                            State
                          </label>
                          <input
                            id="posInvState"
                            type="text"
                            className="form-control form-control-sm"
                            value={invoiceState}
                            onChange={(e) => setInvoiceState(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label" htmlFor="posInvZip">
                            Zip
                          </label>
                          <input
                            id="posInvZip"
                            type="text"
                            className="form-control form-control-sm"
                            value={invoiceZip}
                            onChange={(e) => setInvoiceZip(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label" htmlFor="posInvCountry">
                            Country
                          </label>
                          <input
                            id="posInvCountry"
                            type="text"
                            className="form-control form-control-sm"
                            value={invoiceCountry}
                            onChange={(e) => setInvoiceCountry(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {[
                      billToDisplay.address,
                      [billToDisplay.city, billToDisplay.state, billToDisplay.zip]
                        .filter(Boolean)
                        .join(', '),
                      billToDisplay.country,
                    ]
                      .filter(Boolean)
                      .map((line) => (
                        <div
                          key={line}
                          className={`pos-inv-billto-meta${canUpdateInvoice ? ' pos-inv-print-only' : ''}`}
                        >
                          {line}
                        </div>
                      ))}
                  </div>
                  <div className="col-lg-6 text-lg-end">
                    <div className="pos-inv-section-title">Invoice details</div>
                    {printerSettings.show_invoice_date ? (
                      <div className="small mb-2">
                        <span className="text-muted me-2">Date:</span>
                        <span className="fw-semibold">{data.invoiceDate}</span>
                      </div>
                    ) : null}
                    {printerSettings.show_current_user && billCurrentUserName ? (
                      <div className="small mb-2">
                        <span className="text-muted me-2">User:</span>
                        <span className="fw-semibold">{billCurrentUserName}</span>
                      </div>
                    ) : null}
                    {data.transactionNumber ? (
                      <div className="small mb-2">
                        <span className="text-muted me-2">Transaction #:</span>
                        <span className="fw-semibold">{data.transactionNumber}</span>
                      </div>
                    ) : null}
                    <div className="small">
                      <span className="text-muted me-2">Terms:</span>
                      <span className="fw-semibold">{data.terms}</span>
                    </div>
                    {printerSettings.show_payment_method ? (
                      <div className="small mt-2">
                        <span className="text-muted me-2">Payment:</span>
                        <span className="fw-semibold">{paymentMethodDisplay}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="pos-inv-section">
                <div className="pos-inv-section-title">Line items</div>
                {canUpdateInvoice ? (
                  <>
                    <p className="pos-inv-section-hint pos-inv-no-print">
                      Edit quantity and rate, add or remove lines, then save with Update invoice.
                    </p>
                    <div className="row g-2 mb-3 pos-inv-no-print">
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="pos-inv-order-status">
                          Order status
                        </label>
                        <select
                          id="pos-inv-order-status"
                          className="form-select form-select-sm"
                          value={invoiceOrderStatus}
                          onChange={(e) => setInvoiceOrderStatus(e.target.value)}
                        >
                          {ORDER_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-8">
                        <label className="form-label" htmlFor="pos-inv-add-product">
                          Add product
                        </label>
                        <div className="pos-inv-product-search position-relative">
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">
                              <SearchInputIcon />
                            </span>
                            <input
                              id="pos-inv-add-product"
                              type="search"
                              className="form-control"
                              placeholder="Search name, SKU, or barcode (min. 2 characters)…"
                              value={addProductQuery}
                              onChange={(e) => setAddProductQuery(e.target.value)}
                              autoComplete="off"
                            />
                          </div>
                          {addProductLoading ? (
                            <div className="small text-muted mt-1">Searching…</div>
                          ) : null}
                          {addProductError ? (
                            <div className="text-danger small mt-1" role="alert">
                              {addProductError}
                            </div>
                          ) : null}
                          {addProductResults.length > 0 ? (
                            <ul
                              className="list-group position-absolute w-100 shadow-sm mt-1"
                              style={{ zIndex: 20, maxHeight: '220px', overflowY: 'auto' }}
                            >
                              {addProductResults.map((p) => {
                                const pk = String(p._id ?? p.id ?? '');
                                return (
                                  <li key={pk} className="list-group-item p-0">
                                    <button
                                      type="button"
                                      className="list-group-item list-group-item-action border-0 py-2 px-3 text-start w-100"
                                      onClick={() => appendDraftProduct(p)}
                                    >
                                      <span className="fw-semibold">{productPickerLabel(p)}</span>
                                      <span className="text-muted ms-2">
                                        {fmt(productPickerUnitPrice(p))}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="pos-inv-table-wrap">
                  <div className="pos-inv-table-scroll">
                    <table className="table pos-inv-table mb-0">
                      <thead>
                        <tr>
                          <th className="text-center pos-inv-col-sno">#</th>
                          <th className="pos-inv-col-desc">Description</th>
                          <th className="text-end pos-inv-col-num">Rate</th>
                          <th className="text-end pos-inv-col-num">Qty</th>
                          <th className="text-end pos-inv-col-num">Amount</th>
                          {canUpdateInvoice ? (
                            <th
                              className="text-center pos-inv-col-action pos-inv-no-print"
                              aria-label="Remove row"
                            >
                              <span className="visually-hidden">Delete</span>
                            </th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {canUpdateInvoice ? (
                          invoiceDraftLines.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center text-muted py-4">
                                No line items. Search above to add products.
                              </td>
                            </tr>
                          ) : (
                            invoiceDraftLines.map((row, i) => {
                              const qtyNum = parseFloat(String(row.qty ?? '0').replace(/,/g, ''));
                              const rateNum = parseFloat(String(row.rate ?? '0').replace(/,/g, ''));
                              const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
                              const rate = Number.isFinite(rateNum) ? rateNum : 0;
                              const taxPct = Number(row.taxPct) || 0;
                              const lineSub = qty * rate;
                              const taxAmount = (lineSub * taxPct) / 100;
                              const amount = lineSub + taxAmount;
                              return (
                                <tr key={row.key}>
                                  <td className="text-center text-muted">{i + 1}</td>
                                  <td>
                                    <div className="pos-inv-line-desc" title={row.label}>
                                      {row.label}
                                    </div>
                                    {!String(row.productId || '').trim() ? (
                                      <div className="small text-warning">Missing product</div>
                                    ) : null}
                                  </td>
                                  <td className="text-end">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      className="form-control form-control-sm text-end"
                                      aria-label={`Rate for line ${i + 1}`}
                                      value={row.rate}
                                      onChange={(e) =>
                                        handleDraftLineEdit(row.key, 'rate', e.target.value)
                                      }
                                    />
                                  </td>
                                  <td className="text-end">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      className="form-control form-control-sm text-end"
                                      aria-label={`Quantity for line ${i + 1}`}
                                      value={row.qty}
                                      onChange={(e) =>
                                        handleDraftLineEdit(row.key, 'qty', e.target.value)
                                      }
                                    />
                                  </td>
                                  <td className="text-end fw-semibold text-nowrap">
                                    {fmt(amount)}
                                  </td>
                                  <td className="text-center pos-inv-col-action pos-inv-no-print">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger border-0 pos-inv-line-delete-btn"
                                      aria-label={`Remove line ${i + 1}`}
                                      title="Remove line"
                                      onClick={() => removeDraftLine(row.key)}
                                    >
                                      <NavIcon icon={FaTrash} size={20} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )
                        ) : (
                          data.lines.map((line, i) => (
                            <tr key={i}>
                              <td className="text-center text-muted">{i + 1}</td>
                              <td>
                                <div className="pos-inv-line-desc" title={line.description}>
                                  {line.description}
                                </div>
                              </td>
                              <td className="text-end">{fmt(line.rate)}</td>
                              <td className="text-end">{line.qtyLabel}</td>
                              <td className="text-end fw-semibold">{fmt(line.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="pos-inv-total-qty-row">
                          <td colSpan={3} className="text-end text-muted">
                            Total Qty
                          </td>
                          <td className="text-end fw-bold">{formatTotalQty(totalQtyDisplay)}</td>
                          <td colSpan={canUpdateInvoice ? 2 : 1} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              <div className="pos-inv-section">
                <div className="row g-4">
                  <div className="col-lg-6">
                    <div className="pos-inv-section-title">Payment &amp; notes</div>
                    {canUpdateInvoice ? (
                      <div className="mb-3 pos-inv-no-print">
                        <label className="form-label" htmlFor="posInvReceiveAccount">
                          Receive in account
                        </label>
                        <select
                          id="posInvReceiveAccount"
                          className="form-select form-select-sm"
                          value={invoicePosPayMethod}
                          onChange={(e) => setInvoicePosPayMethod(e.target.value)}
                          disabled={
                            paymentMethodsStatus === 'loading' || paymentMethods.length === 0
                          }
                        >
                          <option value="">Select account</option>
                          {paymentMethods.map((method) => {
                            const methodId = String(method._id ?? method.id ?? '');
                            if (!methodId) return null;
                            return (
                              <option key={methodId} value={methodId}>
                                {method.name || 'Unnamed account'}
                              </option>
                            );
                          })}
                        </select>
                        {paymentMethodsError ? (
                          <div className="small text-danger mt-1">{paymentMethodsError}</div>
                        ) : null}
                      </div>
                    ) : null}
                    <label className="form-label" htmlFor="pos-inv-note">
                      Note
                    </label>
                    <textarea
                      id="pos-inv-note"
                      className="form-control form-control-sm"
                      rows={5}
                      placeholder="Add a note…"
                      defaultValue={data.note}
                      readOnly
                    />
                  </div>
                  <div className="col-lg-6">
                    <div className="pos-inv-summary-panel">
                      <div className="pos-inv-section-title mb-3">Summary</div>
                      <div className="pos-inv-summary-box">
                        <div className="pos-inv-summary-row">
                          <span>Sub total</span>
                          <span>{fmt(summaryDisplay.subTotal)}</span>
                        </div>
                        <div className="pos-inv-summary-row">
                          <span>Tax</span>
                          <span>{fmt(summaryDisplay.tax)}</span>
                        </div>
                        {printerSettings.show_discount || canUpdateInvoice ? (
                          <div
                            className={`pos-inv-summary-row align-items-center ${!printerSettings.show_discount ? 'pos-inv-no-print' : ''}`}
                          >
                            <span className="text-muted">Discount</span>
                            {canUpdateInvoice ? (
                              <>
                                <input
                                  type="text"
                                  className="form-control form-control-sm text-end pos-inv-no-print"
                                  style={{ maxWidth: 140 }}
                                  inputMode="decimal"
                                  value={invoiceDiscountInput}
                                  onChange={handleInvoiceDiscountChange}
                                  aria-label="Discount amount"
                                />
                                <span className="d-none d-print-inline-block fw-semibold">
                                  {fmt(summaryDisplay.discount)}
                                </span>
                              </>
                            ) : (
                              <span>{fmt(summaryDisplay.discount)}</span>
                            )}
                          </div>
                        ) : null}
                        {printerSettings.show_discount || canUpdateInvoice ? (
                          <div
                            className={`pos-inv-summary-row align-items-center ${!printerSettings.show_discount ? 'pos-inv-no-print' : ''}`}
                          >
                            <span className="text-muted">Discount %</span>
                            {canUpdateInvoice ? (
                              <>
                                <input
                                  type="text"
                                  className="form-control form-control-sm text-end pos-inv-no-print"
                                  style={{ maxWidth: 140 }}
                                  inputMode="decimal"
                                  value={invoiceDiscountPercentInput}
                                  onChange={handleInvoiceDiscountPercentChange}
                                  aria-label="Discount percentage"
                                />
                                <span className="d-none d-print-inline-block fw-semibold">
                                  {summaryDisplay.discountPercentage != null &&
                                  Number.isFinite(summaryDisplay.discountPercentage)
                                    ? `${summaryDisplay.discountPercentage}%`
                                    : '—'}
                                </span>
                              </>
                            ) : (
                              <span>
                                {summaryDisplay.discountPercentage != null &&
                                Number.isFinite(summaryDisplay.discountPercentage)
                                  ? `${summaryDisplay.discountPercentage}%`
                                  : '—'}
                              </span>
                            )}
                          </div>
                        ) : null}
                        {printerSettings.show_shipping || canUpdateInvoice ? (
                          <div
                            className={`pos-inv-summary-row align-items-center ${!printerSettings.show_shipping ? 'pos-inv-no-print' : ''}`}
                          >
                            <span className="text-muted">Shipping</span>
                            {canUpdateInvoice ? (
                              <>
                                <input
                                  type="text"
                                  className="form-control form-control-sm text-end pos-inv-no-print"
                                  style={{ maxWidth: 140 }}
                                  inputMode="decimal"
                                  value={invoiceShippingInput}
                                  onChange={(e) => setInvoiceShippingInput(e.target.value)}
                                  aria-label="Shipping amount"
                                />
                                <span className="d-none d-print-inline-block fw-semibold">
                                  {fmt(summaryDisplay.shipping)}
                                </span>
                              </>
                            ) : (
                              <span>{fmt(summaryDisplay.shipping)}</span>
                            )}
                          </div>
                        ) : null}
                        <div className="pos-inv-summary-row pos-inv-summary-total">
                          <span>Total</span>
                          <span>{fmt(summaryDisplay.total)}</span>
                        </div>
                        {canUpdateInvoice ? (
                          <div className="pos-inv-summary-row">
                            <span className="text-muted">Difference</span>
                            <span
                              className="fw-semibold"
                              style={{
                                color: totalDifference > 0 ? '#2dce89' : totalDifference < 0 ? '#f5365c' : undefined,
                              }}
                            >
                              {formatSignedMoney(totalDifference)}
                            </span>
                          </div>
                        ) : null}
                        {printerSettings.show_payment_made ? (
                          <div className="pos-inv-summary-row pos-inv-payment-made">
                            <span>Payment Made</span>
                            <span>(-) {fmt(summaryDisplay.paymentMade)}</span>
                          </div>
                        ) : null}
                        {printerSettings.show_balance_due ? (
                          <div className="pos-inv-summary-row fw-bold">
                            <span>Balance Due</span>
                            <span>{fmt(summaryDisplay.balanceDue)}</span>
                          </div>
                        ) : null}
                        {printerSettings.show_change_return && sourceOrder ? (
                          <>
                            {sourceOrder.amount_received != null &&
                            sourceOrder.amount_received !== '' ? (
                              <div className="pos-inv-summary-row">
                                <span className="text-muted">Amount received</span>
                                <span>{fmt(sourceOrder.amount_received)}</span>
                              </div>
                            ) : null}
                            {sourceOrder.change_given != null && sourceOrder.change_given !== '' ? (
                              <div className="pos-inv-summary-row">
                                <span className="text-muted">Change return</span>
                                <span>{fmt(sourceOrder.change_given)}</span>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pos-inv-section pos-inv-footer-meta">
                {printerSettings.show_qrcode ? (
                  <div className="mb-4 d-flex flex-column align-items-center text-center">
                    <InvoiceQrCode value={data.publicUrl} size={96} />
                    <small className="text-muted mt-2">Scan invoice QR code</small>
                  </div>
                ) : null}
                <div className="pos-inv-section-title">Terms &amp; conditions</div>
                <ol className="pos-inv-terms-list">
                  {data.termsBody.map((t, i) => (
                    <li key={i} className="mb-1">
                      {t}
                    </li>
                  ))}
                </ol>
                {data.publicUrl ? (
                  <>
                    <div className="pos-inv-section-title mt-3">Public access</div>
                    <div className="d-flex flex-wrap gap-2 align-items-center pos-inv-no-print">
                      <input
                        type="text"
                        className="form-control form-control-sm pos-inv-public-url flex-grow-1"
                        readOnly
                        value={data.publicUrl}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-success text-nowrap"
                        onClick={handleShareWhatsApp}
                        title="Share invoice link on client WhatsApp"
                      >
                        <NavIcon icon={FaWhatsapp} size={14} className="me-1" />
                        Share on WhatsApp
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              {canUpdateInvoice ? (
                <div className="pos-inv-footer pos-inv-no-print">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={invoiceSaving || !invoiceHasSaveableLines}
                    onClick={handleUpdateInvoice}
                    title={
                      !invoiceHasSaveableLines
                        ? 'Add at least one product line'
                        : 'Save invoice changes'
                    }
                  >
                    {invoiceSaving ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-1"
                          role="status"
                          aria-hidden="true"
                        />
                        Updating…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-1" aria-hidden="true" />
                        Update invoice
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {canUpdateInvoice ? (
        <div
          className="modal fade"
          id={INVOICE_ADD_CUSTOMER_MODAL_ID}
          tabIndex="-1"
          aria-labelledby={`${INVOICE_ADD_CUSTOMER_MODAL_ID}Label`}
          aria-hidden="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id={`${INVOICE_ADD_CUSTOMER_MODAL_ID}Label`}>
                  Add customer
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                />
              </div>
              <form onSubmit={handleAddCustomerSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="pos_inv_customer_name" className="form-label">
                      Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="pos_inv_customer_name"
                      name="name"
                      type="text"
                      className={`form-control ${addCustomerErrors.name ? 'is-invalid' : ''}`}
                      value={addCustomerForm.name}
                      onChange={handleAddCustomerFieldChange}
                      autoComplete="name"
                    />
                    {addCustomerErrors.name ? (
                      <div className="invalid-feedback">{addCustomerErrors.name}</div>
                    ) : null}
                  </div>
                  <div className="mb-3">
                    <label htmlFor="pos_inv_customer_phone" className="form-label">
                      Phone <span className="text-danger">*</span>
                    </label>
                    <input
                      id="pos_inv_customer_phone"
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
                    {addCustomerErrors.phone ? (
                      <div className="invalid-feedback">{addCustomerErrors.phone}</div>
                    ) : null}
                  </div>
                  <div className="mb-0">
                    <label htmlFor="pos_inv_customer_email" className="form-label">
                      Email <span className="text-muted font-weight-normal">(optional)</span>
                    </label>
                    <input
                      id="pos_inv_customer_email"
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
                    {addCustomerErrors.email ? (
                      <div className="invalid-feedback d-block">{addCustomerErrors.email}</div>
                    ) : null}
                  </div>
                  {createCustomerError ? (
                    <div className="alert alert-danger text-sm mt-3 mb-0 py-2" role="alert">
                      {createCustomerError}
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn pos-inv-add-customer-btn"
                    disabled={createCustomerSubmitting}
                  >
                    {createCustomerSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Saving…
                      </>
                    ) : (
                      'Add customer'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PosInvoice;
