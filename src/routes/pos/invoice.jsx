import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { openThermalReceiptPrint } from '../../components/ThermalReceiptPrint/index.js';
import {
  fetchOrderForInvoiceRequest,
  getOrderLineItems,
  updatePosOrderRequest,
} from '../../features/orders/ordersAPI.js';
import { fetchProductActiveRequest } from '../../features/products/productsAPI.js';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
} from '../../features/users/usersAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';

/** Demo payload — replace with API data later */
const DEMO_INVOICE = {
  shopName: 'DISCOUNT SHOP',
  invoiceNo: '42693',
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

const fmt = (n) =>
  `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shopName =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SHOP_NAME
    ? String(import.meta.env.VITE_SHOP_NAME)
    : 'Store';

const formatInvoiceDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

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

/** Map API order (`data` payload) into the invoice UI shape used by this page. */
const mapOrderToInvoiceView = (order) => {
  if (!order || typeof order !== 'object') {
    return {
      ...DEMO_INVOICE,
      shopName,
      lines: [],
      creditRows: [],
      termsBody: DEMO_INVOICE.termsBody || [],
    };
  }

  const items = getOrderLineItems(order);
  const lines = [];
  let subTotal = 0;
  let taxTotal = 0;

  items.forEach((line) => {
    if (!line || typeof line !== 'object') return;
    const qtyNum = parseFloat(String(line.qty ?? '0').replace(/,/g, '')) || 0;
    const rate = Number(line.price) || 0;
    const product = line.product_id && typeof line.product_id === 'object' ? line.product_id : null;
    const description = product?.product_name || product?.product_code || line.name || 'Item';
    const unit = product?.unit ? String(product.unit) : '';
    const qtyLabel = unit ? `${line.qty ?? qtyNum} ${unit}`.trim() : String(line.qty ?? qtyNum);
    const taxPct = Number(product?.tax_rate) || 0;
    const lineSub = qtyNum * rate;
    const taxAmount = (lineSub * taxPct) / 100;
    subTotal += lineSub;
    taxTotal += taxAmount;
    lines.push({
      description,
      rate,
      qtyLabel,
      tax: { amount: taxAmount, pct: taxPct },
      discount: { amount: 0, pct: 0 },
      amount: lineSub + taxAmount,
    });
  });

  const totalBeforeAdjust = subTotal + taxTotal;
  const discountRaw = order.discount ?? order.discount_amount ?? 0;
  const discountNum = parseFloat(String(discountRaw).replace(/,/g, ''));
  const discount = Number.isFinite(discountNum) ? discountNum : 0;
  const shipRaw = order.shipping ?? order.shipment ?? 0;
  const shipNum = parseFloat(String(shipRaw).replace(/,/g, ''));
  const shipping = Number.isFinite(shipNum) ? shipNum : 0;
  const total = Math.max(0, totalBeforeAdjust - discount + shipping);
  const orderId = order._id != null ? order._id : order.id;

  const rawPayAccount = order.payment_method_accounts_id;
  const payMethodId = String(
    (rawPayAccount && typeof rawPayAccount === 'object'
      ? rawPayAccount._id ?? rawPayAccount.id
      : rawPayAccount) ??
      order.posPayMethod ??
      order.payment_method_id ??
      order.account_id ??
      ''
  ).trim();
  let paymentMethodLabel = '—';
  if (order.payment_method && typeof order.payment_method === 'object') {
    paymentMethodLabel =
      order.payment_method.name || order.payment_method.accountName || paymentMethodLabel;
  } else if (order.paymentMethodName) {
    paymentMethodLabel = String(order.paymentMethodName);
  } else if (payMethodId) {
    paymentMethodLabel = payMethodId;
  }

  return {
    ...DEMO_INVOICE,
    shopName,
    invoiceNo: order.order_no || order.orderNo || (orderId != null ? String(orderId) : ''),
    reference: orderId != null ? String(orderId) : '',
    grossAmount: total,
    billTo: {
      name: order.name || '—',
      phone: order.phone || '—',
      email: order.email || '—',
    },
    invoiceDate: formatInvoiceDate(order.createdAt),
    dueDate: formatInvoiceDate(order.updatedAt || order.createdAt),
    terms: 'Payment On Receipt',
    lines,
    summary: {
      subTotal,
      tax: taxTotal,
      discount,
      shipping,
      total,
      paymentMade: 0,
      balanceDue: total,
    },
    paymentStatus: order.status || '—',
    paymentMethod: paymentMethodLabel,
    note: order.address ? `Address: ${order.address}` : '',
    authorizedPerson: { name: '—', title: 'Authorized signatory' },
    creditRows: [],
    publicUrl: typeof window !== 'undefined' ? window.location.href : '',
    termsBody: DEMO_INVOICE.termsBody,
  };
};

const PosInvoice = () => {
  const { invoiceId: invoiceIdParam } = useParams();
  const invoiceId = invoiceIdParam ? decodeURIComponent(invoiceIdParam) : '';

  const [view, setView] = useState(() => (invoiceId ? null : { ...DEMO_INVOICE, shopName }));
  const [fetchStatus, setFetchStatus] = useState(() => (invoiceId ? 'loading' : 'succeeded'));
  const [fetchError, setFetchError] = useState(null);
  const [sourceOrder, setSourceOrder] = useState(null);
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
  const [invoiceShippingInput, setInvoiceShippingInput] = useState('');
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('');
  const [invoicePosPayMethod, setInvoicePosPayMethod] = useState('');
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
    const shipRaw = sourceOrder.shipping ?? sourceOrder.shipment ?? 0;
    const s = parseFloat(String(shipRaw).replace(/,/g, ''));
    setInvoiceShippingInput(String(Number.isFinite(s) ? s : 0));
    const cid = sourceOrder.customer_id ?? sourceOrder.customerId ?? '';
    setInvoiceCustomerId(cid != null && String(cid).trim() !== '' ? String(cid).trim() : '');
    const rawPm = sourceOrder.payment_method_accounts_id;
    const pm =
      (rawPm && typeof rawPm === 'object' ? rawPm._id ?? rawPm.id : rawPm) ??
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

    (async () => {
      try {
        const order = await fetchOrderForInvoiceRequest(invoiceId);
        if (cancelled) return;
        setSourceOrder(order);
        setView(mapOrderToInvoiceView(order));
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
  }, [invoiceId]);

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

  const handleThermalPrint = useCallback(() => {
    if (view) {
      openThermalReceiptPrint(view, { documentTitlePrefix: 'Receipt POS' });
    }
  }, [view]);

  const handlePdfPrint = useCallback(() => {
    window.print();
  }, []);

  const buildOrderUpdatePayload = useCallback((order, draftLines = [], orderStatus = null) => {
    if (!order || typeof order !== 'object') {
      return {
        name: '',
        email: '',
        phone: '',
        address: '',
        lines: [],
        discount: 0,
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
      lines,
      discount,
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
      const shipNum = parseFloat(String(invoiceShippingInput).replace(/,/g, ''));
      const discount = Number.isFinite(discNum) ? discNum : 0;
      const shipping = Number.isFinite(shipNum) ? shipNum : 0;
      const customer = invoiceCustomerId
        ? users.find((u) => getUserOptionValue(u) === invoiceCustomerId)
        : null;
      const payload = {
        ...base,
        name: customer?.name || customer?.fullName || customer?.username || base.name,
        email: customer?.email || base.email,
        phone: customer?.mobile || customer?.phone || customer?.phoneNumber || base.phone,
        discount,
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
      setView(mapOrderToInvoiceView(refreshed));
      setInvoiceSaveMessage({ type: 'success', text: 'Invoice updated successfully.' });
    } catch (e) {
      setInvoiceSaveMessage({ type: 'danger', text: e?.message || 'Could not update invoice.' });
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
    invoiceShippingInput,
    invoiceCustomerId,
    invoicePosPayMethod,
    users,
  ]);

  const canUpdateInvoice =
    Boolean(sourceOrder) && (sourceOrder._id != null || sourceOrder.id != null);

  const billToDisplay = useMemo(() => {
    const fallback =
      view?.billTo && typeof view.billTo === 'object' ? view.billTo : DEMO_INVOICE.billTo;
    if (!canUpdateInvoice) return fallback;
    if (!invoiceCustomerId) {
      const o = sourceOrder;
      if (o) {
        return {
          name: o.name || '—',
          phone: o.phone || '—',
          email: o.email || '—',
        };
      }
      return fallback;
    }
    const u = users.find((row) => getUserOptionValue(row) === invoiceCustomerId);
    if (!u) return fallback;
    return {
      name: u.name || u.fullName || u.username || fallback.name,
      phone: u.mobile || u.phone || u.phoneNumber || fallback.phone,
      email: u.email || fallback.email,
    };
  }, [canUpdateInvoice, invoiceCustomerId, users, sourceOrder, view]);

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

  const liveSummaryFromDraft = useMemo(() => {
    const hasOrder =
      sourceOrder &&
      typeof sourceOrder === 'object' &&
      (sourceOrder._id != null || sourceOrder.id != null);
    if (!hasOrder || !view?.summary) return null;
    let subTotal = 0;
    let taxTotal = 0;
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
    });
    const totalBeforeAdjust = subTotal + taxTotal;
    const discountParsed = parseFloat(String(invoiceDiscountInput).replace(/,/g, ''));
    const discount = Number.isFinite(discountParsed)
      ? discountParsed
      : Number(view.summary.discount) || 0;
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
      shipping,
      total,
      paymentMade,
      balanceDue: Math.max(0, total - paymentMade),
    };
  }, [sourceOrder, invoiceDraftLines, view, invoiceDiscountInput, invoiceShippingInput]);

  const summaryDisplay = liveSummaryFromDraft ?? data.summary;
  const grossDisplay = liveSummaryFromDraft != null ? liveSummaryFromDraft.total : data.grossAmount;

  if (fetchStatus === 'loading') {
    return (
      <div className="container-fluid py-5 px-3 text-center">
        <div className="spinner-border text-primary" role="status" aria-label="Loading" />
        <p className="mt-3 text-muted mb-3">Loading invoice…</p>
        <Link to="/pos" className="btn btn-sm btn-outline-secondary">
          <i className="fas fa-arrow-left me-1"></i> Back to POS
        </Link>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4 px-3">
        <Link to="/pos" className="btn btn-sm btn-outline-secondary mb-3">
          <i className="fas fa-arrow-left me-1"></i> Back to POS
        </Link>
        <div className="alert alert-danger mb-0" role="alert">
          {fetchError || 'Could not load this invoice.'}
        </div>
      </div>
    );
  }

  return (
    <div className="pos-invoice-page container-fluid py-3 px-2 px-lg-4">
      <style>{`
        .pos-invoice-page {
          font-family: 'Open Sans', 'Segoe UI', system-ui, sans-serif;
          max-width: 1100px;
          margin: 0 auto;
        }
        .pos-inv-actions {
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .pos-inv-actions .btn {
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.8rem;
          padding: 0.45rem 0.85rem;
        }
        .pos-inv-btn-blue { background: #5e72e4; border-color: #5e72e4; color: #fff; }
        .pos-inv-btn-blue:hover { background: #4c63d2; border-color: #4c63d2; color: #fff; }
        .pos-inv-btn-orange { background: #fb6340; border-color: #fb6340; color: #fff; }
        .pos-inv-btn-orange:hover { background: #ea4c2a; border-color: #ea4c2a; color: #fff; }
        .pos-inv-btn-cyan { background: #11cdef; border-color: #11cdef; color: #fff; }
        .pos-inv-btn-cyan:hover { background: #0eb8d6; border-color: #0eb8d6; color: #fff; }
        .pos-inv-btn-navy { background: #344767; border-color: #344767; color: #fff; }
        .pos-inv-btn-navy:hover { background: #2a3a54; border-color: #2a3a54; color: #fff; }
        .pos-inv-btn-sms { background: #4299e1; border-color: #4299e1; color: #fff; }
        .pos-inv-btn-sms:hover { background: #3182ce; border-color: #3182ce; color: #fff; }
        .pos-inv-btn-green { background: #2dce89; border-color: #2dce89; color: #fff; }
        .pos-inv-btn-green:hover { background: #26b87a; border-color: #26b87a; color: #fff; }
        .pos-inv-btn-grey { background: #8898aa; border-color: #8898aa; color: #fff; }
        .pos-inv-btn-grey:hover { background: #768696; border-color: #768696; color: #fff; }
        .pos-inv-btn-pink { background: #f5365c; border-color: #f5365c; color: #fff; }
        .pos-inv-btn-pink:hover { background: #e01e4a; border-color: #e01e4a; color: #fff; }
        .pos-inv-btn-teal { background: #17a2b8; border-color: #17a2b8; color: #fff; }
        .pos-inv-btn-teal:hover { background: #138496; border-color: #138496; color: #fff; }
        .pos-inv-paper {
          background: #fff;
          border: 1px solid #e9ecef;
          border-radius: 0.5rem;
          box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,.06);
        }
        .pos-inv-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #212529;
        }
        .pos-inv-gross {
          font-size: 1.1rem;
          font-weight: 700;
        }
        .pos-inv-client-name {
          color: #11cdef;
          font-weight: 700;
        }
        .pos-inv-underline {
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .pos-inv-table th {
          background: #f8f9fa;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #495057;
          border-color: #dee2e6 !important;
        }
        .pos-inv-table td {
          border-color: #dee2e6 !important;
          vertical-align: middle;
          font-size: 0.875rem;
        }
        .pos-inv-summary-row {
          display: flex;
          justify-content: space-between;
          padding: 0.25rem 0;
          font-size: 0.9rem;
        }
        .pos-inv-summary-total {
          font-weight: 700;
          border-top: 1px solid #dee2e6;
          margin-top: 0.35rem;
          padding-top: 0.5rem;
        }
        .pos-inv-payment-made {
          color: #dc3545;
          font-weight: 600;
        }
        .pos-inv-sig-box {
          width: 140px;
          height: 56px;
          border: 2px dashed #ced4da;
          border-radius: 0.25rem;
          background: #fafafa;
        }
        .pos-inv-file-btn {
          background: #11cdef;
          border: none;
          color: #fff;
          font-weight: 600;
          padding: 0.65rem 1.25rem;
          border-radius: 0.375rem;
        }
        .pos-inv-file-btn:hover {
          background: #0eb8d6;
          color: #fff;
        }
        @media print {
          .pos-inv-no-print {
            display: none !important;
          }
          .pos-invoice-page {
            max-width: 100%;
          }
          .pos-inv-paper {
            box-shadow: none;
            border: none;
          }
        }
      `}</style>

      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pos-inv-no-print">
        <Link to="/pos" className="btn btn-sm btn-outline-secondary">
          <i className="fas fa-arrow-left me-1"></i> Back to POS
        </Link>
      </div>

      {invoiceSaveMessage.type && invoiceSaveMessage.text ? (
        <div
          className={`alert alert-${invoiceSaveMessage.type === 'success' ? 'success' : 'danger'} py-2 px-3 mb-3 pos-inv-no-print`}
          role="alert"
        >
          {invoiceSaveMessage.text}
        </div>
      ) : null}

      {/* Top action bar */}
      <div className="d-flex pos-inv-actions mb-4 pos-inv-no-print">
        <div className="dropdown">
          <button
            className="btn pos-inv-btn-blue dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            POS Print
          </button>
          <ul className="dropdown-menu shadow-sm">
            <li>
              <button type="button" className="dropdown-item" onClick={handlePdfPrint}>
                PDF Print
              </button>
            </li>
            <li>
              <button type="button" className="dropdown-item" onClick={handleThermalPrint}>
                Thermal Print
              </button>
            </li>
          </ul>
        </div>
        <button
          type="button"
          className="btn pos-inv-btn-orange"
          disabled={!canUpdateInvoice || invoiceSaving || !invoiceHasSaveableLines}
          onClick={handleUpdateInvoice}
          title={
            !canUpdateInvoice
              ? 'Load an order from the URL first'
              : !invoiceHasSaveableLines
                ? 'Add at least one product line'
                : 'PATCH invoice to server'
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
              <i className="fas fa-save me-1"></i> Update invoice
            </>
          )}
        </button>
        <button type="button" className="btn pos-inv-btn-cyan">
          <i className="fas fa-money-bill-wave me-1"></i> Make Payment
        </button>
        <div className="dropdown">
          <button
            className="btn pos-inv-btn-navy dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="fas fa-envelope me-1"></i> Email
          </button>
          <ul className="dropdown-menu shadow-sm">
            <li>
              <button type="button" className="dropdown-item">
                Send to customer
              </button>
            </li>
          </ul>
        </div>
        <div className="dropdown">
          <button
            className="btn pos-inv-btn-sms dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="fas fa-mobile-alt me-1"></i> SMS
          </button>
          <ul className="dropdown-menu shadow-sm">
            <li>
              <button type="button" className="dropdown-item">
                Send SMS
              </button>
            </li>
          </ul>
        </div>
        <div className="dropdown">
          <button
            className="btn pos-inv-btn-green dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="fas fa-print me-1"></i> Print
          </button>
          <ul className="dropdown-menu shadow-sm">
            <li>
              <button type="button" className="dropdown-item">
                A4
              </button>
            </li>
          </ul>
        </div>
        <button type="button" className="btn pos-inv-btn-grey">
          <i className="fas fa-eye me-1"></i> Preview
        </button>
        <button type="button" className="btn pos-inv-btn-cyan">
          <i className="fas fa-sync-alt me-1"></i> Change Status
        </button>
        <button type="button" className="btn pos-inv-btn-pink">
          <i className="fas fa-times me-1"></i> Cancel
        </button>
        <div className="dropdown">
          <button
            className="btn pos-inv-btn-teal dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="fas fa-plus me-1"></i> Extra
          </button>
          <ul className="dropdown-menu shadow-sm">
            <li>
              <button type="button" className="dropdown-item">
                Add note
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="pos-inv-paper p-4 p-md-5 mb-4">
        {/* Header */}
        <div className="row align-items-start mb-4 pb-3 border-bottom">
          <div className="col-md-6 mb-3 mb-md-0">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded border bg-light d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 72, height: 72 }}
              >
                <span className="text-muted small text-center px-1">LOGO</span>
              </div>
              <div>
                <div
                  className="fw-bold text-uppercase text-secondary"
                  style={{ fontSize: '0.75rem' }}
                >
                  {data.shopName}
                </div>
                <div className="h5 mb-0 fw-semibold">{data.shopName}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6 text-md-end">
            <div className="pos-inv-title mb-2">INVOICE</div>
            <div className="mb-1">
              <span className="text-muted">POS# </span>
              <span className="fw-bold">{data.invoiceNo}</span>
            </div>
            <div className="small text-muted mb-2">Reference: {data.reference || '—'}</div>
            <div className="pos-inv-gross">Gross Amount: {fmt(grossDisplay)}</div>
          </div>
        </div>

        {/* Bill to + dates */}
        <div className="row mb-4">
          <div className="col-md-6 mb-3 mb-md-0">
            <div className="text-uppercase text-muted small fw-bold mb-2">Bill To</div>
            {canUpdateInvoice ? (
              <div className="pos-inv-no-print mb-3">
                <label className="form-label small text-muted mb-1" htmlFor="posInvCustomer">
                  Customer
                </label>
                <select
                  id="posInvCustomer"
                  className="form-select form-select-sm"
                  value={invoiceCustomerId}
                  onChange={(e) => setInvoiceCustomerId(e.target.value)}
                  disabled={usersStatus === 'loading'}
                >
                  <option value="">Walk In (no customer)</option>
                  {users
                    .filter((u) => getUserOptionValue(u))
                    .map((u) => {
                      const v = getUserOptionValue(u);
                      return (
                        <option key={v} value={v}>
                          {formatUserOptionLabel(u)}
                        </option>
                      );
                    })}
                </select>
                {usersError ? (
                  <div className="small text-danger mt-1">{usersError}</div>
                ) : null}
              </div>
            ) : null}
            <div className="pos-inv-client-name mb-1">{billToDisplay.name}</div>
            <div className="small text-secondary">{billToDisplay.phone}</div>
            <div className="small text-secondary">{billToDisplay.email}</div>
          </div>
          <div className="col-md-6 text-md-end">
            <div className="small mb-2">
              <span className="text-muted me-2">Invoice Date:</span>
              <span className="fw-semibold">{data.invoiceDate}</span>
            </div>
            <div className="small mb-2">
              <span className="text-muted me-2">Due Date:</span>
              <span className="fw-semibold">{data.dueDate}</span>
            </div>
            <div className="small">
              <span className="text-muted me-2">Terms:</span>
              <span className="fw-semibold">{data.terms}</span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="table-responsive mb-4">
          {canUpdateInvoice && (
            <>
              <p className="small text-muted mb-2 pos-inv-no-print">
                Edit <strong>Qty</strong> and <strong>Rate</strong>, add or remove lines, then use{' '}
                <strong>Update invoice</strong> to save.
              </p>
              <div className="mb-3 pos-inv-no-print">
                <label className="form-label small text-muted mb-1" htmlFor="pos-inv-order-status">
                  Order status
                </label>
                <select
                  id="pos-inv-order-status"
                  className="form-select form-select-sm"
                  style={{ maxWidth: '280px' }}
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
              <div className="mb-3 position-relative pos-inv-no-print">
                <label className="form-label small text-muted mb-1" htmlFor="pos-inv-add-product">
                  Add product
                </label>
                <input
                  id="pos-inv-add-product"
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search name, SKU, or barcode (min. 2 characters)…"
                  value={addProductQuery}
                  onChange={(e) => setAddProductQuery(e.target.value)}
                  autoComplete="off"
                />
                {addProductLoading ? <div className="small text-muted mt-1">Searching…</div> : null}
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
            </>
          )}
          <table className="table table-bordered pos-inv-table mb-0">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>Description</th>
                <th className="text-end" style={{ width: '120px' }}>
                  Rate
                </th>
                <th className="text-end" style={{ width: '120px' }}>
                  Qty
                </th>
                <th className="text-end" style={{ width: '120px' }}>
                  Amount
                </th>
                {canUpdateInvoice ? (
                  <th className="text-center pos-inv-no-print" style={{ width: '72px' }}>
                    {' '}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {canUpdateInvoice ? (
                invoiceDraftLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No line items. Use <strong>Add product</strong> above to add rows.
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
                        <td className="text-center">{i + 1}</td>
                        <td>
                          <div>{row.label}</div>
                          {!String(row.productId || '').trim() ? (
                            <div className="small text-warning">
                              Missing product id — remove or fix.
                            </div>
                          ) : null}
                        </td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            aria-label={`Rate for line ${i + 1}`}
                            value={row.rate}
                            onChange={(e) => handleDraftLineEdit(row.key, 'rate', e.target.value)}
                          />
                        </td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            aria-label={`Quantity for line ${i + 1}`}
                            value={row.qty}
                            onChange={(e) => handleDraftLineEdit(row.key, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="text-end fw-semibold align-middle">{fmt(amount)}</td>
                        <td className="text-center align-middle pos-inv-no-print">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            aria-label={`Remove line ${i + 1}`}
                            onClick={() => removeDraftLine(row.key)}
                          >
                            <i className="fas fa-trash-alt" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                data.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{line.description}</td>
                    <td className="text-end">{fmt(line.rate)}</td>
                    <td className="text-end">{line.qtyLabel}</td>
                    <td className="text-end fw-semibold">{fmt(line.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Payment + summary */}
        <div className="row mb-4">
          <div className="col-md-6 mb-4 mb-md-0">
            {/* <div className="small mb-2">
              <span className="text-muted">Payment Status: </span>
              <span className="pos-inv-underline fw-semibold">{data.paymentStatus}</span>
            </div> */}
            {canUpdateInvoice ? (
              <div className="mb-3 pos-inv-no-print">
                <label className="form-label small text-muted mb-1" htmlFor="posInvReceiveAccount">
                  Receive in account
                </label>
                <select
                  id="posInvReceiveAccount"
                  className="form-select form-select-sm"
                  value={invoicePosPayMethod}
                  onChange={(e) => setInvoicePosPayMethod(e.target.value)}
                  disabled={paymentMethodsStatus === 'loading' || paymentMethods.length === 0}
                >
                  <option value="">— Select account —</option>
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
            <div className="small mb-3">
              <span className="text-muted">Payment Method: </span>
              <span className="pos-inv-underline fw-semibold">{data.paymentMethod}</span>
            </div>
            <label className="form-label small text-muted mb-1">Note</label>
            <textarea
              className="form-control form-control-sm"
              rows={4}
              placeholder="Add a note…"
              defaultValue={data.note}
              readOnly
            />
          </div>
          <div className="col-md-6">
            <div className="text-uppercase text-muted small fw-bold mb-2">Summary</div>
            <div className="border rounded p-3 bg-light">
              <div className="pos-inv-summary-row">
                <span className="text-muted">Sub Total</span>
                <span className="fw-semibold">{fmt(summaryDisplay.subTotal)}</span>
              </div>
              <div className="pos-inv-summary-row">
                <span className="text-muted">Tax</span>
                <span>{fmt(summaryDisplay.tax)}</span>
              </div>
              <div className="pos-inv-summary-row align-items-center">
                <span className="text-muted">Discount</span>
                {canUpdateInvoice ? (
                  <>
                    <input
                      type="text"
                      className="form-control form-control-sm text-end pos-inv-no-print"
                      style={{ maxWidth: 140 }}
                      inputMode="decimal"
                      value={invoiceDiscountInput}
                      onChange={(e) => setInvoiceDiscountInput(e.target.value)}
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
              <div className="pos-inv-summary-row align-items-center">
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
              <div className="pos-inv-summary-row pos-inv-summary-total">
                <span>Total</span>
                <span>{fmt(summaryDisplay.total)}</span>
              </div>
              <div className="pos-inv-summary-row pos-inv-payment-made">
                <span>Payment Made</span>
                <span>(-) {fmt(summaryDisplay.paymentMade)}</span>
              </div>
              <div className="pos-inv-summary-row fw-bold">
                <span>Balance Due</span>
                <span>{fmt(summaryDisplay.balanceDue)}</span>
              </div>
            </div>
            {/* <div className="mt-4 text-md-end">
              <div className="small text-muted mb-1">Authorized Person</div>
              <div className="d-inline-flex flex-column align-items-md-end align-items-start">
                <div className="pos-inv-sig-box mb-2 align-self-md-end" aria-hidden="true" />
                <div className="fw-semibold">{data.authorizedPerson.name}</div>
                <div className="small text-muted">{data.authorizedPerson.title}</div>
              </div>
            </div> */}
          </div>
        </div>

        {/* Footer */}
        <div className="border-top pt-4">
          <div className="fw-semibold mb-2">Terms &amp; Condition</div>
          <ol className="small text-secondary ps-3 mb-4">
            {data.termsBody.map((t, i) => (
              <li key={i} className="mb-1">
                {t}
              </li>
            ))}
          </ol>
          <div className="mb-2 small text-muted">Public Access URL</div>
          <input
            type="text"
            className="form-control form-control-sm mb-4 font-monospace"
            readOnly
            value={data.publicUrl}
          />
          <div className="fw-semibold mb-2">Files</div>
          {/* <p className="small text-muted mb-2">
            Allowed: PDF, JPG, PNG, DOC, DOCX (max 10MB each — adjust as needed)
          </p>
          <label
            htmlFor="pos-inv-files"
            className="pos-inv-file-btn d-inline-block mb-0"
            style={{ cursor: 'pointer' }}
          >
            <i className="fas fa-folder-open me-2"></i>
            Select files…
          </label> */}
          <input
            id="pos-inv-files"
            type="file"
            className="d-none"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </div>

        <div className="border-top pt-4 mt-3 pos-inv-no-print d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3">
          <p className="small text-muted mb-0">
            Push the latest customer details to the server for this order.
          </p>
          <button
            type="button"
            className="btn pos-inv-btn-orange align-self-stretch align-self-md-center"
            style={{ minWidth: '200px' }}
            disabled={!canUpdateInvoice || invoiceSaving || !invoiceHasSaveableLines}
            onClick={handleUpdateInvoice}
          >
            {invoiceSaving ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
                Updating…
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt me-2"></i>
                Update invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosInvoice;
