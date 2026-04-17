import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { openThermalReceiptPrint } from '../../components/ThermalReceiptPrint/index.js';
import {
  fetchOrderForInvoiceRequest,
  getOrderLineItems,
  updatePosOrderRequest,
} from '../../features/orders/ordersAPI.js';

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
    subTotal: 922.5,
    tax: 0,
    discount: 0,
    shipping: 0,
    total: 922.5,
    paymentMade: 922.5,
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

  const total = subTotal + taxTotal;
  const orderId = order._id != null ? order._id : order.id;

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
      discount: 0,
      shipping: 0,
      total,
      paymentMade: 0,
      balanceDue: total,
    },
    paymentStatus: order.status || '—',
    paymentMethod: '—',
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
  /** Editable qty / rate (price) per API line item, aligned with `getOrderLineItems(sourceOrder)` */
  const [invoiceLineEdits, setInvoiceLineEdits] = useState([]);

  useLayoutEffect(() => {
    if (!sourceOrder) {
      setInvoiceLineEdits([]);
      return;
    }
    const items = getOrderLineItems(sourceOrder);
    setInvoiceLineEdits(
      items.map((line) => {
        const qty = parseFloat(String(line.qty ?? line.quantity ?? '0').replace(/,/g, ''));
        const rate = parseFloat(String(line.price ?? line.unit_price ?? '0').replace(/,/g, ''));
        return {
          qty: Number.isFinite(qty) ? String(qty) : '0',
          rate: Number.isFinite(rate) ? String(rate) : '0',
        };
      })
    );
  }, [sourceOrder]);

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

  const buildOrderUpdatePayload = useCallback((order, lineEdits = []) => {
    if (!order || typeof order !== 'object') {
      return {
        name: '',
        email: '',
        phone: '',
        address: '',
        lines: [],
        discount: 0,
        order_status: 'active',
        amount_received: '',
        change_given: '',
      };
    }
    const items = getOrderLineItems(order);
    const lines = items
      .map((line, idx) => {
        const productId = lineProductIdFromOrderLine(line);
        const edit = lineEdits[idx];
        let qty;
        let price;
        if (edit != null) {
          const qtyNum = parseFloat(String(edit.qty ?? '0').replace(/,/g, ''));
          const rateNum = parseFloat(String(edit.rate ?? '0').replace(/,/g, ''));
          qty = Number.isFinite(qtyNum) ? qtyNum : 0;
          price = Number.isFinite(rateNum) ? rateNum : 0;
        } else {
          const qtyRaw = line.qty ?? line.quantity;
          const qtyNum = parseFloat(String(qtyRaw ?? '0').replace(/,/g, ''));
          qty = Number.isFinite(qtyNum) ? qtyNum : 0;
          const priceNum = parseFloat(
            String(line.price ?? line.unit_price ?? '0').replace(/,/g, '')
          );
          price = Number.isFinite(priceNum) ? priceNum : 0;
        }
        return { productId, qty, price };
      })
      .filter((l) => l.productId);

    const discountRaw = order.discount ?? order.discount_amount ?? 0;
    const discountNum = parseFloat(String(discountRaw).replace(/,/g, ''));
    const discount = Number.isFinite(discountNum) ? discountNum : 0;

    const order_status =
      order.order_status ?? order.orderStatus ?? order.status ?? 'active';

    const amount_received =
      order.amount_received != null && order.amount_received !== ''
        ? order.amount_received
        : '';
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
    setInvoiceSaving(true);
    setInvoiceSaveMessage({ type: null, text: '' });
    try {
      const payload = buildOrderUpdatePayload(sourceOrder, invoiceLineEdits);
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
  }, [sourceOrder, buildOrderUpdatePayload, invoiceId, invoiceLineEdits]);

  const canUpdateInvoice =
    Boolean(sourceOrder) && (sourceOrder._id != null || sourceOrder.id != null);

  const handleInvoiceLineEdit = useCallback((index, field, rawValue) => {
    setInvoiceLineEdits((prev) => {
      const next = [...prev];
      if (!next[index]) next[index] = { qty: '0', rate: '0' };
      next[index] = { ...next[index], [field]: rawValue };
      return next;
    });
  }, []);

  const liveSummaryFromEdits = useMemo(() => {
    if (!sourceOrder || !view?.summary || invoiceLineEdits.length === 0) return null;
    const items = getOrderLineItems(sourceOrder);
    if (items.length !== invoiceLineEdits.length) return null;
    let subTotal = 0;
    let taxTotal = 0;
    items.forEach((line, i) => {
      const edit = invoiceLineEdits[i];
      const qtyNum = parseFloat(String(edit?.qty ?? '0').replace(/,/g, ''));
      const rateNum = parseFloat(String(edit?.rate ?? '0').replace(/,/g, ''));
      const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
      const rate = Number.isFinite(rateNum) ? rateNum : 0;
      const product = line.product_id && typeof line.product_id === 'object' ? line.product_id : null;
      const taxPct = Number(product?.tax_rate) || 0;
      const lineSub = qty * rate;
      const taxAmount = (lineSub * taxPct) / 100;
      subTotal += lineSub;
      taxTotal += taxAmount;
    });
    const total = subTotal + taxTotal;
    const paymentMade = Number(view.summary.paymentMade) || 0;
    const discount = Number(view.summary.discount) || 0;
    const shipping = Number(view.summary.shipping) || 0;
    return {
      subTotal,
      tax: taxTotal,
      discount,
      shipping,
      total,
      paymentMade,
      balanceDue: Math.max(0, total - paymentMade),
    };
  }, [sourceOrder, invoiceLineEdits, view]);

  const summaryDisplay = liveSummaryFromEdits || data.summary;
  const grossDisplay = liveSummaryFromEdits ? liveSummaryFromEdits.total : data.grossAmount;

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
          disabled={!canUpdateInvoice || invoiceSaving}
          onClick={handleUpdateInvoice}
          title={canUpdateInvoice ? 'PATCH invoice to server' : 'Load an order from the URL first'}
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
            <div className="pos-inv-client-name mb-1">{data.billTo.name}</div>
            <div className="small text-secondary">{data.billTo.phone}</div>
            <div className="small text-secondary">{data.billTo.email}</div>
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
          {canUpdateInvoice && invoiceLineEdits.length > 0 && (
            <p className="small text-muted mb-2 pos-inv-no-print">
              Edit <strong>Qty</strong> and <strong>Rate</strong> below, then use <strong>Update invoice</strong> to save.
            </p>
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
              </tr>
            </thead>
            <tbody>
              {canUpdateInvoice && invoiceLineEdits.length > 0
                ? getOrderLineItems(sourceOrder).map((line, i) => {
                    const edit = invoiceLineEdits[i] || { qty: '0', rate: '0' };
                    const qtyNum = parseFloat(String(edit.qty ?? '0').replace(/,/g, ''));
                    const rateNum = parseFloat(String(edit.rate ?? '0').replace(/,/g, ''));
                    const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
                    const rate = Number.isFinite(rateNum) ? rateNum : 0;
                    const product =
                      line.product_id && typeof line.product_id === 'object' ? line.product_id : null;
                    const taxPct = Number(product?.tax_rate) || 0;
                    const lineSub = qty * rate;
                    const taxAmount = (lineSub * taxPct) / 100;
                    const amount = lineSub + taxAmount;
                    const rowKey = line._id ?? line.id ?? i;
                    return (
                      <tr key={rowKey}>
                        <td className="text-center">{i + 1}</td>
                        <td>{describeOrderLineItem(line)}</td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            aria-label={`Rate for line ${i + 1}`}
                            value={edit.rate}
                            onChange={(e) => handleInvoiceLineEdit(i, 'rate', e.target.value)}
                          />
                        </td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            aria-label={`Quantity for line ${i + 1}`}
                            value={edit.qty}
                            onChange={(e) => handleInvoiceLineEdit(i, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="text-end fw-semibold align-middle">{fmt(amount)}</td>
                      </tr>
                    );
                  })
                : data.lines.map((line, i) => (
                    <tr key={i}>
                      <td className="text-center">{i + 1}</td>
                      <td>{line.description}</td>
                      <td className="text-end">{fmt(line.rate)}</td>
                      <td className="text-end">{line.qtyLabel}</td>
                      <td className="text-end fw-semibold">{fmt(line.amount)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Payment + summary */}
        <div className="row mb-4">
          <div className="col-md-6 mb-4 mb-md-0">
            <div className="small mb-2">
              <span className="text-muted">Payment Status: </span>
              <span className="pos-inv-underline fw-semibold">{data.paymentStatus}</span>
            </div>
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
              <div className="pos-inv-summary-row">
                <span className="text-muted">Discount</span>
                <span>{fmt(summaryDisplay.discount)}</span>
              </div>
              <div className="pos-inv-summary-row">
                <span className="text-muted">Shipping</span>
                <span>{fmt(summaryDisplay.shipping)}</span>
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

        {/* Credit transactions */}
        <div className="mb-4">
          <div className="fw-semibold mb-2">Credit Transactions:</div>
          {Array.isArray(data.creditRows) && data.creditRows.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-bordered pos-inv-table mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}></th>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-end">Debit</th>
                    <th className="text-end">Credit</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.creditRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <button type="button" className="btn btn-sm btn-primary py-0 px-2">
                          Print
                        </button>
                      </td>
                      <td>{row.date}</td>
                      <td>{row.method}</td>
                      <td className="text-end">{fmt(row.debit)}</td>
                      <td className="text-end">{fmt(row.credit)}</td>
                      <td className="small">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small text-muted mb-0">No credit transactions.</p>
          )}
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
            disabled={!canUpdateInvoice || invoiceSaving}
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
