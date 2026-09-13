/**
 * Human-readable formatting for audit log payloads (especially order before/after).
 */

export function tryParseJson(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!(text.startsWith('{') || text.startsWith('['))) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function toReadableLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatLogMoney(n) {
  const num = typeof n === 'number' ? n : parseFloat(String(n).replace(/,/g, ''));
  if (!Number.isFinite(num)) return String(n ?? '');
  return num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const isMoneyKey = (key) =>
  /^(price|amount|subtotal|total|cost|rate|wholesale|unit_price|grand_total|amount_paid|remaining_amount|total_amount|shipping|discount|tax)$/i.test(
    String(key || '').replace(/[-_\s]/g, '_')
  );

const SKIP_FLAT_KEYS = new Set([
  '__v',
  'password',
  'token',
  'products',
  'Products',
  'items',
  'Items',
  'lines',
  'Lines',
]);

const SECTION_KEYS = [
  ['order_fields', 'Order'],
  ['orderFields', 'Order'],
  ['customer', 'Customer'],
  ['Customer', 'Customer'],
  ['payment_details', 'Payment'],
  ['paymentDetails', 'Payment'],
  ['shipping', 'Shipping'],
  ['Shipping', 'Shipping'],
  ['billing', 'Billing'],
  ['Billing', 'Billing'],
];

function formatScalar(key, value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return isMoneyKey(key) ? formatLogMoney(value) : String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '(none)';
    if (value.every((item) => item == null || typeof item !== 'object')) {
      return value.map((item) => String(item)).join(', ');
    }
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') {
    const name =
      value.name ||
      value.product_name ||
      value.productName ||
      value.company_name ||
      value.order_no ||
      value.email ||
      value._id ||
      value.id;
    if (name != null && String(name).trim() !== '') return String(name).trim();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const text = String(value).trim();
  if (!text) return '';
  if (isMoneyKey(key) && /^-?\d+(\.\d+)?$/.test(text)) return formatLogMoney(text);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    try {
      const d = new Date(text);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      /* ignore */
    }
  }
  return text;
}

function flattenObject(obj, prefix = '', out = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  Object.entries(obj).forEach(([key, value]) => {
    if (SKIP_FLAT_KEYS.has(key) || value == null) return;
    const label = prefix ? `${prefix} · ${toReadableLabel(key)}` : toReadableLabel(key);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedName =
        value.name ||
        value.product_name ||
        value.company_name ||
        value.order_no ||
        value.email;
      const nestedId = value._id || value.id;
      if (nestedName != null || (nestedId != null && Object.keys(value).length <= 4)) {
        out.push({
          key: `${prefix}.${key}`,
          label,
          value: formatScalar(key, value),
        });
        return;
      }
      flattenObject(value, label, out);
      return;
    }
    const formatted = formatScalar(key, value);
    if (formatted === '') return;
    out.push({ key: `${prefix}.${key}`, label, value: formatted });
  });
  return out;
}

export function normalizeCartProduct(product, index = 0) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return null;
  const name =
    product.product_name ||
    product.productName ||
    product.name ||
    product.product_id ||
    product.productId ||
    `Item ${index + 1}`;
  const productId = String(product.product_id || product.productId || product._id || '').trim();
  return {
    key: productId || `${String(name)}-${index}`,
    name: String(name),
    productId,
    qty: product.qty ?? product.quantity ?? '',
    price: product.price ?? product.rate ?? product.unit_price ?? '',
    subtotal: product.subtotal ?? product.amount ?? product.line_total ?? '',
  };
}

export function pickProductsArray(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.products,
    obj.Products,
    obj.items,
    obj.Items,
    obj.lines,
    obj.Lines,
    obj.order_items,
    obj.orderItems,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (typeof candidate === 'string') {
      const parsed = tryParseJson(candidate);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return null;
}

export function flattenSnapshot(side) {
  if (!side || typeof side !== 'object' || Array.isArray(side)) return [];
  const rows = [];
  const used = new Set();

  SECTION_KEYS.forEach(([key, sectionLabel]) => {
    if (side[key] && typeof side[key] === 'object' && !Array.isArray(side[key])) {
      used.add(key);
      flattenObject(side[key], sectionLabel, rows);
    }
  });

  Object.entries(side).forEach(([key, value]) => {
    if (used.has(key) || SKIP_FLAT_KEYS.has(key)) return;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, toReadableLabel(key), rows);
      return;
    }
    const formatted = formatScalar(key, value);
    if (formatted === '') return;
    rows.push({ key, label: toReadableLabel(key), value: formatted });
  });

  return rows;
}

function valuesEqual(a, b) {
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Parse a log row into a structured human-readable view model.
 * @returns {{
 *   summary: string,
 *   fieldChanges: Array<{key:string,label:string,before:string,after:string,changed:boolean}>,
 *   products: {before: object[], after: object[]} | null,
 *   sections: Array<{title:string, rows: Array<{label:string,value:string}>}>,
 *   changedCount: number,
 *   hasStructured: boolean,
 * }}
 */
export function buildHumanReadableLogView(item) {
  const sources = [
    item?.human_readable_description ?? item?.humanReadableDescription,
    item?.description,
    item?.details,
    item?.detail,
    item?.message,
    item?.meta,
    item?.data,
  ];

  let parsed = null;
  let rawText = '';
  for (const source of sources) {
    if (source == null) continue;
    if (typeof source === 'object') {
      parsed = source;
      break;
    }
    const text = String(source).trim();
    if (!text) continue;
    if (!rawText) rawText = text;
    const asJson = tryParseJson(text);
    if (asJson && typeof asJson === 'object') {
      parsed = asJson;
      break;
    }
  }

  const empty = {
    summary: '',
    fieldChanges: [],
    products: null,
    sections: [],
    changedCount: 0,
    hasStructured: false,
  };

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    if (!rawText) return empty;
    // Plain prose / already human text — avoid dumping huge JSON-looking blobs as summary.
    if (rawText.startsWith('{') || rawText.startsWith('[')) {
      return { ...empty, summary: 'See details below.', hasStructured: false };
    }
    return { ...empty, summary: rawText, hasStructured: false };
  }

  const beforeObj = parsed.before ?? parsed.Before ?? parsed.old ?? parsed.Old ?? null;
  const afterObj = parsed.after ?? parsed.After ?? parsed.new ?? parsed.New ?? null;

  if (beforeObj || afterObj) {
    const beforeRows = flattenSnapshot(beforeObj || {});
    const afterRows = flattenSnapshot(afterObj || {});
    const beforeMap = new Map(beforeRows.map((row) => [row.label, row.value]));
    const afterMap = new Map(afterRows.map((row) => [row.label, row.value]));
    const labels = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

    const fieldChanges = labels.map((label) => {
      const before = beforeMap.get(label) ?? '';
      const after = afterMap.get(label) ?? '';
      return {
        key: label,
        label,
        before,
        after,
        changed: !valuesEqual(before, after),
      };
    });

    // Prefer changed fields first, then unchanged.
    fieldChanges.sort((a, b) => Number(b.changed) - Number(a.changed));

    const beforeProducts = (pickProductsArray(beforeObj) || [])
      .map((row, i) => normalizeCartProduct(row, i))
      .filter(Boolean);
    const afterProducts = (pickProductsArray(afterObj) || [])
      .map((row, i) => normalizeCartProduct(row, i))
      .filter(Boolean);

    const productChanges = buildProductChangeRows(beforeProducts, afterProducts);
    const fieldChangedCount = fieldChanges.filter((row) => row.changed).length;
    const productChangedCount = productChanges.filter((row) => row.status !== 'unchanged').length;

    const summaryParts = [];
    if (fieldChangedCount) {
      summaryParts.push(
        `${fieldChangedCount} field${fieldChangedCount === 1 ? '' : 's'} changed`
      );
    }
    if (productChangedCount) {
      summaryParts.push(
        `${productChangedCount} line item${productChangedCount === 1 ? '' : 's'} changed`
      );
    }
    if (!summaryParts.length) summaryParts.push('No field differences detected');

    return {
      summary: summaryParts.join(' · '),
      fieldChanges,
      products: {
        before: beforeProducts,
        after: afterProducts,
        rows: productChanges,
      },
      sections: [],
      changedCount: fieldChangedCount + productChangedCount,
      hasStructured: true,
    };
  }

  // Non before/after object — show as labeled sections.
  const sections = [];
  SECTION_KEYS.forEach(([key, title]) => {
    if (parsed[key] && typeof parsed[key] === 'object' && !Array.isArray(parsed[key])) {
      const rows = flattenObject(parsed[key], '');
      if (rows.length) sections.push({ title, rows });
    }
  });
  const topRows = flattenSnapshot(
    Object.fromEntries(
      Object.entries(parsed).filter(
        ([key]) => !SECTION_KEYS.some(([sectionKey]) => sectionKey === key) && !SKIP_FLAT_KEYS.has(key)
      )
    )
  );
  if (topRows.length) sections.unshift({ title: 'Details', rows: topRows });

  const products = (pickProductsArray(parsed) || [])
    .map((row, i) => normalizeCartProduct(row, i))
    .filter(Boolean);

  return {
    summary: sections.length
      ? `${sections.reduce((n, s) => n + s.rows.length, 0)} detail field${
          sections.reduce((n, s) => n + s.rows.length, 0) === 1 ? '' : 's'
        }`
      : products.length
        ? `${products.length} product${products.length === 1 ? '' : 's'}`
        : '',
    fieldChanges: [],
    products: products.length ? { before: [], after: products, rows: [] } : null,
    sections,
    changedCount: 0,
    hasStructured: sections.length > 0 || products.length > 0,
  };
}

export function buildProductChangeRows(beforeProducts, afterProducts) {
  const beforeList = Array.isArray(beforeProducts) ? beforeProducts : [];
  const afterList = Array.isArray(afterProducts) ? afterProducts : [];
  const usedAfter = new Set();
  const rows = [];

  beforeList.forEach((beforeItem, index) => {
    let afterIndex = afterList.findIndex(
      (item, i) =>
        !usedAfter.has(i) &&
        ((beforeItem.productId && item.productId && beforeItem.productId === item.productId) ||
          beforeItem.name === item.name)
    );
    if (afterIndex < 0 && index < afterList.length && !usedAfter.has(index)) {
      afterIndex = index;
    }
    const afterItem = afterIndex >= 0 ? afterList[afterIndex] : null;
    if (afterIndex >= 0) usedAfter.add(afterIndex);

    let status = 'unchanged';
    if (!afterItem) status = 'removed';
    else if (
      !valuesEqual(beforeItem.qty, afterItem.qty) ||
      !valuesEqual(beforeItem.price, afterItem.price) ||
      !valuesEqual(beforeItem.subtotal, afterItem.subtotal) ||
      !valuesEqual(beforeItem.name, afterItem.name)
    ) {
      status = 'changed';
    }

    rows.push({
      key: `before-${beforeItem.key}-${index}`,
      name: afterItem?.name || beforeItem.name,
      productId: afterItem?.productId || beforeItem.productId,
      before: beforeItem,
      after: afterItem,
      status,
    });
  });

  afterList.forEach((afterItem, index) => {
    if (usedAfter.has(index)) return;
    rows.push({
      key: `after-${afterItem.key}-${index}`,
      name: afterItem.name,
      productId: afterItem.productId,
      before: null,
      after: afterItem,
      status: 'added',
    });
  });

  return rows;
}

/** Short one-line summary for cards (never dumps raw JSON). */
export function getLogHumanSummary(item) {
  const explicit = item?.human_readable_description ?? item?.humanReadableDescription;
  if (explicit != null && String(explicit).trim() !== '') {
    const text = String(explicit).trim();
    if (!(text.startsWith('{') || text.startsWith('['))) {
      const oneLine = text.replace(/\s*\n+\s*/g, ' · ');
      return oneLine.length > 160 ? `${oneLine.slice(0, 160)}…` : oneLine;
    }
  }
  const view = buildHumanReadableLogView(item);
  return view.summary || '';
}
