import moment from 'moment';

export const parseMoney = (value) => {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const formatMoney = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCreated = (record) => {
  const created = record?.createdAt ?? record?.created_at;
  return created ? moment(created).format('DD MMM YYYY h:mm a') : '';
};

export function getDocumentLineItems(record, itemKeys) {
  if (!record || typeof record !== 'object') return [];
  for (const key of itemKeys) {
    let v = record[key];
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) v = parsed;
      } catch {
        /* ignore */
      }
    }
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const vals = Object.values(v);
      if (vals.every((el) => el != null && typeof el === 'object')) return vals;
    }
  }
  return [];
}

export const getLineProduct = (line) => {
  const product =
    line?.product && typeof line.product === 'object'
      ? line.product
      : line?.product_id && typeof line.product_id === 'object'
        ? line.product_id
        : null;
  return {
    code: product?.product_code || product?.sku || line?.product_code || line?.sku || '',
    name:
      product?.product_name ||
      product?.name ||
      line?.name ||
      line?.product_name ||
      line?.label ||
      '',
    unit: product?.unit || line?.unit || '',
  };
};

export function computeDocumentFinancials(record, lineItems) {
  let subtotal = 0;
  lineItems.forEach((line) => {
    if (!line || typeof line !== 'object') return;
    const qty = parseMoney(line.qty ?? line.quantity ?? line.qty_ordered);
    const price = parseMoney(line.price ?? line.rate ?? line.unit_price ?? line.amount);
    if (qty && price) subtotal += qty * price;
    else if (line.amount != null) subtotal += parseMoney(line.amount);
  });

  const discount = parseMoney(record?.discount ?? record?.discount_amount);
  const shipping = parseMoney(record?.shipment ?? record?.shipping);
  let total = parseMoney(
    record?.total_amount ?? record?.total ?? record?.grand_total ?? record?.order_total
  );
  if (!total && (subtotal || discount || shipping)) {
    total = Math.max(0, subtotal + shipping - discount);
  }
  if (!total && subtotal) total = subtotal;

  const amountPaid = parseMoney(
    record?.amount_paid ?? record?.amount_received ?? record?.payment_made ?? record?.paymentMade
  );
  const remaining = Math.max(0, total - amountPaid);

  return { subtotal, discount, shipping, total, amountPaid, remaining };
}

export function countDocumentLineItems(record, itemKeys) {
  return getDocumentLineItems(record, itemKeys).length;
}

export function documentNeedsDetailFetch(record, itemKeys) {
  const lines = getDocumentLineItems(record, itemKeys);
  if (lines.length === 0) return true;
  const raw =
    record?.no_of_items ??
    record?.noOfItems ??
    record?.items_count ??
    record?.line_items_count;
  const expected = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (Number.isFinite(expected) && expected > 0 && lines.length < expected) return true;
  return false;
}

const BASE_DETAIL_COLUMNS = [
  { key: 'sr', label: '#' },
  { key: 'reference', label: 'Reference' },
  { key: 'transaction', label: 'Transaction' },
  { key: 'status', label: 'Status' },
  { key: 'party', label: 'Party' },
  { key: 'description', label: 'Description' },
  { key: 'created', label: 'Created' },
  { key: 'subtotal', label: 'Subtotal (PKR)' },
  { key: 'discount', label: 'Discount (PKR)' },
  { key: 'shipping', label: 'Shipping (PKR)' },
  { key: 'total', label: 'Total (PKR)' },
  { key: 'amountPaid', label: 'Amount paid (PKR)' },
  { key: 'remaining', label: 'Remaining (PKR)' },
  { key: 'lineNo', label: 'Line #' },
  { key: 'productCode', label: 'Product code' },
  { key: 'productName', label: 'Product name' },
  { key: 'qty', label: 'Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'unitPrice', label: 'Unit price (PKR)' },
  { key: 'lineTotal', label: 'Line total (PKR)' },
];

/** @param {{ partyLabel: string, referenceLabel?: string }} labels */
export function buildDetailExportColumns(labels) {
  return BASE_DETAIL_COLUMNS.map((col) => {
    if (col.key === 'party') return { ...col, label: labels.partyLabel };
    if (col.key === 'reference' && labels.referenceLabel) {
      return { ...col, label: labels.referenceLabel };
    }
    return col;
  });
}

/**
 * @param {object[]} records
 * @param {{ itemKeys: string[], getReference: Function, getParty: Function, getStatus: Function, getTransaction?: Function, getDescription?: Function }} config
 */
export function mapDocumentsToDetailExportRows(records, config) {
  const rows = [];
  let sr = 0;

  records.forEach((record) => {
    const lineItems = getDocumentLineItems(record, config.itemKeys);
    const financials = computeDocumentFinancials(record, lineItems);
    const header = {
      reference: config.getReference(record),
      transaction: config.getTransaction ? config.getTransaction(record) : '',
      status: config.getStatus(record),
      party: config.getParty(record),
      description: config.getDescription ? config.getDescription(record) : '',
      created: formatCreated(record),
      subtotal: formatMoney(financials.subtotal),
      discount: formatMoney(financials.discount),
      shipping: formatMoney(financials.shipping),
      total: formatMoney(financials.total),
      amountPaid: formatMoney(financials.amountPaid),
      remaining: formatMoney(financials.remaining),
    };

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
      const qty = parseMoney(line.qty ?? line.quantity ?? line.qty_ordered);
      const price = parseMoney(line.price ?? line.rate ?? line.unit_price);

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
