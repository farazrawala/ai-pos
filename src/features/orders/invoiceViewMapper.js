import { getOrderLineItems } from './ordersAPI.js';
import { buildPublicInvoiceUrl, pickPublicInvoiceToken } from '../../utils/publicInvoiceUrl.js';
import { SHOP_NAME } from '../../config/env.js';

export const DEFAULT_INVOICE_TERMS = [
  'Payment On Receipt',
  'Early payment discounts may apply as per store policy.',
  'Late payments may incur fees after the due date.',
];

export const shopName = SHOP_NAME;

export const formatInvoiceMoney = (n) =>
  `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatInvoiceDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
};

const paymentMethodIdFromOrder = (order) => {
  if (!order || typeof order !== 'object') return '';
  const rawPayAccount = order.payment_method_accounts_id;
  return String(
    (rawPayAccount && typeof rawPayAccount === 'object'
      ? (rawPayAccount._id ?? rawPayAccount.id)
      : rawPayAccount) ??
      order.posPayMethod ??
      order.payment_method_id ??
      order.account_id ??
      ''
  ).trim();
};

const accountLabelFromRef = (ref) => {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return '';
  return String(ref.name ?? ref.accountName ?? ref.account_name ?? '').trim();
};

const COMPANY_DEFAULT_ACCOUNT_LABELS = {
  default_cash_account: 'Cash',
  default_account_receivable_account: 'Accounts Receivable',
  default_account_payable_account: 'Accounts Payable',
  default_withdraw_account: 'Withdraw',
  default_sales_account: 'Sales',
  default_purchase_account: 'Purchase',
  default_expense_account: 'Expense',
  default_adjustment_account: 'Adjustment',
};

function defaultAccountIdFromRef(ref) {
  if (ref == null) return '';
  if (typeof ref === 'object') {
    const id = ref._id ?? ref.id;
    return id != null ? String(id).trim() : '';
  }
  return String(ref).trim();
}

/** Match payment account id to populated company default account fields. */
export function paymentLabelFromCompanyDefaults(order, company) {
  if (!order || !company || typeof company !== 'object') return '';
  const accountId = paymentMethodIdFromOrder(order);
  if (!accountId || !/^[a-f0-9]{24}$/i.test(accountId)) return '';

  for (const [field, label] of Object.entries(COMPANY_DEFAULT_ACCOUNT_LABELS)) {
    if (defaultAccountIdFromRef(company[field]) === accountId) {
      return label;
    }
  }
  return '';
}

/** Human-readable payment method / receive-in account label (never a raw Mongo id). */
export const resolvePaymentMethodLabel = (order, accounts = [], selectedId = '', company = null) => {
  if (order && typeof order === 'object') {
    const fromPayAccount = accountLabelFromRef(order.payment_method_accounts_id);
    if (fromPayAccount) return fromPayAccount;

    const fromPaymentMethod = accountLabelFromRef(order.payment_method);
    if (fromPaymentMethod) return fromPaymentMethod;

    const stringNameFields = [
      order.payment_method_name,
      order.paymentMethodName,
      order.payment_method_account_name,
      order.paymentMethodAccountName,
      order.payment_method_accounts_name,
      order.receive_in_account_name,
      order.pay_method,
    ];
    for (const value of stringNameFields) {
      if (value == null) continue;
      const label = String(value).trim();
      if (label && !/^[a-f0-9]{24}$/i.test(label)) return label;
    }
  }

  const fromCompanyDefaults = paymentLabelFromCompanyDefaults(order, company);
  if (fromCompanyDefaults) return fromCompanyDefaults;

  const id = String(selectedId || paymentMethodIdFromOrder(order)).trim();
  if (id && Array.isArray(accounts) && accounts.length > 0) {
    const match = accounts.find((method) => String(method._id ?? method.id ?? '') === id);
    const name = match?.name ?? match?.accountName ?? match?.account_name;
    if (name != null && String(name).trim() !== '') {
      return String(name).trim();
    }
  }

  if (/^[a-f0-9]{24}$/i.test(id)) return '—';
  return id || '—';
};

/** Map API order payload into the invoice UI shape. */
export function mapOrderToInvoiceView(order, options = {}) {
  const { origin, company = null } = options;
  const empty = {
    shopName,
    invoiceNo: '',
    transactionNumber: '',
    reference: '',
    grossAmount: 0,
    billTo: { name: '—', phone: '—', email: '—' },
    invoiceDate: '—',
    dueDate: '—',
    terms: 'Payment On Receipt',
    lines: [],
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
    paymentStatus: '—',
    paymentMethod: '—',
    note: '',
    authorizedPerson: { name: '—', title: 'Authorized signatory' },
    creditRows: [],
    publicToken: '',
    publicUrl: '',
    termsBody: DEFAULT_INVOICE_TERMS,
  };

  if (!order || typeof order !== 'object') return empty;

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
  const discountPctRaw = order.discount_percentage ?? order.discountPercentage ?? 0;
  const discountPctNum = parseFloat(String(discountPctRaw).replace(/,/g, ''));
  const discountPercentage = Number.isFinite(discountPctNum) ? discountPctNum : 0;
  const shipRaw = order.shipping ?? order.shipment ?? 0;
  const shipNum = parseFloat(String(shipRaw).replace(/,/g, ''));
  const shipping = Number.isFinite(shipNum) ? shipNum : 0;
  const total = Math.max(0, totalBeforeAdjust - discount + shipping);
  const orderId = order._id != null ? order._id : order.id;
  const publicToken = pickPublicInvoiceToken(order);
  const paymentMadeRaw = order.amount_received ?? order.payment_made ?? order.paymentMade ?? 0;
  const paymentMadeNum = parseFloat(String(paymentMadeRaw).replace(/,/g, ''));
  const paymentMade = Number.isFinite(paymentMadeNum) ? paymentMadeNum : 0;

  const transactionNumberRaw =
    order.transaction_number ?? order.transactionNumber ?? order.transaction_no ?? order.transactionNo ?? '';
  const transactionNumber =
    transactionNumberRaw != null && String(transactionNumberRaw).trim() !== ''
      ? String(transactionNumberRaw).trim()
      : '';

  return {
    shopName,
    invoiceNo: order.order_no || order.orderNo || (orderId != null ? String(orderId) : ''),
    transactionNumber,
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
      discountPercentage,
      shipping,
      total,
      paymentMade,
      balanceDue: Math.max(0, total - paymentMade),
    },
    paymentStatus: order.status || order.order_status || '—',
    paymentMethod: resolvePaymentMethodLabel(order, [], '', company),
    note: order.address ? `Address: ${order.address}` : '',
    authorizedPerson: { name: '—', title: 'Authorized signatory' },
    creditRows: [],
    publicToken,
    publicUrl: buildPublicInvoiceUrl(publicToken, origin),
    termsBody: DEFAULT_INVOICE_TERMS,
  };
}
