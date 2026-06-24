import moment from 'moment';
import { getOrderLineItems } from './ordersAPI.js';
import { resolvePaymentMethodLabel } from './invoiceViewMapper.js';

const parseMoney = (value) => {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getLineProduct = (line) => {
  const product = line.product_id && typeof line.product_id === 'object' ? line.product_id : null;
  return {
    code: product?.product_code || product?.sku || line.product_code || line.sku || '',
    name: product?.product_name || line.name || line.product_name || '',
    unit: product?.unit || line.unit || '',
  };
};

const orderStatus = (order) => {
  const v = order?.order_status ?? order?.orderStatus ?? order?.status;
  return v == null ? '' : String(v).trim();
};

/** @returns {{ subtotal: number, discount: number, shipping: number, orderTotal: number, amountReceived: number, changeGiven: number, remaining: number }} */
export const computeOrderFinancials = (order, lineItems) => {
  let subtotal = 0;
  lineItems.forEach((line) => {
    if (!line || typeof line !== 'object') return;
    subtotal += parseMoney(line.qty) * parseMoney(line.price ?? line.rate);
  });

  const discount = parseMoney(order?.discount ?? order?.discount_amount);
  const shipping = parseMoney(order?.shipping ?? order?.shipment);

  let orderTotal = parseMoney(
    order?.order_items_total ??
      order?.orderItemsTotal ??
      order?.items_total ??
      order?.itemsTotal ??
      order?.total ??
      order?.grand_total
  );
  if (!orderTotal && (subtotal || discount || shipping)) {
    orderTotal = Math.max(0, subtotal - discount + shipping);
  }
  if (!orderTotal && subtotal) orderTotal = subtotal;

  const amountReceived = parseMoney(
    order?.amount_received ?? order?.payment_made ?? order?.paymentMade
  );
  const changeGiven = parseMoney(order?.change_given ?? order?.changeGiven);
  const remaining = Math.max(0, orderTotal - amountReceived);

  return { subtotal, discount, shipping, orderTotal, amountReceived, changeGiven, remaining };
};

export const ORDER_DETAIL_EXPORT_COLUMNS = [
  { key: 'sr', label: '#' },
  { key: 'orderNo', label: 'Order no' },
  { key: 'customer', label: 'Customer' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'status', label: 'Status' },
  { key: 'paymentMethod', label: 'Payment method' },
  { key: 'created', label: 'Created' },
  { key: 'subtotal', label: 'Subtotal (PKR)' },
  { key: 'discount', label: 'Discount (PKR)' },
  { key: 'shipping', label: 'Shipping (PKR)' },
  { key: 'orderTotal', label: 'Order total (PKR)' },
  { key: 'amountReceived', label: 'Amount received (PKR)' },
  { key: 'remaining', label: 'Remaining (PKR)' },
  { key: 'changeGiven', label: 'Change given (PKR)' },
  { key: 'lineNo', label: 'Line #' },
  { key: 'productCode', label: 'Product code' },
  { key: 'productName', label: 'Product name' },
  { key: 'qty', label: 'Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'unitPrice', label: 'Unit price (PKR)' },
  { key: 'lineTotal', label: 'Line total (PKR)' },
];

const buildOrderHeaderFields = (order, financials) => {
  const created = order.createdAt ?? order.created_at;
  return {
    orderNo: order.order_no || order.orderNo || '',
    customer: order.name || '',
    email: order.email || '',
    phone: order.phone || '',
    address: order.address || '',
    status: orderStatus(order),
    paymentMethod: resolvePaymentMethodLabel(order, [], '', null),
    created: created ? moment(created).format('DD MMM YYYY h:mm a') : '',
    subtotal: formatMoney(financials.subtotal),
    discount: formatMoney(financials.discount),
    shipping: formatMoney(financials.shipping),
    orderTotal: formatMoney(financials.orderTotal),
    amountReceived: formatMoney(financials.amountReceived),
    remaining: formatMoney(financials.remaining),
    changeGiven: financials.changeGiven ? formatMoney(financials.changeGiven) : '',
  };
};

/** One export row per order line (order header fields repeat on each line). */
export function mapOrdersToDetailExportRows(orders) {
  const rows = [];
  let sr = 0;

  orders.forEach((order) => {
    const lineItems = getOrderLineItems(order);
    const financials = computeOrderFinancials(order, lineItems);
    const header = buildOrderHeaderFields(order, financials);

    if (!lineItems.length) {
      rows.push({
        ...header,
        sr: ++sr,
        lineNo: '',
        productCode: '',
        productName: '',
        qty: '',
        unit: '',
        unitPrice: '',
        lineTotal: '',
      });
      return;
    }

    lineItems.forEach((line, lineIndex) => {
      if (!line || typeof line !== 'object') return;
      const { code, name, unit } = getLineProduct(line);
      const qty = parseMoney(line.qty);
      const price = parseMoney(line.price ?? line.rate);

      rows.push({
        ...header,
        sr: ++sr,
        lineNo: lineIndex + 1,
        productCode: code,
        productName: name,
        qty: qty || '',
        unit,
        unitPrice: formatMoney(price),
        lineTotal: formatMoney(qty * price),
      });
    });
  });

  return rows;
}
