import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { FaCartShopping, FaCircleCheck, FaPrint, FaTruck } from 'react-icons/fa6';
import ListDataTable from '../list/ListDataTable.jsx';
import ListSortableTh from '../list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../list/ColumnVisibilityMenu.jsx';
import ConfirmDialog from '../support/ConfirmDialog.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import { orderStatusBadgeClass } from './orderStatusBadge.js';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';
import { getCompanyIdFromUser, pickCompanyLogoUrl } from '../../features/company/companyAPI.js';
import {
  buildOrderItemByOriginCompanyQuery,
  fetchOrderItemsByOriginCompanyRequest,
  markOrderItemAsDeliveredRequest,
  bulkMarkOrderItemsAsDeliveredRequest,
  ORDER_ITEM_BY_ORIGIN_COMPANY_PATH,
} from '../../features/orders/ordersAPI.js';
import {
  fetchReceivedStoreRequestsRequest,
  fetchSentStoreRequestsRequest,
  normalizeConnectionSyncSettings,
} from '../../features/bigCommerce/bigCommerceAPI.js';
import { buildApiUrl } from '../../config/apiConfig.js';
import NavIcon from '../NavIcon.jsx';
import { toast } from '../../utils/toast.js';
import { selectAuthUser, selectCompany } from '../../features/user/userSlice.js';
import {
  isVariableParentProduct,
  sellablePosProductId,
} from '../product/productVariationUtils.js';
import { getProductAvailableStock } from '../../utils/productStock.js';
import { appendLinesToPosCartSession } from '../../utils/posCartSession.js';

const DELIVERED_FILTER_OPTIONS = [
  { value: '', label: 'All items' },
  { value: 'undelivered', label: 'Undelivered' },
  { value: 'delivered', label: 'Delivered' },
];

const COLUMNS = [
  { key: 'sno', label: '#', alwaysVisible: true },
  { key: 'order_no', label: 'Order no', alwaysVisible: true },
  { key: 'product', label: 'Product' },
  { key: 'destination_company', label: 'Company' },
  { key: 'qty', label: 'Qty' },
  { key: 'status', label: 'Status' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'dates', label: 'Created / Updated' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function pickRefId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  const rec = asRecord(value);
  if (!rec) return '';
  return String(rec._id ?? rec.id ?? '').trim();
}

function pickOrderItemId(row) {
  const rec = asRecord(row);
  if (!rec) return '';
  return pickRefId(rec) || String(rec.order_item_id ?? rec.orderItemId ?? '').trim();
}

function companyDisplayName(value) {
  const rec = asRecord(value);
  if (!rec) return '';
  return String(rec.company_name ?? rec.companyName ?? rec.name ?? '').trim();
}

function productDisplayName(row) {
  const product = asRecord(row?.product_id);
  const fromProduct = product
    ? String(product.product_name ?? product.productName ?? product.name ?? '').trim()
    : '';
  return fromProduct || String(row?.name ?? '').trim();
}

function productSku(row) {
  const product = asRecord(row?.product_id);
  return String(
    product?.sku ?? product?.product_code ?? product?.productCode ?? row?.sku ?? ''
  ).trim();
}

/** Prefer product barcode, then SKU / product code for print barcodes. */
function productBarcodeValue(row) {
  const product = asRecord(row?.product_id);
  const fromProduct = String(
    product?.barcode ?? row?.barcode ?? ''
  ).trim();
  if (fromProduct) return fromProduct;
  return productSku(row);
}

function escapePrintHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrintQty(qty) {
  if (!Number.isFinite(qty)) return '1';
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
}

function printOriginItemsOnPaper(lines, { companyName = '', printedAt = '' } = {}) {
  if (typeof window === 'undefined') return false;

  const totalQty = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  const rowsHtml = lines
    .map(
      (line, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapePrintHtml(line.orderNo || '—')}</td>
        <td>${escapePrintHtml(line.productName || '—')}</td>
        <td class="barcode">${escapePrintHtml(line.barcode || '—')}</td>
        <td class="qty">${escapePrintHtml(formatPrintQty(line.qty))}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Order items</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 16px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    td.qty, th.qty { text-align: right; white-space: nowrap; font-weight: 700; }
    td.barcode { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
    tfoot td { font-weight: 700; }
  </style>
</head>
<body>
  <h1>Bigcommerce order items</h1>
  <div class="meta">
    ${escapePrintHtml(companyName || 'Origin company')}
    ${printedAt ? ` · Printed ${escapePrintHtml(printedAt)}` : ''}
    · ${lines.length} line${lines.length === 1 ? '' : 's'}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Order no</th>
        <th>Product</th>
        <th>Barcode</th>
        <th class="qty">Qty</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total qty</td>
        <td class="qty">${escapePrintHtml(formatPrintQty(totalQty))}</td>
      </tr>
    </tfoot>
  </table>
  <script>window.addEventListener('load', function () { window.focus(); window.print(); });</script>
</body>
</html>`;

  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const popup = window.open(blobUrl, '_blank', 'width=920,height=1100');
  if (!popup) {
    URL.revokeObjectURL(blobUrl);
    return false;
  }
  popup.addEventListener('load', () => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (_) {
      /* ignore */
    }
  });
  return true;
}

function orderNoFromRow(row) {
  const order = asRecord(row?.order_id);
  if (order) {
    const no = String(order.order_no ?? order.orderNo ?? '').trim();
    if (no) return no;
  }
  return '';
}

function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === '') return false;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'delivered';
}

function isDeliveredByVendor(row) {
  const rec = asRecord(row);
  if (!rec) return false;
  const value =
    rec.mark_as_delivered_by_vendor ??
    rec.markAsDeliveredByVendor ??
    rec.delivered_by_vendor ??
    rec.deliveredByVendor ??
    rec.is_delivered_by_vendor ??
    rec.isDeliveredByVendor ??
    rec.vendor_delivered ??
    rec.vendorDelivered;
  if (value != null && value !== '') return isTruthyFlag(value);
  const deliveredAt = rec.delivered_at ?? rec.deliveredAt ?? rec.mark_as_delivered_at;
  return Boolean(deliveredAt);
}

function deliveredOverridesStorageKey(companyId) {
  return `ai-pos.origin-item-delivered:${companyId || 'anon'}`;
}

function readDeliveredOverrides(companyId) {
  if (typeof sessionStorage === 'undefined') return new Map();
  try {
    const raw = sessionStorage.getItem(deliveredOverridesStorageKey(companyId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return new Map();
    return new Map(Object.entries(obj).map(([id, value]) => [String(id), isTruthyFlag(value)]));
  } catch {
    return new Map();
  }
}

function writeDeliveredOverrides(companyId, overrides) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      deliveredOverridesStorageKey(companyId),
      JSON.stringify(Object.fromEntries(overrides))
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function applyDeliveredOverrides(rows, overrides) {
  if (!Array.isArray(rows) || !overrides || overrides.size === 0) return rows;
  return rows.map((row) => {
    const id = pickOrderItemId(row);
    if (!id || !overrides.has(id)) return row;
    return { ...row, mark_as_delivered_by_vendor: overrides.get(id) };
  });
}

function rowHasDeliveredFlag(row) {
  const rec = asRecord(row);
  if (!rec) return false;
  return (
    rec.mark_as_delivered_by_vendor != null ||
    rec.markAsDeliveredByVendor != null ||
    rec.delivered_by_vendor != null ||
    rec.deliveredByVendor != null ||
    rec.is_delivered_by_vendor != null ||
    rec.isDeliveredByVendor != null ||
    rec.vendor_delivered != null ||
    rec.vendorDelivered != null
  );
}

/** When the list is filtered, rows without the flag still match that filter. */
function stampDeliveredFromFilter(rows, deliveredFilter) {
  if (!Array.isArray(rows)) return rows;
  if (deliveredFilter !== 'delivered' && deliveredFilter !== 'undelivered') return rows;
  const delivered = deliveredFilter === 'delivered';
  return rows.map((row) => {
    if (rowHasDeliveredFlag(row)) return row;
    return { ...row, mark_as_delivered_by_vendor: delivered };
  });
}

function rowsMatchingDeliveredFilter(rows, deliveredFilter) {
  if (!Array.isArray(rows)) return [];
  if (deliveredFilter !== 'delivered' && deliveredFilter !== 'undelivered') return rows;
  const wantDelivered = deliveredFilter === 'delivered';
  return rows.filter((row) => isDeliveredByVendor(row) === wantDelivered);
}

function destinationCompanyIdFromRow(row) {
  return pickRefId(row?.company_id ?? row?.companyId);
}

function connectionAllowsVendorOrderSync(row) {
  return normalizeConnectionSyncSettings(row).sync_order_to_vendor !== 'no';
}

function approvedConnectionRows(result) {
  const grouped = result?.grouped;
  if (Array.isArray(grouped?.approved)) return grouped.approved;
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows.filter((row) => String(row?.status || '').toLowerCase() === 'approved');
}

function partnerStoreFromConnection(row, ownCompanyId) {
  const own = String(ownCompanyId || '').trim();
  const sender = row?.sender_company || row?.sender_company_id || row?.from_company_id || row?.company_id;
  const target = row?.target_company_id || row?.target_company || row?.to_company_id;
  const senderId = pickRefId(sender);
  const targetId = pickRefId(target);
  const pick = (value, id) => {
    if (!id) return null;
    const rec = asRecord(value);
    return {
      id,
      name: companyDisplayName(rec) || id,
    };
  };
  if (own && senderId && senderId !== own) return pick(sender, senderId);
  if (own && targetId && targetId !== own) return pick(target, targetId);
  if (targetId && targetId !== own) return pick(target, targetId);
  if (senderId && senderId !== own) return pick(sender, senderId);
  return pick(target, targetId) || pick(sender, senderId);
}

function orderStatusFromRow(row) {
  const order = asRecord(row?.order_id);
  return String(order?.order_status ?? order?.orderStatus ?? '').trim();
}

function rowSelectionId(row, index = 0) {
  return pickRefId(row) || `origin-item-${index}`;
}

function parseLineQty(row) {
  const raw = row?.qty ?? row?.quantity ?? 1;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseLinePrice(row, product) {
  const raw =
    row?.price ??
    row?.unit_price ??
    row?.unitPrice ??
    product?.product_price ??
    product?.price ??
    0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cartLineFromOrderItem(row) {
  const product = asRecord(row?.product_id) || asRecord(row?.productId);
  if (product && isVariableParentProduct(product)) return { error: 'variable' };
  const productId =
    sellablePosProductId(product) || pickRefId(product) || pickRefId(row?.product_id ?? row?.productId);
  if (!productId) return { error: 'missing' };
  const categoryId = String(
    product?.category_id ??
      product?.categoryId ??
      product?.category?._id ??
      product?.category?.id ??
      ''
  ).trim();
  const availableStock = getProductAvailableStock(product);
  return {
    productId,
    name: productDisplayName(row) || 'Product',
    unitPrice: parseLinePrice(row, product),
    quantity: parseLineQty(row),
    ...(availableStock != null && Number.isFinite(availableStock) ? { availableStock } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
  };
}

function CompanyCell({ company }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const name = companyDisplayName(company) || '—';
  const logoUrl = pickCompanyLogoUrl(asRecord(company));
  const showLogo = Boolean(logoUrl) && !logoFailed;
  return (
    <span
      className="d-inline-flex align-items-center gap-2"
      title={name === '—' ? undefined : name}
      aria-label={name}
    >
      {showLogo ? (
        <span className="list-origin-logo-wrap flex-shrink-0">
          <img
            src={logoUrl}
            alt=""
            className="list-origin-logo"
            onError={() => setLogoFailed(true)}
          />
        </span>
      ) : null}
      <span className="list-cell-name-wrap">{name}</span>
    </span>
  );
}

function buildSourceEntry({ url, status, durationMs = null, error = null }) {
  return {
    key: 'origin-company-order-items',
    label: 'Bigcommerce orders (origin company)',
    url,
    status,
    durationMs,
    error,
  };
}

/**
 * Vendor view of marketplace line items (`GET order_item/by-origin-company`).
 */
export default function OriginCompanyOrderItemsList({
  search = '',
  onApiSourceChange,
  canDelete = false,
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [reloadKey, setReloadKey] = useState(0);
  const [deliveredFilter, setDeliveredFilter] = useState('undelivered');
  const [storeCompanyId, setStoreCompanyId] = useState('');
  const [connectedStores, setConnectedStores] = useState([]);
  const [storesStatus, setStoresStatus] = useState('idle');
  const [deliveringId, setDeliveringId] = useState('');
  const [pendingDeliver, setPendingDeliver] = useState(null);
  const [pendingBulkDeliver, setPendingBulkDeliver] = useState(null);
  const [bulkDelivering, setBulkDelivering] = useState(false);
  const [selectedById, setSelectedById] = useState(() => new Map());
  const [addingToCart, setAddingToCart] = useState(false);
  const selectAllRef = useRef(null);
  const deliveredOverridesRef = useRef(new Map());
  const connectedStoresRef = useRef([]);
  const storesStatusRef = useRef('idle');

  const authUser = useSelector(selectAuthUser);
  const authCompany = useSelector(selectCompany);
  const companyId = useMemo(
    () =>
      getCompanyIdFromUser(authUser) || String(authCompany?._id ?? authCompany?.id ?? '').trim(),
    [authUser, authCompany]
  );
  const userId = useMemo(
    () => String(authUser?._id ?? authUser?.id ?? '').trim(),
    [authUser]
  );

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    'origin-company-order-items',
    COLUMNS
  );

  const searchTerm = String(search || '').trim();

  connectedStoresRef.current = connectedStores;
  storesStatusRef.current = storesStatus;

  useEffect(() => {
    deliveredOverridesRef.current = readDeliveredOverrides(companyId);
    setRows((prev) =>
      rowsMatchingDeliveredFilter(
        applyDeliveredOverrides(prev, deliveredOverridesRef.current),
        deliveredFilter
      )
    );
  }, [companyId, deliveredFilter]);

  const rememberDelivered = useCallback(
    (ids, delivered) => {
      const next = new Map(deliveredOverridesRef.current);
      (Array.isArray(ids) ? ids : [ids]).forEach((id) => {
        const key = String(id || '').trim();
        if (!key) return;
        next.set(key, delivered);
      });
      deliveredOverridesRef.current = next;
      writeDeliveredOverrides(companyId, next);
      setRows((prev) =>
        rowsMatchingDeliveredFilter(applyDeliveredOverrides(prev, next), deliveredFilter)
      );
      setSelectedById((prev) => {
        if (prev.size === 0) return prev;
        const updated = new Map();
        prev.forEach((row, id) => {
          const nextRow = applyDeliveredOverrides([row], next)[0];
          if (
            (deliveredFilter === 'delivered' || deliveredFilter === 'undelivered') &&
            isDeliveredByVendor(nextRow) !== (deliveredFilter === 'delivered')
          ) {
            return;
          }
          updated.set(id, nextRow);
        });
        return updated;
      });
    },
    [companyId, deliveredFilter]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, storeCompanyId, deliveredFilter]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      search: searchTerm,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
      companyId: storeCompanyId,
      deliveredFilter,
    }),
    [page, limit, searchTerm, sort.sortBy, sort.sortOrder, storeCompanyId, deliveredFilter]
  );

  const requestUrl = useMemo(() => {
    const { query } = buildOrderItemByOriginCompanyQuery(queryParams);
    const qs = query.toString();
    return buildApiUrl(`${ORDER_ITEM_BY_ORIGIN_COMPANY_PATH}${qs ? `?${qs}` : ''}`);
  }, [queryParams]);

  useEffect(() => {
    let cancelled = false;
    setStoresStatus('loading');
    Promise.all([fetchReceivedStoreRequestsRequest(), fetchSentStoreRequestsRequest()])
      .then(([received, sent]) => {
        if (cancelled) return;
        const byId = new Map();
        const blocked = new Set();
        [...approvedConnectionRows(received), ...approvedConnectionRows(sent)].forEach((row) => {
          const store = partnerStoreFromConnection(row, companyId);
          if (!store?.id) return;
          if (!connectionAllowsVendorOrderSync(row)) {
            blocked.add(store.id);
            byId.delete(store.id);
            return;
          }
          if (blocked.has(store.id) || byId.has(store.id)) return;
          byId.set(store.id, store);
        });
        const list = Array.from(byId.values()).sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        setConnectedStores(list);
        setStoresStatus('succeeded');
      })
      .catch(() => {
        if (cancelled) return;
        setConnectedStores([]);
        setStoresStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (storesStatus !== 'succeeded') return;
    const allowed = new Set(connectedStores.map((store) => store.id).filter(Boolean));
    setRows((prev) => prev.filter((row) => allowed.has(destinationCompanyIdFromRow(row))));
    if (storeCompanyId && !allowed.has(storeCompanyId)) {
      setStoreCompanyId('');
    }
  }, [storesStatus, connectedStores, storeCompanyId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      onApiSourceChange?.(buildSourceEntry({ url: requestUrl, status: 'loading' }));
      const started = performance.now();
      try {
        const result = await fetchOrderItemsByOriginCompanyRequest(queryParams);
        if (cancelled) return;
        const data = applyDeliveredOverrides(
          stampDeliveredFromFilter(
            Array.isArray(result?.data) ? result.data : [],
            queryParams.deliveredFilter
          ),
          deliveredOverridesRef.current
        );
        const allowedCompanyIds = new Set(
          connectedStoresRef.current.map((store) => store.id).filter(Boolean)
        );
        const companyFiltered =
          storesStatusRef.current === 'succeeded'
            ? data.filter((row) => allowedCompanyIds.has(destinationCompanyIdFromRow(row)))
            : data;
        const filteredData = rowsMatchingDeliveredFilter(
          companyFiltered,
          queryParams.deliveredFilter
        );
        const nextTotal = Number(result?.total) || 0;
        const nextLimit = Number(result?.limit) || limit;
        const nextTotalPages =
          Number(result?.totalPages) ||
          (nextLimit > 0 ? Math.ceil(nextTotal / nextLimit) : 0);
        setRows(filteredData);
        setTotal(nextTotal);
        setTotalPages(nextTotalPages);
        setStatus('succeeded');
        onApiSourceChange?.(
          buildSourceEntry({
            url: requestUrl,
            status: 'success',
            durationMs: Math.round(performance.now() - started),
          })
        );
      } catch (err) {
        if (cancelled) return;
        const message = err?.message || 'Failed to load origin company order items.';
        setRows([]);
        setTotal(0);
        setTotalPages(0);
        setError(message);
        setStatus('failed');
        onApiSourceChange?.(
          buildSourceEntry({
            url: requestUrl,
            status: 'error',
            durationMs: Math.round(performance.now() - started),
            error: message,
          })
        );
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent setter is stable
  }, [queryParams, requestUrl, reloadKey, storesStatus]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const storeOptions = useMemo(() => {
    const byId = new Map();
    connectedStores.forEach((store) => {
      if (store?.id) byId.set(store.id, store);
    });
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [connectedStores]);

  const storeSelectOptions = useMemo(
    () => [
      { value: '', label: 'All companies' },
      ...storeOptions.map((store) => ({ value: store.id, label: store.name })),
    ],
    [storeOptions]
  );

  const selectablePageIds = useMemo(
    () => rows.map((row, index) => rowSelectionId(row, index)).filter(Boolean),
    [rows]
  );
  const allPageSelected =
    selectablePageIds.length > 0 && selectablePageIds.every((id) => selectedById.has(id));
  const somePageSelected =
    selectablePageIds.some((id) => selectedById.has(id)) && !allPageSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  const toggleRowSelected = useCallback((row, index) => {
    const id = rowSelectionId(row, index);
    if (!id) return;
    setSelectedById((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, row);
      return next;
    });
  }, []);

  const toggleSelectAllPage = useCallback(() => {
    setSelectedById((prev) => {
      const next = new Map(prev);
      if (allPageSelected) {
        selectablePageIds.forEach((id) => next.delete(id));
        return next;
      }
      rows.forEach((row, index) => {
        const id = rowSelectionId(row, index);
        if (id) next.set(id, row);
      });
      return next;
    });
  }, [allPageSelected, rows, selectablePageIds]);

  const handlePrintSelected = useCallback(() => {
    const selectedRows = Array.from(selectedById.values());
    if (selectedRows.length === 0) {
      toast.warning('Select at least one item to print.');
      return;
    }

    const lines = selectedRows.map((row) => ({
      orderNo: orderNoFromRow(row) || '—',
      productName: productDisplayName(row) || '—',
      barcode: productBarcodeValue(row),
      qty: parseLineQty(row),
    }));

    const opened = printOriginItemsOnPaper(lines, {
      companyName: companyDisplayName(authCompany) || 'Origin company',
      printedAt: moment().format('DD MMM YYYY h:mm a'),
    });
    if (!opened) {
      toast.error('Allow pop-ups to print the selected items.');
    }
  }, [authCompany, selectedById]);

  const handleAddSelectedToCart = useCallback(() => {
    if (addingToCart) return;
    const selectedRows = Array.from(selectedById.values());
    if (selectedRows.length === 0) {
      toast.warning('Select at least one item to add to cart.');
      return;
    }

    const lines = [];
    let skippedVariable = 0;
    let skippedMissing = 0;
    selectedRows.forEach((row) => {
      const mapped = cartLineFromOrderItem(row);
      if (mapped?.error === 'variable') {
        skippedVariable += 1;
        return;
      }
      if (!mapped || mapped.error) {
        skippedMissing += 1;
        return;
      }
      lines.push(mapped);
    });

    if (lines.length === 0) {
      if (skippedVariable > 0) {
        toast.warning(
          'Selected items are variable products. Add a size/color variation from POS instead.'
        );
      } else {
        toast.error('Could not add to cart: missing product on the selected items.');
      }
      return;
    }

    if (!companyId || !userId) {
      toast.error('Sign in is required to add items to cart.');
      return;
    }

    setAddingToCart(true);
    try {
      const result = appendLinesToPosCartSession({ companyId, userId, lines });
      const stacked = result.added + result.merged;
      if (stacked <= 0) {
        toast.error('Could not add the selected items to cart.');
        return;
      }
      setSelectedById(new Map());
      const extra =
        skippedVariable || skippedMissing
          ? ` ${skippedVariable + skippedMissing} item${skippedVariable + skippedMissing === 1 ? '' : 's'} skipped.`
          : '';
      toast.success(
        stacked === 1
          ? `Added 1 item to POS cart.${extra}`
          : `Added ${stacked} items to POS cart.${extra}`
      );
    } catch (err) {
      toast.error(err?.message || 'Failed to add items to cart.');
    } finally {
      setAddingToCart(false);
    }
  }, [addingToCart, companyId, selectedById, userId]);

  const handleAskDeliver = useCallback((row, delivered) => {
    const itemId = pickOrderItemId(row);
    if (!itemId) {
      toast.error(
        delivered
          ? 'Could not mark as delivered: missing order item id.'
          : 'Could not unmark delivered: missing order item id.'
      );
      return;
    }
    setPendingDeliver({
      itemId,
      orderNo: orderNoFromRow(row) || itemId,
      productName: productDisplayName(row) || '',
      delivered,
    });
  }, []);

  const handleConfirmDeliver = useCallback(async () => {
    if (!pendingDeliver?.itemId) return;
    const { itemId, delivered } = pendingDeliver;
    setDeliveringId(itemId);
    try {
      await markOrderItemAsDeliveredRequest(itemId, delivered);
      toast.success(
        delivered ? 'Order line marked as delivered.' : 'Order line is no longer marked as delivered.'
      );
      setPendingDeliver(null);
      rememberDelivered(itemId, delivered);
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(
        err?.message ||
          (delivered ? 'Failed to mark order line as delivered.' : 'Failed to unmark order line as delivered.')
      );
    } finally {
      setDeliveringId('');
    }
  }, [pendingDeliver, rememberDelivered]);

  const selectedDeliverItems = useMemo(() => {
    const items = [];
    const seen = new Set();
    for (const row of selectedById.values()) {
      const itemId = pickOrderItemId(row);
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      items.push({ itemId, delivered: isDeliveredByVendor(row) });
    }
    return items;
  }, [selectedById]);

  const bulkDeliverAction = useMemo(() => {
    if (selectedDeliverItems.length === 0) return { delivered: true, count: 0 };
    const allDelivered = selectedDeliverItems.every((item) => item.delivered);
    return { delivered: !allDelivered, count: selectedDeliverItems.length };
  }, [selectedDeliverItems]);

  const handleAskBulkDeliver = useCallback(() => {
    if (bulkDelivering) return;
    if (selectedDeliverItems.length === 0) {
      toast.warning('Select at least one item to mark as delivered.');
      return;
    }
    setPendingBulkDeliver({
      ids: selectedDeliverItems.map((item) => item.itemId),
      delivered: bulkDeliverAction.delivered,
    });
  }, [bulkDeliverAction.delivered, bulkDelivering, selectedDeliverItems]);

  const handleConfirmBulkDeliver = useCallback(async () => {
    if (!pendingBulkDeliver?.ids?.length) return;
    const { ids, delivered } = pendingBulkDeliver;
    setBulkDelivering(true);
    try {
      await bulkMarkOrderItemsAsDeliveredRequest(ids, delivered);
      toast.success(
        delivered
          ? ids.length === 1
            ? '1 order line marked as delivered.'
            : `${ids.length} order lines marked as delivered.`
          : ids.length === 1
            ? '1 order line unmarked as delivered.'
            : `${ids.length} order lines unmarked as delivered.`
      );
      setPendingBulkDeliver(null);
      setSelectedById(new Map());
      rememberDelivered(ids, delivered);
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(
        err?.message ||
          (delivered
            ? 'Failed to mark selected order lines as delivered.'
            : 'Failed to unmark selected order lines as delivered.')
      );
    } finally {
      setBulkDelivering(false);
    }
  }, [pendingBulkDeliver, rememberDelivered]);

  const handleSort = useCallback((column, isDoubleClick = false) => {
    if (isDoubleClick) {
      setSort({ sortBy: 'createdAt', sortOrder: 'desc' });
      setPage(1);
      return;
    }
    setSort((prev) => {
      if (prev.sortBy === column) {
        return { sortBy: column, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' };
      }
      return { sortBy: column, sortOrder: 'desc' };
    });
    setPage(1);
  }, []);

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh
      column={column}
      label={label}
      sort={sort}
      onSort={handleSort}
      className={`text-center ${className}`.trim()}
    />
  );

  const loading = status === 'loading' || status === 'idle';
  const pagination = { page, limit, total, totalPages };
  const tableColSpan = visibleCount + 1;
  const selectedCount = selectedById.size;

  return (
    <div>
      <div className="d-flex justify-content-end align-items-center flex-wrap gap-2 px-3 pb-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-dark mb-0 d-inline-flex align-items-center"
          onClick={handlePrintSelected}
          disabled={selectedCount === 0}
          title={
            selectedCount === 0
              ? 'Select one or more items to print on paper'
              : `Print ${selectedCount} selected item${selectedCount === 1 ? '' : 's'} on paper`
          }
        >
          <NavIcon icon={FaPrint} className="me-1" size={14} />
          {selectedCount > 0 ? `Print (${selectedCount})` : 'Print'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-success mb-0 d-inline-flex align-items-center"
          onClick={handleAskBulkDeliver}
          disabled={!canDelete || selectedDeliverItems.length === 0 || bulkDelivering}
          title={
            selectedDeliverItems.length === 0
              ? 'Select one or more items to mark as delivered'
              : bulkDeliverAction.delivered
                ? `Mark ${selectedDeliverItems.length} selected item${
                    selectedDeliverItems.length === 1 ? '' : 's'
                  } as delivered`
                : `Unmark ${selectedDeliverItems.length} selected item${
                    selectedDeliverItems.length === 1 ? '' : 's'
                  } as delivered`
          }
        >
          {bulkDelivering ? (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          ) : (
            <NavIcon
              icon={bulkDeliverAction.delivered ? FaTruck : FaCircleCheck}
              className="me-1"
              size={14}
            />
          )}
          {bulkDelivering
            ? bulkDeliverAction.delivered
              ? 'Marking…'
              : 'Unmarking…'
            : selectedDeliverItems.length > 0
              ? bulkDeliverAction.delivered
                ? `Mark delivered (${selectedDeliverItems.length})`
                : `Unmark delivered (${selectedDeliverItems.length})`
              : 'Mark delivered'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary mb-0 d-inline-flex align-items-center"
          onClick={handleAddSelectedToCart}
          disabled={selectedCount === 0 || addingToCart}
          title={
            selectedCount === 0
              ? 'Select one or more items to add to cart'
              : `Add ${selectedCount} selected item${selectedCount === 1 ? '' : 's'} to POS cart`
          }
        >
          {addingToCart ? (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          ) : (
            <NavIcon icon={FaCartShopping} className="me-1" size={14} />
          )}
          {addingToCart
            ? 'Adding…'
            : selectedCount > 0
              ? `Add to cart (${selectedCount})`
              : 'Add to cart'}
        </button>
        <div style={{ minWidth: '10.5rem', maxWidth: '14rem' }}>
          <SearchableSelect
            id="origin-company-delivered-filter"
            options={DELIVERED_FILTER_OPTIONS}
            value={deliveredFilter}
            placeholder="Undelivered"
            searchPlaceholder="Search status…"
            className="form-select-sm mb-0"
            onChange={(next) => setDeliveredFilter(String(next || '').trim())}
          />
        </div>
        <div style={{ minWidth: '11.5rem', maxWidth: '16rem' }}>
          <SearchableSelect
            id="origin-company-store-filter"
            options={storeSelectOptions}
            value={storeCompanyId}
            placeholder="All companies"
            searchPlaceholder="Search companies…"
            className="form-select-sm mb-0"
            disabled={storesStatus === 'loading'}
            loading={storesStatus === 'loading'}
            onChange={(next) => setStoreCompanyId(String(next || '').trim())}
          />
        </div>
        <ColumnVisibilityMenu
          columns={COLUMNS}
          isVisible={isVisible}
          onToggle={toggle}
          onReset={reset}
          id="originCompanyOrderItemsColumnMenu"
        />
      </div>
      <ListDataTable
        className="list-data-table--origin-company-order-items"
        loading={loading}
        loadingLabel={
          deliveredFilter === 'delivered'
            ? 'Loading delivered Bigcommerce orders…'
            : deliveredFilter === 'undelivered'
              ? 'Loading undelivered Bigcommerce orders…'
              : 'Loading Bigcommerce orders…'
        }
        error={error}
        errorPrefix="Error loading Bigcommerce orders"
        onRetry={() => setReloadKey((n) => n + 1)}
        pagination={pagination}
        onPageChange={(nextPage) => {
          if (nextPage >= 1 && nextPage <= Math.max(totalPages, 1)) setPage(nextPage);
        }}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
        selectId="origin-company-order-items-page-size"
        showPagination={!loading && !error && total > 0}
      >
        <table className="table align-items-center mb-0">
          <thead>
            <tr>
              <th className="text-center list-col-sno">#</th>
              <th className="text-center list-col-check">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="form-check-input oms-row-check m-0"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  disabled={selectablePageIds.length === 0}
                  aria-label="Select all Bigcommerce order items on this page"
                />
              </th>
              {isVisible('order_no') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Order no
                </th>
              ) : null}
              {isVisible('product') ? sortableTh('name', 'Product', 'list-col-name-wrap') : null}
              {isVisible('destination_company') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Company
                </th>
              ) : null}
              {isVisible('qty') ? sortableTh('qty', 'Qty', 'list-col-amount') : null}
              {isVisible('status') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Status
                </th>
              ) : null}
              {isVisible('delivery') ? (
                <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                  Delivery
                </th>
              ) : null}
              {isVisible('dates') ? sortableTh('createdAt', 'Created / Updated', 'list-col-date') : null}
              <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 list-col-actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="text-center text-muted py-5">
                  {deliveredFilter === 'delivered'
                    ? 'No delivered Bigcommerce order lines. Try All items or Undelivered.'
                    : deliveredFilter === 'undelivered'
                      ? 'No undelivered Bigcommerce order lines. Try All items or Delivered.'
                      : storeCompanyId
                        ? 'No Bigcommerce orders for this company. Try another company or All companies.'
                        : 'No Bigcommerce orders found. Try adjusting your search.'}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const seriesNumber = (page - 1) * limit + index + 1;
                const key = pickRefId(row) || `origin-item-${index}`;
                const selectionId = rowSelectionId(row, index);
                const isRowSelected = selectedById.has(selectionId);
                const orderNo = orderNoFromRow(row) || '—';
                const productName = productDisplayName(row) || '—';
                const statusVal = orderStatusFromRow(row);
                const created = row?.createdAt ?? row?.created_at;
                const updated = row?.updatedAt ?? row?.updated_at;
                const itemId = pickOrderItemId(row);
                const delivered = isDeliveredByVendor(row);
                const isDelivering = Boolean(itemId) && deliveringId === itemId;
                return (
                  <tr
                    key={key}
                    className={[
                      isRowSelected ? 'table-active' : '',
                      delivered ? 'is-vendor-delivered' : 'is-vendor-undelivered',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td className="text-center text-muted text-sm">{seriesNumber}</td>
                    <td className="text-center list-col-check">
                      <input
                        type="checkbox"
                        className="form-check-input oms-row-check m-0"
                        checked={isRowSelected}
                        disabled={!selectionId}
                        onChange={() => toggleRowSelected(row, index)}
                        aria-label={
                          orderNo !== '—'
                            ? `Select order item ${orderNo}`
                            : `Select order item ${seriesNumber}`
                        }
                      />
                    </td>
                    {isVisible('order_no') ? (
                      <td className="text-sm font-weight-bold text-dark text-center">{orderNo}</td>
                    ) : null}
                    {isVisible('product') ? (
                      <td className="text-sm text-center list-col-name-wrap">
                        <div className="list-cell-name-wrap" title={productName}>
                          {productName}
                        </div>
                      </td>
                    ) : null}
                    {isVisible('destination_company') ? (
                      <td className="text-sm text-center">
                        <CompanyCell company={row?.company_id ?? row?.companyId} />
                      </td>
                    ) : null}
                    {isVisible('qty') ? (
                      <td className="text-sm text-center">{row?.qty ?? '—'}</td>
                    ) : null}
                    {isVisible('status') ? (
                      <td className="text-center">
                        {statusVal ? (
                          <span className={orderStatusBadgeClass(statusVal)}>
                            {formatOrderStatusOptionLabel(statusVal)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    ) : null}
                    {isVisible('delivery') ? (
                      <td className="text-center">
                        <span
                          className={
                            delivered
                              ? 'badge oms-st oms-st-delivered'
                              : 'badge oms-st oms-st-pending'
                          }
                          title={
                            delivered
                              ? 'Marked as delivered by you'
                              : 'Not marked as delivered by you'
                          }
                        >
                          {delivered ? 'Delivered' : 'Undelivered'}
                        </span>
                      </td>
                    ) : null}
                    {isVisible('dates') ? (
                      <td className="text-sm text-center list-col-date">
                        {created || updated ? (
                          <div className="oms-dates-cell">
                            <div
                              className="text-nowrap"
                              title={
                                created ? moment(created).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {created ? moment(created).format('DD MMM YYYY h:mm a') : '—'}
                            </div>
                            <div
                              className="oms-dates-cell__updated text-nowrap"
                              title={
                                updated ? moment(updated).format('DD MMM YYYY h:mm a') : undefined
                              }
                            >
                              {updated ? `Updated ${moment(updated).fromNow()}` : '—'}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td className="text-center list-col-actions">
                      <button
                        type="button"
                        className={`btn btn-link mb-0 p-1 d-inline-flex align-items-center justify-content-center ${
                          delivered ? 'text-success' : 'text-secondary'
                        }`}
                        title={delivered ? 'Delivered — click to unmark' : 'Undelivered — click to mark as delivered'}
                        aria-label={
                          orderNo !== '—'
                            ? delivered
                              ? `Unmark order line ${orderNo} as delivered`
                              : `Mark order line ${orderNo} as delivered`
                            : delivered
                              ? 'Unmark order line as delivered'
                              : 'Mark order line as delivered'
                        }
                        onClick={() => handleAskDeliver(row, !delivered)}
                        disabled={!canDelete || !itemId || isDelivering}
                      >
                        {isDelivering ? (
                          <span
                            className={`spinner-border spinner-border-sm ${
                              delivered ? 'text-success' : 'text-secondary'
                            }`}
                            role="status"
                            aria-hidden="true"
                          />
                        ) : (
                          <NavIcon
                            icon={delivered ? FaCircleCheck : FaTruck}
                            size={16}
                            className={delivered ? 'text-success' : 'text-secondary'}
                          />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ListDataTable>
      <ConfirmDialog
        open={Boolean(pendingDeliver)}
        title={pendingDeliver?.delivered ? 'Mark as delivered' : 'Unmark delivered'}
        message={
          pendingDeliver?.delivered
            ? `Mark ${
                pendingDeliver.productName ? `"${pendingDeliver.productName}" on ` : ''
              }order "${pendingDeliver.orderNo}" as delivered by you?`
            : `Remove the delivered mark from ${
                pendingDeliver?.productName ? `"${pendingDeliver.productName}" on ` : ''
              }order "${pendingDeliver?.orderNo}"?`
        }
        confirmLabel={pendingDeliver?.delivered ? 'Mark delivered' : 'Unmark'}
        cancelLabel="Cancel"
        variant="primary"
        loading={Boolean(deliveringId)}
        onConfirm={handleConfirmDeliver}
        onClose={() => {
          if (!deliveringId) setPendingDeliver(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingBulkDeliver)}
        title={pendingBulkDeliver?.delivered ? 'Mark selected as delivered' : 'Unmark selected as delivered'}
        message={
          pendingBulkDeliver?.delivered
            ? `Mark ${pendingBulkDeliver.ids.length} selected order line${
                pendingBulkDeliver.ids.length === 1 ? '' : 's'
              } as delivered by you?`
            : `Remove the delivered mark from ${pendingBulkDeliver?.ids?.length || 0} selected order line${
                pendingBulkDeliver?.ids?.length === 1 ? '' : 's'
              }?`
        }
        confirmLabel={pendingBulkDeliver?.delivered ? 'Mark delivered' : 'Unmark'}
        cancelLabel="Cancel"
        variant="primary"
        loading={bulkDelivering}
        onConfirm={handleConfirmBulkDeliver}
        onClose={() => {
          if (!bulkDelivering) setPendingBulkDeliver(null);
        }}
      />
    </div>
  );
}
