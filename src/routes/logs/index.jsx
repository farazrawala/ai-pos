import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchLogs,
  setSearch,
  setLogTag,
  setProductReference,
  setPurchaseOrderReference,
  setOrderReference,
  setPage,
  setLimit,
  setSort,
} from '../../features/logs/logsSlice.js';
import { fetchLogTagsRequest } from '../../features/logs/logsAPI.js';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { fetchPurchaseOrdersListRequest } from '../../features/purchaseOrders/purchaseOrdersAPI.js';
import { fetchOrdersRequest } from '../../features/orders/ordersAPI.js';
import { fetchWarehousesRequest } from '../../features/warehouse/warehouseAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { DEBUG } from '../../config/env.js';
import './logs-module.css';

/** Logs table columns. `sno` and `action` are always visible. */
const LOG_COLUMNS = [
  { key: 'sno', label: 'S.No', alwaysVisible: true },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action', alwaysVisible: true },
  { key: 'url', label: 'URL' },
  { key: 'human_readable_description', label: 'Description' },
  { key: 'tags', label: 'Tags' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
];

const productId = (p) => String(p?._id || p?.id || p?.product_id || '');
const productName = (p) => p?.name || p?.product_name || 'Product';

const purchaseOrderId = (row) => String(row?._id || row?.id || '');
const purchaseOrderRef = (row) =>
  row?.purchase_order_no ||
  row?.po_no ||
  row?.order_no ||
  row?.reference ||
  row?.invoice_no ||
  'Purchase order';
const purchaseOrderVendor = (row) => {
  const vendor = row?.vendor_id;
  if (vendor && typeof vendor === 'object' && !Array.isArray(vendor)) {
    const n =
      vendor.name ||
      vendor.vendor_name ||
      vendor.business_name ||
      vendor.company_name ||
      vendor.full_name ||
      '';
    if (String(n).trim()) return String(n).trim();
  }
  return (
    row?.supplier_name ||
    row?.vendor_name ||
    row?.supplier?.name ||
    ''
  );
};

const salesOrderId = (row) => String(row?._id || row?.id || '');
const salesOrderNo = (row) =>
  row?.order_no || row?.orderNo || row?.invoice_no || row?.reference || 'Order';
const salesOrderCustomer = (row) => {
  const name = row?.name || row?.customer_name || row?.customerName || '';
  return String(name).trim();
};

const warehouseId = (w) => String(w?._id || w?.id || '');
const warehouseName = (w) =>
  String(w?.name || w?.warehouse_name || w?.title || '').trim() || 'Warehouse';

const MONGO_ID_RE = /\b[a-f0-9]{24}\b/gi;

const emptyNameMaps = () => ({
  products: Object.create(null),
  warehouses: Object.create(null),
  purchaseOrders: Object.create(null),
  orders: Object.create(null),
});

const lookupName = (maps, bucket, id) => {
  const key = String(id || '').trim();
  if (!key || !maps?.[bucket]) return '';
  return maps[bucket][key] || '';
};

/** Logs list: show at most 40 chars; full URL in native tooltip on hover. */
function LogUrlCell({ url }) {
  const raw = url == null ? '' : String(url).trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  const display = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
  return (
    <code className="text-xs" title={raw}>
      {display}
    </code>
  );
}

/** Single-line ellipsis in table; full text on hover via `title`. */
function LogDescriptionCell({ text, maxWidth = 'min(22rem, 38vw)' }) {
  const raw = text == null ? '' : String(text).trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div className="text-truncate text-sm" style={{ maxWidth }} title={raw}>
      {raw}
    </div>
  );
}

const toReadableLabel = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/** snake/kebab/camel → Title Case with spaces (`create-product-variation` → `Create Product Variation`). */
const toPrettyTagLabel = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const tryParseJson = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!(text.startsWith('{') || text.startsWith('['))) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const formatLogMoney = (n) => {
  const num = typeof n === 'number' ? n : parseFloat(String(n).replace(/,/g, ''));
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const isMoneyKey = (key) =>
  /^(price|amount|subtotal|total|cost|rate|wholesale|unit_price|grand_total)$/i.test(
    String(key || '').replace(/[-_\s]/g, '_')
  );

const looksLikeProductRow = (obj) =>
  obj &&
  typeof obj === 'object' &&
  !Array.isArray(obj) &&
  (obj.product_name != null ||
    obj.productName != null ||
    obj.product_id != null ||
    obj.productId != null) &&
  (obj.qty != null || obj.quantity != null || obj.price != null || obj.subtotal != null);

const formatProductRow = (p, index) => {
  const name =
    p.product_name ||
    p.productName ||
    p.name ||
    p.product_id ||
    p.productId ||
    `Item ${index + 1}`;
  const productId = p.product_id || p.productId || '';
  const qty = p.qty ?? p.quantity;
  const price = p.price ?? p.rate ?? p.unit_price;
  const subtotal = p.subtotal ?? p.amount ?? p.line_total;
  const lines = [`${index + 1}. ${name}`];
  if (productId) lines.push(`   Product ID: ${productId}`);
  if (qty != null && String(qty).trim() !== '') lines.push(`   Qty: ${qty}`);
  if (price != null && String(price).trim() !== '') lines.push(`   Price: ${formatLogMoney(price)}`);
  if (subtotal != null && String(subtotal).trim() !== '') {
    lines.push(`   Subtotal: ${formatLogMoney(subtotal)}`);
  }
  return lines.join('\n');
};

const formatScalarLogValue = (key, value) => {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return isMoneyKey(key) ? formatLogMoney(value) : String(value);
  }
  const text = String(value).trim();
  if (!text) return '';
  if (isMoneyKey(key) && /^-?\d+(\.\d+)?$/.test(text)) return formatLogMoney(text);
  return text;
};

/** Recursively format objects / arrays into readable multi-line text. */
const formatLogValue = (key, value, depth = 0) => {
  if (value == null) return '';

  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    if (parsed != null) return formatLogValue(key, parsed, depth);
    return formatScalarLogValue(key, value);
  }

  if (typeof value !== 'object') {
    return formatScalarLogValue(key, value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '(none)';
    if (value.every((item) => looksLikeProductRow(item))) {
      return value.map((item, i) => formatProductRow(item, i)).join('\n');
    }
    return value
      .map((item, i) => {
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          const inner = formatLogDescriptionJson(item, depth + 1);
          if (!inner) return `${i + 1}. —`;
          const indented = inner
            .split('\n')
            .map((line) => `   ${line}`)
            .join('\n');
          return `${i + 1}.\n${indented}`;
        }
        const scalar = formatLogValue(`${key}_${i}`, item, depth + 1);
        return `${i + 1}. ${scalar || '—'}`;
      })
      .join('\n');
  }

  if (looksLikeProductRow(value) && depth > 0) {
    return formatProductRow(value, 0);
  }

  return formatLogDescriptionJson(value, depth + 1);
};

const formatLogDescriptionJson = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    if (Array.isArray(obj)) return formatLogValue('items', obj, depth);
    return '';
  }

  const source = obj.source ?? obj.Source ?? '';
  const module = obj.module ?? obj.Module ?? '';
  const action = obj.action ?? obj.Action ?? obj.event ?? obj.Event ?? '';

  const preferred = [];
  if (source) preferred.push(`Source: ${toReadableLabel(source)}`);
  if (module) preferred.push(`Module: ${toReadableLabel(module)}`);
  if (action) preferred.push(`Action: ${toReadableLabel(action)}`);

  const skipKeys = new Set(['source', 'Source', 'module', 'Module', 'action', 'Action', 'event', 'Event']);
  const rest = Object.entries(obj)
    .filter(([k, v]) => !skipKeys.has(k) && v != null && String(v).trim() !== '')
    .map(([k, v]) => {
      const label = toReadableLabel(k);
      const formatted = formatLogValue(k, v, depth);
      if (!formatted) return '';
      if (formatted.includes('\n')) {
        return `${label}:\n${formatted
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}`;
      }
      return `${label}: ${formatted}`;
    })
    .filter(Boolean);

  // Prefer source/module/action summary when present; still append other fields when useful.
  if (preferred.length > 0) {
    return [...preferred, ...rest].join('\n');
  }

  return rest.join('\n');
};

/**
 * Expand inventory-movement prose into structured fields, resolve entity IDs to names,
 * expand embedded JSON, and pretty-print whole JSON payloads.
 */
const humanizeInventoryMovementProse = (text, nameMaps = emptyNameMaps()) => {
  const raw = String(text ?? '').trim();
  if (!raw) return '';

  const movementMatch = raw.match(
    /^Inventory movement\s+(in|out)\s*:\s*qty\s+([\d.,]+)\s*@\s*unit\s+([\d.,]+)\s*\(\s*total\s+([\d.,]+)\s*\)\s+for product id\s+([a-f0-9]{24})\s+in warehouse\s+([a-f0-9]{24})(?:\.\s*Linked to\s+(.+?))?\s*\.?$/i
  );
  if (!movementMatch) return '';

  const direction = String(movementMatch[1] || '').toLowerCase() === 'out' ? 'Out' : 'In';
  const qty = movementMatch[2];
  const unit = movementMatch[3];
  const total = movementMatch[4];
  const productId = movementMatch[5];
  const warehouseIdValue = movementMatch[6];
  const linkedRaw = String(movementMatch[7] || '').trim();

  const productLabel =
    lookupName(nameMaps, 'products', productId) || `Product ${productId.slice(0, 8)}…`;
  const warehouseLabel =
    lookupName(nameMaps, 'warehouses', warehouseIdValue) ||
    `Warehouse ${warehouseIdValue.slice(0, 8)}…`;

  const lines = [
    `Movement: Inventory ${direction}`,
    `Qty: ${qty}`,
    `Unit Price: ${formatLogMoney(unit)}`,
    `Total: ${formatLogMoney(total)}`,
    `Product: ${productLabel}`,
    `Warehouse: ${warehouseLabel}`,
  ];

  if (linkedRaw) {
    const linkedMatch = linkedRaw.match(
      /^(.+?)\s*\(([^)]+)\)\s*(?:\(([a-f0-9]{24})\))?$/i
    );
    if (linkedMatch) {
      const docType = linkedMatch[1].trim();
      const docNo = linkedMatch[2].trim();
      const docId = linkedMatch[3] || '';
      const resolvedPo = docId ? lookupName(nameMaps, 'purchaseOrders', docId) : '';
      lines.push(`Linked Document: ${docType} ${resolvedPo || docNo}`.trim());
    } else {
      lines.push(`Linked Document: ${linkedRaw}`);
    }
  }

  lines.push('Products:');
  lines.push(
    formatProductRow(
      {
        product_name: productLabel,
        qty,
        price: unit,
        subtotal: total,
      },
      0
    )
  );

  return lines.join('\n');
};

const resolveIdsInText = (text, nameMaps = emptyNameMaps()) => {
  let out = String(text ?? '');
  if (!out) return '';

  out = out.replace(
    /\bproduct id\s+([a-f0-9]{24})\b/gi,
    (_, id) => {
      const name = lookupName(nameMaps, 'products', id);
      return name ? `product ${name}` : `product id ${id}`;
    }
  );
  out = out.replace(/\bin warehouse\s+([a-f0-9]{24})\b/gi, (_, id) => {
    const name = lookupName(nameMaps, 'warehouses', id);
    return name ? `in warehouse ${name}` : `in warehouse ${id}`;
  });
  out = out.replace(
    /\bPurchase Order\s*\(([^)]+)\)\s*\(([a-f0-9]{24})\)/gi,
    (_, ref, id) => {
      const name = lookupName(nameMaps, 'purchaseOrders', id);
      return `Purchase Order ${name || ref}`;
    }
  );

  // Prefer names for bare IDs when they uniquely match a known entity.
  out = out.replace(MONGO_ID_RE, (id) => {
    return (
      lookupName(nameMaps, 'products', id) ||
      lookupName(nameMaps, 'warehouses', id) ||
      lookupName(nameMaps, 'purchaseOrders', id) ||
      lookupName(nameMaps, 'orders', id) ||
      id
    );
  });

  return out;
};

const humanizeLogDetailsText = (raw, nameMaps = emptyNameMaps()) => {
  const text = String(raw ?? '').trim();
  if (!text) return '';

  const inventoryStructured = humanizeInventoryMovementProse(text, nameMaps);
  if (inventoryStructured) return inventoryStructured;

  const asJson = tryParseJson(text);
  if (asJson != null) {
    if (Array.isArray(asJson)) {
      return asJson.map((entry) => formatLogDescriptionJson(entry)).filter(Boolean).join('\n\n');
    }
    return formatLogDescriptionJson(asJson);
  }

  const withJsonExpanded = text
    .split('\n')
    .map((line) => {
      const match = line.match(/^([^:]+):\s*([\[{].*)$/);
      if (!match) return line;
      const label = match[1].trim();
      const parsed = tryParseJson(match[2]);
      if (parsed == null) return line;
      const formatted = formatLogValue(label, parsed, 0);
      if (!formatted) return line;
      if (formatted.includes('\n')) {
        return `${label}:\n${formatted
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n')}`;
      }
      return `${label}: ${formatted}`;
    })
    .join('\n');

  return resolveIdsInText(withJsonExpanded, nameMaps);
};

const getLogHumanReadablePreview = (fullText) => {
  const raw = String(fullText ?? '').trim();
  if (!raw) return '';
  const oneLine = raw.replace(/\s*\n+\s*/g, ' · ');
  if (oneLine.length <= 40) return oneLine;
  return `${oneLine.slice(0, 40)}…`;
};

/** Prefer API field; otherwise parse JSON `description`. Always humanize nested JSON. */
const getLogHumanReadableDescription = (item, nameMaps = emptyNameMaps()) => {
  const explicit = item?.human_readable_description ?? item?.humanReadableDescription;
  if (explicit != null && String(explicit).trim() !== '') {
    return humanizeLogDetailsText(String(explicit).trim(), nameMaps);
  }

  const rawDesc = item?.description ?? item?.details ?? item?.detail ?? item?.message;
  if (rawDesc == null) return '';
  const text = String(rawDesc).trim();
  if (!text) return '';

  return humanizeLogDetailsText(text, nameMaps);
};

const pickProductsArray = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.products,
    obj.Products,
    obj.items,
    obj.Items,
    obj.lines,
    obj.Lines,
    obj.purchase_order_items,
    obj.purchaseOrderItems,
    obj.cart,
    obj.Cart,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (typeof candidate === 'string') {
      const parsed = tryParseJson(candidate);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return null;
};

const extractBeforeAfterProductsFromItem = (item, nameMaps = emptyNameMaps()) => {
  const sources = [
    item?.description,
    item?.details,
    item?.detail,
    item?.message,
    item?.human_readable_description,
    item?.humanReadableDescription,
    item?.meta,
    item?.data,
  ];

  for (const source of sources) {
    let parsed = source;
    if (typeof source === 'string') parsed = tryParseJson(source);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;

    const beforeObj = parsed.before ?? parsed.Before ?? parsed.old ?? parsed.Old ?? null;
    const afterObj = parsed.after ?? parsed.After ?? parsed.new ?? parsed.New ?? null;
    const beforeProducts = pickProductsArray(beforeObj) || pickProductsArray(parsed.before_products);
    const afterProducts = pickProductsArray(afterObj) || pickProductsArray(parsed.after_products);

    if (beforeProducts || afterProducts) {
      const resolve = (p, i) => {
        const row = normalizeCartProduct(p, i);
        if (!row) return null;
        if (row.productId) {
          const mapped = lookupName(nameMaps, 'products', row.productId);
          if (mapped) row.name = mapped;
        }
        return row;
      };
      return {
        before: (beforeProducts || []).map(resolve).filter(Boolean),
        after: (afterProducts || []).map(resolve).filter(Boolean),
      };
    }
  }

  return null;
};

function LogHumanReadablePreviewCell({ fullText, cartProducts, onOpen }) {
  const raw = fullText == null ? '' : String(fullText).trim();
  if (!raw) {
    return <span className="text-muted">—</span>;
  }
  const preview = getLogHumanReadablePreview(raw);
  return (
    <button
      type="button"
      className="btn btn-link btn-sm p-0 mb-0 text-start text-decoration-none text-dark font-weight-normal"
      onClick={() => onOpen?.({ text: raw, cartProducts: cartProducts || null })}
      title="View full details"
    >
      <span
        className="text-truncate d-inline-block text-sm"
        style={{ maxWidth: 'min(16rem, 28vw)' }}
      >
        {preview}
      </span>
    </button>
  );
}

const parseLogDetailsForDisplay = (text) => {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  const fields = [];
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const fieldMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    const isIndented = /^\s/.test(line);

    if (fieldMatch && !isIndented && fieldMatch[2]) {
      fields.push({ label: fieldMatch[1].trim(), value: fieldMatch[2].trim() });
      currentSection = null;
    } else if (fieldMatch && !isIndented) {
      currentSection = { title: fieldMatch[1].trim(), lines: [] };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.lines.push(trimmed);
    } else {
      sections.push({ title: 'Details', lines: [trimmed] });
    }
  }

  return { fields, sections };
};

const parseProductSection = (lines) => {
  const products = [];
  let current = null;

  for (const line of lines) {
    const itemMatch = line.match(/^\d+\.\s*(.+)$/);
    const fieldMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (itemMatch) {
      current = { name: itemMatch[1].trim(), values: {} };
      products.push(current);
    } else if (fieldMatch && current) {
      current.values[fieldMatch[1].trim().toLowerCase()] = fieldMatch[2].trim();
    }
  }

  return products;
};

const normalizeCartProduct = (product, index = 0) => {
  if (!product) return null;
  if (typeof product === 'object' && !Array.isArray(product) && product.values) {
    const values = product.values || {};
    return {
      key: String(values['product id'] || values.product_id || product.name || index),
      name: product.name || values['product name'] || `Item ${index + 1}`,
      productId: values['product id'] || values.product_id || '',
      qty: values.qty || values.quantity || '',
      price: values.price || values.rate || '',
      subtotal: values.subtotal || values.amount || '',
    };
  }
  if (typeof product === 'object' && !Array.isArray(product)) {
    const name =
      product.product_name ||
      product.productName ||
      product.name ||
      product.product_id ||
      product.productId ||
      `Item ${index + 1}`;
    const productId = String(product.product_id || product.productId || '').trim();
    return {
      key: productId || String(name),
      name: String(name),
      productId,
      qty: product.qty ?? product.quantity ?? '',
      price: product.price ?? product.rate ?? product.unit_price ?? '',
      subtotal: product.subtotal ?? product.amount ?? product.line_total ?? '',
    };
  }
  return null;
};

/** Pull product line items out of a Before/After text block. */
const extractProductCartFromLines = (lines) => {
  const list = Array.isArray(lines) ? lines : [];
  const block = [];
  let inProducts = false;

  for (const rawLine of list) {
    const line = String(rawLine || '');
    const trimmed = line.trim();
    const fieldMatch = trimmed.match(/^([^:]+):\s*(.*)$/);

    if (fieldMatch && /^products$/i.test(fieldMatch[1].trim())) {
      const inlineJson = tryParseJson(fieldMatch[2]);
      if (Array.isArray(inlineJson)) {
        return inlineJson.map((item, i) => normalizeCartProduct(item, i)).filter(Boolean);
      }
      inProducts = true;
      block.length = 0;
      continue;
    }

    if (inProducts) {
      const startsNewSection =
        fieldMatch &&
        fieldMatch[2] === '' &&
        !/^(qty|quantity|price|subtotal|product id|product name)$/i.test(fieldMatch[1].trim());
      const startsTopLevelField =
        fieldMatch &&
        fieldMatch[2] !== '' &&
        !/^\d+\./.test(trimmed) &&
        !/^(qty|quantity|price|subtotal|product id|product name)$/i.test(fieldMatch[1].trim());

      if (startsNewSection || startsTopLevelField) {
        inProducts = false;
      } else {
        block.push(trimmed);
        continue;
      }
    }
  }

  if (block.length) {
    return parseProductSection(block)
      .map((item, i) => normalizeCartProduct(item, i))
      .filter(Boolean);
  }
  return [];
};

const CART_FIELD_KEYS =
  /^(product count|qty|quantity|price|subtotal|product id|product name|products)$/i;

const parseDetailFields = (lines, { excludeCartFields = false } = {}) => {
  const fields = new Map();
  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (!value || /fields$/i.test(label) || /details$/i.test(label)) continue;
    if (excludeCartFields && CART_FIELD_KEYS.test(label)) continue;
    if (value.startsWith('[') || value.startsWith('{')) continue;
    fields.set(label, value);
  }
  return fields;
};

const detailValuesEqual = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

const formatCartMoney = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return formatLogMoney(raw);
};

function ProfessionalDetailValue({ value }) {
  const raw = String(value ?? '').trim();
  if (!raw) return <span className="text-muted">—</span>;

  if (/^[a-f0-9]{24}$/i.test(raw)) {
    return (
      <code className="log-change-value log-change-value--id" title={raw}>
        {raw.slice(0, 8)}…{raw.slice(-4)}
      </code>
    );
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) && moment(raw).isValid()) {
    return (
      <span className="log-change-value" title={raw}>
        {moment(raw).format('DD MMM YYYY, h:mm:ss a')}
      </span>
    );
  }

  if (/^(active|completed|placed|posted|success)$/i.test(raw)) {
    return <span className="badge bg-gradient-success text-xxs">{toReadableLabel(raw)}</span>;
  }

  if (/^(inactive|cancelled|failed|deleted|void)$/i.test(raw)) {
    return <span className="badge bg-gradient-danger text-xxs">{toReadableLabel(raw)}</span>;
  }

  if (/^(pending|draft)$/i.test(raw)) {
    return <span className="badge bg-gradient-warning text-xxs">{toReadableLabel(raw)}</span>;
  }

  if (/^(yes|no|true|false)$/i.test(raw)) {
    const positive = /^(yes|true)$/i.test(raw);
    return (
      <span className={`badge ${positive ? 'bg-gradient-success' : 'bg-gradient-secondary'} text-xxs`}>
        {positive ? 'Yes' : 'No'}
      </span>
    );
  }

  return <span className="log-change-value">{raw}</span>;
}

function ProductCartComparison({ beforeProducts, afterProducts }) {
  const beforeList = Array.isArray(beforeProducts) ? beforeProducts : [];
  const afterList = Array.isArray(afterProducts) ? afterProducts : [];
  if (!beforeList.length && !afterList.length) return null;

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
      !detailValuesEqual(beforeItem.qty, afterItem.qty) ||
      !detailValuesEqual(beforeItem.price, afterItem.price) ||
      !detailValuesEqual(beforeItem.subtotal, afterItem.subtotal) ||
      !detailValuesEqual(beforeItem.name, afterItem.name)
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

  const changedCount = rows.filter((row) => row.status !== 'unchanged').length;

  return (
    <section className="log-details-section log-cart-section">
      <div className="log-details-section-title">
        <div>
          <span>Product cart</span>
          <span className="log-change-section__subtitle">
            Line items before and after this update
          </span>
        </div>
        <span className="badge bg-gradient-primary">
          {changedCount} {changedCount === 1 ? 'line change' : 'line changes'}
        </span>
      </div>
      <div className="table-responsive">
        <table className="table align-items-center mb-0 log-cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-end">Before qty</th>
              <th className="text-end">Before price</th>
              <th className="text-end">Before subtotal</th>
              <th className="text-end">After qty</th>
              <th className="text-end">After price</th>
              <th className="text-end">After subtotal</th>
              <th className="text-end">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.status !== 'unchanged' ? 'is-changed' : ''} key={row.key}>
                <td>
                  <div className="log-cart-product-name">{row.name}</div>
                  {row.productId ? (
                    <code className="log-change-value log-change-value--id" title={row.productId}>
                      {row.productId.slice(0, 8)}…{row.productId.slice(-4)}
                    </code>
                  ) : null}
                </td>
                <td className="text-end">{row.before?.qty || '—'}</td>
                <td className="text-end">{row.before ? formatCartMoney(row.before.price) : '—'}</td>
                <td className="text-end">
                  {row.before ? formatCartMoney(row.before.subtotal) : '—'}
                </td>
                <td className="text-end">{row.after?.qty || '—'}</td>
                <td className="text-end">{row.after ? formatCartMoney(row.after.price) : '—'}</td>
                <td className="text-end font-weight-semibold">
                  {row.after ? formatCartMoney(row.after.subtotal) : '—'}
                </td>
                <td className="text-end">
                  {row.status === 'added' ? (
                    <span className="badge bg-gradient-success text-xxs">Added</span>
                  ) : row.status === 'removed' ? (
                    <span className="badge bg-gradient-danger text-xxs">Removed</span>
                  ) : row.status === 'changed' ? (
                    <span className="badge bg-gradient-warning text-xxs">Changed</span>
                  ) : (
                    <span className="badge bg-gradient-secondary text-xxs">Same</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BeforeAfterComparison({ beforeLines, afterLines, structuredCart }) {
  const beforeProductsFromText = extractProductCartFromLines(beforeLines);
  const afterProductsFromText = extractProductCartFromLines(afterLines);
  const beforeProducts =
    structuredCart?.before?.length > 0 ? structuredCart.before : beforeProductsFromText;
  const afterProducts =
    structuredCart?.after?.length > 0 ? structuredCart.after : afterProductsFromText;
  const hasCart = beforeProducts.length > 0 || afterProducts.length > 0;

  const before = parseDetailFields(beforeLines, { excludeCartFields: hasCart });
  const after = parseDetailFields(afterLines, { excludeCartFields: hasCart });
  const labels = [...new Set([...before.keys(), ...after.keys()])];
  const fieldChangedCount = labels.reduce(
    (count, label) => count + (detailValuesEqual(before.get(label), after.get(label)) ? 0 : 1),
    0
  );

  if (!labels.length && !hasCart) return null;

  return (
    <>
      {hasCart ? (
        <ProductCartComparison beforeProducts={beforeProducts} afterProducts={afterProducts} />
      ) : null}

      {labels.length ? (
        <section className="log-details-section log-change-section">
          <div className="log-details-section-title">
            <div>
              <span>Change comparison</span>
              <span className="log-change-section__subtitle">
                Before and after values for this update
              </span>
            </div>
            <span className="badge bg-gradient-primary">
              {fieldChangedCount} {fieldChangedCount === 1 ? 'change' : 'changes'}
            </span>
          </div>
          <div className="table-responsive">
            <table className="table align-items-center mb-0 log-change-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => {
                  const beforeValue = before.get(label);
                  const afterValue = after.get(label);
                  const changed = !detailValuesEqual(beforeValue, afterValue);
                  return (
                    <tr className={changed ? 'is-changed' : ''} key={label}>
                      <td>
                        <span className="log-change-field">{toReadableLabel(label)}</span>
                        {changed ? <span className="log-change-dot" title="Changed" /> : null}
                      </td>
                      <td>
                        <ProfessionalDetailValue value={beforeValue} />
                      </td>
                      <td>
                        <ProfessionalDetailValue value={afterValue} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

function LogDetailsContent({ text, cartProducts }) {
  const { fields, sections } = parseLogDetailsForDisplay(text);
  const beforeSection = sections.find((section) => section.title.toLowerCase() === 'before');
  const afterSection = sections.find((section) => section.title.toLowerCase() === 'after');
  const regularSections = sections.filter(
    (section) => !['before', 'after'].includes(section.title.toLowerCase())
  );

  return (
    <div className="log-details-content">
      {fields.length > 0 ? (
        <div className="log-details-summary">
          {fields.map(({ label, value }) => {
            const isId = /id$/i.test(label) && /^[a-f0-9]{24}$/i.test(value);
            return (
              <div className="log-details-field" key={`${label}-${value}`}>
                <span className="log-details-label">{label}</span>
                <span
                  className={`log-details-value${isId ? ' log-details-value--mono' : ''}`}
                  title={isId ? value : undefined}
                >
                  {isId ? `${value.slice(0, 10)}…${value.slice(-4)}` : value}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {beforeSection && afterSection ? (
        <BeforeAfterComparison
          beforeLines={beforeSection.lines}
          afterLines={afterSection.lines}
          structuredCart={cartProducts}
        />
      ) : cartProducts?.before?.length || cartProducts?.after?.length ? (
        <ProductCartComparison
          beforeProducts={cartProducts?.before || []}
          afterProducts={cartProducts?.after || []}
        />
      ) : null}

      {regularSections.map((section, sectionIndex) => {
        const products =
          section.title.toLowerCase() === 'products' ? parseProductSection(section.lines) : [];
        return (
          <section className="log-details-section" key={`${section.title}-${sectionIndex}`}>
            <div className="log-details-section-title">
              <span>{section.title}</span>
              {products.length > 0 ? (
                <span className="badge bg-gradient-primary">{products.length}</span>
              ) : null}
            </div>
            {products.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm align-items-center mb-0 log-details-products">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Qty</th>
                      <th className="text-end">Price</th>
                      <th className="text-end">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr key={`${product.name}-${index}`}>
                        <td className="font-weight-semibold text-dark">{product.name}</td>
                        <td className="text-end">{product.values.qty || '—'}</td>
                        <td className="text-end">{product.values.price || '—'}</td>
                        <td className="text-end font-weight-semibold">
                          {product.values.subtotal || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="log-details-notes">
                {section.lines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LogDetailsModal({ open, text, cartProducts, onClose }) {
  if (!open) return null;
  const body = String(text ?? '').trim();
  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="logDetailsModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg log-details-modal">
            <div className="modal-header log-details-header">
              <div className="d-flex align-items-center gap-3">
                <span className="log-details-icon" aria-hidden="true">
                  <i className="fas fa-clipboard-list" />
                </span>
                <div>
                  <h5 className="modal-title mb-0" id="logDetailsModalLabel">
                    Activity details
                  </h5>
                  <p className="text-xs text-muted mb-0 mt-1">
                    Human-readable audit information
                  </p>
                </div>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body log-details-body">
              {body || cartProducts?.before?.length || cartProducts?.after?.length ? (
                <LogDetailsContent text={body} cartProducts={cartProducts} />
              ) : (
                <div className="text-center text-muted py-4">No details available.</div>
              )}
            </div>
            <div className="modal-footer log-details-footer">
              <button type="button" className="btn btn-dark btn-sm mb-0 px-4" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}

const Logs = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    logTag,
    referenceId,
    referenceType,
    sort,
  } = useSelector((state) => state.logs);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('idle');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrdersStatus, setPurchaseOrdersStatus] = useState('idle');
  const [orders, setOrders] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState('idle');
  const [warehouses, setWarehouses] = useState([]);
  const [logTags, setLogTags] = useState([]);
  const [logTagsStatus, setLogTagsStatus] = useState('idle');
  const [logDetails, setLogDetails] = useState(null);
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility('logs', LOG_COLUMNS);

  const selectedProductId = referenceType === 'product' ? referenceId : '';
  const selectedPurchaseOrderId = referenceType === 'purchase_order' ? referenceId : '';
  const selectedOrderId = referenceType === 'order' ? referenceId : '';

  const nameMaps = useMemo(() => {
    const maps = emptyNameMaps();
    for (const p of products) {
      const id = productId(p);
      if (id) maps.products[id] = productName(p);
    }
    for (const w of warehouses) {
      const id = warehouseId(w);
      if (id) maps.warehouses[id] = warehouseName(w);
    }
    for (const row of purchaseOrders) {
      const id = purchaseOrderId(row);
      if (id) maps.purchaseOrders[id] = purchaseOrderRef(row);
    }
    for (const row of orders) {
      const id = salesOrderId(row);
      if (id) maps.orders[id] = String(salesOrderNo(row));
    }
    return maps;
  }, [products, warehouses, purchaseOrders, orders]);

  usePermissions('logs');
  useRequireModuleAccess('logs');

  useEffect(() => {
    let cancelled = false;
    setLogTagsStatus('loading');
    (async () => {
      try {
        const tags = await fetchLogTagsRequest();
        if (cancelled) return;
        setLogTags(tags);
        setLogTagsStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Logs module] Failed to load log tags for filter', err);
        setLogTags([]);
        setLogTagsStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logFilterTabs = useMemo(
    () => [
      { id: '', label: 'All' },
      ...logTags.map((tag) => ({ id: tag, label: toPrettyTagLabel(tag) })),
    ],
    [logTags]
  );

  useEffect(() => {
    let cancelled = false;
    setProductsStatus('loading');
    (async () => {
      try {
        const res = await fetchProductsRequest({ page: 1, limit: 2000 });
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) =>
          String(productName(a)).localeCompare(String(productName(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setProducts(rows);
        setProductsStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Logs module] Failed to load products for filter', err);
        setProducts([]);
        setProductsStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchWarehousesRequest({ page: 1, limit: 1000 });
        if (cancelled) return;
        setWarehouses(Array.isArray(result?.data) ? result.data : []);
      } catch (err) {
        if (cancelled) return;
        console.error('[Logs module] Failed to load warehouses for log labels', err);
        setWarehouses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productOptions = useMemo(() => {
    const rows = products
      .map((p) => {
        const id = productId(p);
        if (!id) return null;
        const sku = p.sku || p.product_code || '';
        return {
          value: id,
          label: productName(p),
          subLabel: sku || undefined,
        };
      })
      .filter(Boolean);
    return [{ value: '', label: 'All products' }, ...rows];
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    setPurchaseOrdersStatus('loading');
    (async () => {
      try {
        const res = await fetchPurchaseOrdersListRequest({
          page: 1,
          limit: 2000,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) =>
          String(purchaseOrderRef(a)).localeCompare(String(purchaseOrderRef(b)), undefined, {
            sensitivity: 'base',
          })
        );
        setPurchaseOrders(rows);
        setPurchaseOrdersStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Logs module] Failed to load purchase orders for filter', err);
        setPurchaseOrders([]);
        setPurchaseOrdersStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const purchaseOrderOptions = useMemo(() => {
    const rows = purchaseOrders
      .map((row) => {
        const id = purchaseOrderId(row);
        if (!id) return null;
        const vendor = purchaseOrderVendor(row);
        return {
          value: id,
          label: purchaseOrderRef(row),
          subLabel: vendor || undefined,
        };
      })
      .filter(Boolean);
    return [{ value: '', label: 'All purchase orders' }, ...rows];
  }, [purchaseOrders]);

  useEffect(() => {
    let cancelled = false;
    setOrdersStatus('loading');
    (async () => {
      try {
        const res = await fetchOrdersRequest({
          page: 1,
          limit: 2000,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) =>
          String(salesOrderNo(a)).localeCompare(String(salesOrderNo(b)), undefined, {
            sensitivity: 'base',
            numeric: true,
          })
        );
        setOrders(rows);
        setOrdersStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        console.error('[Logs module] Failed to load orders for filter', err);
        setOrders([]);
        setOrdersStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderOptions = useMemo(() => {
    const rows = orders
      .map((row) => {
        const id = salesOrderId(row);
        if (!id) return null;
        const customer = salesOrderCustomer(row);
        return {
          value: id,
          label: String(salesOrderNo(row)),
          subLabel: customer || undefined,
        };
      })
      .filter(Boolean);
    return [{ value: '', label: 'All order nos' }, ...rows];
  }, [orders]);

  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (logTag) params.tag = logTag;
    if (referenceId) {
      params.reference_id = referenceId;
      params.reference_type = referenceType || 'product';
    }
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchLogs(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    logTag,
    referenceId,
    referenceType,
    sort.sortBy,
    sort.sortOrder,
  ]);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        dispatch(setSearch(value));
      }, 500);
    },
    [dispatch]
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
    } else {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      sortClickTimeoutRef.current = setTimeout(() => {
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
  };

  const renderSortIcon = (columnName) => {
    if (sort.sortBy !== columnName) {
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>;
    }
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    );
  };

  useEffect(() => {
    if (error) {
      console.error('[Logs module] Failed to fetch logs list', error);
    }
  }, [error]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);
  const resultSummary =
    !loading && !error
      ? pagination.total === 0
        ? 'No matching entries'
        : `Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${pagination.total.toLocaleString()}`
      : 'Audit trail of system activity';

  const hasActiveReference = Boolean(selectedProductId || selectedPurchaseOrderId || selectedOrderId);
  const hasActiveFilters = Boolean(localSearch || logTag || hasActiveReference);

  const clearAllFilters = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setLocalSearch('');
    dispatch(setSearch(''));
    dispatch(setLogTag(''));
    dispatch(setProductReference(''));
    dispatch(setPurchaseOrderReference(''));
    dispatch(setOrderReference(''));
  };

  return (
    <div className="container-fluid py-4 px-0 logs-module" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card border-0 shadow-sm logs-card" style={{ maxWidth: '100%' }}>
            <div className="card-header bg-white border-bottom logs-page-header">
              <div className="row align-items-center g-3">
                <div className="col-lg">
                  <div className="d-flex align-items-center gap-3">
                    <div className="logs-header-icon" aria-hidden="true">
                      <i className="fas fa-clipboard-list" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="mb-1">Activity Logs</h5>
                      <p className="text-sm text-muted mb-0">
                        {resultSummary}
                        {DEBUG ? (
                          <span className="ms-1">· Read-only · Server-side pagination</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-auto">
                  <div className="d-flex align-items-center justify-content-lg-end gap-2 flex-wrap">
                    <div className="input-group input-group-sm logs-search-group">
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search logs…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search logs"
                      />
                      {localSearch ? (
                        <button
                          type="button"
                          className="btn btn-outline-secondary mb-0 px-3"
                          title="Clear search"
                          aria-label="Clear search"
                          onClick={() => {
                            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                            setLocalSearch('');
                            dispatch(setSearch(''));
                          }}
                        >
                          <i className="fas fa-times" />
                        </button>
                      ) : null}
                    </div>
                    <ColumnVisibilityMenu
                      columns={LOG_COLUMNS}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                      id="logsColumnVisibilityMenu"
                    />
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mb-0"
                        onClick={clearAllFilters}
                        title="Clear all filters"
                      >
                        <i className="fas fa-times me-1" aria-hidden="true" />
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="logs-filter-panel">
              <div className="row g-3 align-items-end">
                <div className="col-xl-4 col-md-4 col-sm-6">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted">
                    Product
                  </label>
                  <SearchableSelect
                    options={productOptions}
                    value={selectedProductId}
                    placeholder="All products"
                    disabled={loading || productsStatus === 'loading'}
                    onChange={(next) => dispatch(setProductReference(next))}
                  />
                  {productsStatus === 'loading' ? (
                    <p className="text-xs text-muted mb-0 mt-1">Loading products…</p>
                  ) : null}
                </div>
                <div className="col-xl-4 col-md-4 col-sm-6">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted">
                    Purchase order
                  </label>
                  <SearchableSelect
                    options={purchaseOrderOptions}
                    value={selectedPurchaseOrderId}
                    placeholder="All purchase orders"
                    disabled={loading || purchaseOrdersStatus === 'loading'}
                    onChange={(next) => dispatch(setPurchaseOrderReference(next))}
                  />
                  {purchaseOrdersStatus === 'loading' ? (
                    <p className="text-xs text-muted mb-0 mt-1">Loading purchase orders…</p>
                  ) : null}
                </div>
                <div className="col-xl-4 col-md-4 col-sm-6">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted">
                    Order no.
                  </label>
                  <SearchableSelect
                    options={orderOptions}
                    value={selectedOrderId}
                    placeholder="All order nos"
                    disabled={loading || ordersStatus === 'loading'}
                    onChange={(next) => dispatch(setOrderReference(next))}
                  />
                  {ordersStatus === 'loading' ? (
                    <p className="text-xs text-muted mb-0 mt-1">Loading orders…</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="logs-tag-bar">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="logs-tag-bar__label">Tags</span>
                <div
                  className="btn-group btn-group-sm flex-wrap logs-tag-tabs"
                  role="group"
                  aria-label="Filter logs by tag"
                >
                  {logTagsStatus === 'loading' ? (
                    <span className="text-xs text-muted align-self-center">Loading tags…</span>
                  ) : null}
                  {logFilterTabs.map(({ id, label }) => {
                    const active = logTag === id;
                    return (
                      <button
                        key={id || 'all'}
                        type="button"
                        aria-pressed={active}
                        className={`btn mb-0 logs-tag-chip ${active ? 'is-active' : ''}`}
                        onClick={() => dispatch(setLogTag(id))}
                        disabled={loading || logTagsStatus === 'loading'}
                        title={id || 'All tags'}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {logTagsStatus === 'failed' ? (
                <p className="text-xs text-danger mb-0 mt-2">Could not load updated tags.</p>
              ) : null}
            </div>

            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading logs…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="logs-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
                className="list-data-table--logs"
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th className="ps-3 text-nowrap">S.No</th>
                      {isVisible('user') ? <th className="text-nowrap">User</th> : null}
                      <th
                        className="text-nowrap list-data-table-sortable"
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('action')}
                        onDoubleClick={() => handleSort('action', true)}
                      >
                        Action
                        {renderSortIcon('action')}
                      </th>
                      {isVisible('url') ? (
                        <th
                          className="text-nowrap list-data-table-sortable"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('url')}
                          onDoubleClick={() => handleSort('url', true)}
                        >
                          URL
                          {renderSortIcon('url')}
                        </th>
                      ) : null}
                      {isVisible('human_readable_description') ? (
                        <th
                          className="text-nowrap list-data-table-sortable"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('human_readable_description')}
                          onDoubleClick={() => handleSort('human_readable_description', true)}
                        >
                          Description
                          {renderSortIcon('human_readable_description')}
                        </th>
                      ) : null}
                      {isVisible('tags') ? <th className="text-nowrap">Tags</th> : null}
                      {isVisible('status') ? (
                        <th
                          className="text-nowrap list-data-table-sortable"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('status')}
                          onDoubleClick={() => handleSort('status', true)}
                        >
                          Status
                          {renderSortIcon('status')}
                        </th>
                      ) : null}
                      {isVisible('createdAt') ? (
                        <th
                          className="text-nowrap pe-3 list-data-table-sortable"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCount} className="logs-empty-cell">
                          <div className="logs-empty-state">
                            <div className="logs-empty-icon" aria-hidden="true">
                              <i className="fas fa-inbox" />
                            </div>
                            <p className="logs-empty-title mb-1">No log entries found</p>
                            <p className="text-sm text-muted mb-0">
                              {hasActiveFilters
                                ? 'Try adjusting your filters or search terms.'
                                : 'Activity will appear here as users perform actions.'}
                            </p>
                            {hasActiveFilters ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary mb-0 mt-3"
                                onClick={clearAllFilters}
                              >
                                Clear filters
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const tags = Array.isArray(item.tags) ? item.tags : [];
                        const creatorName =
                          item?.created_by?.name ||
                          item?.createdBy?.name ||
                          item?.user?.name ||
                          item?.created_by_name ||
                          item?.createdByName ||
                          item?.userName ||
                          (typeof item?.created_by === 'string' ? item.created_by : '') ||
                          (typeof item?.createdBy === 'string' ? item.createdBy : '') ||
                          '—';
                        const statusValue = String(item.status || '').toLowerCase();
                        return (
                          <tr key={item._id || index} className="logs-data-row">
                            <td className="text-sm font-weight-normal ps-3 text-muted">
                              {seriesNumber}
                            </td>
                            {isVisible('user') ? (
                              <td className="text-sm font-weight-normal">
                                <span className="logs-user-name">{creatorName}</span>
                              </td>
                            ) : null}
                            <td className="text-sm font-weight-normal align-middle">
                              <LogDescriptionCell
                                text={item.action ?? item.title ?? item.event}
                                maxWidth="min(16rem, 28vw)"
                              />
                            </td>
                            {isVisible('url') ? (
                              <td className="text-sm font-weight-normal text-break">
                                <LogUrlCell url={item.url} />
                              </td>
                            ) : null}
                            {isVisible('human_readable_description') ? (
                              <td className="text-sm font-weight-normal align-middle">
                                <LogHumanReadablePreviewCell
                                  fullText={getLogHumanReadableDescription(item, nameMaps)}
                                  cartProducts={extractBeforeAfterProductsFromItem(item, nameMaps)}
                                  onOpen={setLogDetails}
                                />
                              </td>
                            ) : null}
                            {isVisible('tags') ? (
                              <td className="text-sm font-weight-normal">
                                <div className="d-flex flex-wrap gap-1">
                                  {tags.length === 0 ? (
                                    <span className="text-muted">—</span>
                                  ) : (
                                    tags.map((t) => (
                                      <span key={t} className="badge logs-tag-badge" title={t}>
                                        {toPrettyTagLabel(t)}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                            ) : null}
                            {isVisible('status') ? (
                              <td className="text-sm font-weight-normal">
                                <span
                                  className={`badge logs-status-badge ${
                                    statusValue === 'active'
                                      ? 'logs-status-badge--active'
                                      : 'logs-status-badge--muted'
                                  }`}
                                >
                                  {item.status || '—'}
                                </span>
                              </td>
                            ) : null}
                            {isVisible('createdAt') ? (
                              <td
                                className="text-sm font-weight-normal pe-3 text-nowrap"
                                title={
                                  item.createdAt || item.created_at
                                    ? moment(item.createdAt || item.created_at).format(
                                        'MM-DD-YYYY h:mm a'
                                      )
                                    : undefined
                                }
                              >
                                {item.createdAt || item.created_at
                                  ? moment(item.createdAt || item.created_at).fromNow()
                                  : '—'}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </ListDataTable>
            </div>
          </div>
        </div>
      </div>

      <LogDetailsModal
        open={logDetails != null}
        text={logDetails?.text ?? ''}
        cartProducts={logDetails?.cartProducts ?? null}
        onClose={() => setLogDetails(null)}
      />
    </div>
  );
};

export default Logs;
