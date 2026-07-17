import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  FaArrowsRotate,
  FaCloudArrowUp,
  FaFilter,
  FaClockRotateLeft,
  FaListCheck,
  FaHourglassStart,
  FaMoneyBillWave,
  FaHand,
  FaBoxOpen,
  FaCircleCheck,
  FaBox,
  FaCodeBranch,
  FaLayerGroup,
  FaFlag,
  FaTruckFast,
  FaTruck,
  FaRoad,
  FaClock,
  FaTriangleExclamation,
  FaRotateLeft,
  FaBoxArchive,
  FaBan,
  FaUserClock,
  FaTrash,
} from 'react-icons/fa6';
import {
  fetchOrders,
  fetchDeletedOrders,
  deleteOrder,
  setSearch,
  setDateFilters,
  clearDateFilters,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/orders/ordersSlice.js';
import {
  pickInvoiceRouteId,
  pickOrderDocumentId,
  getNoOfItemsDisplay,
  fetchAllOrdersForExportRequest,
  DELETED_ORDER_BY_ORDER_ITEM_PATH,
} from '../../features/orders/ordersAPI.js';
import {
  ORDER_DETAIL_EXPORT_COLUMNS,
  mapOrdersToDetailExportRows,
} from '../../features/orders/orderExportMapper.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import FetchOrdersModal from '../../components/order/FetchOrdersModal.jsx';
import SyncOrdersModal from '../../components/order/SyncOrdersModal.jsx';
import CreateShipmentModal from '../../components/order/CreateShipmentModal.jsx';
import ParcelBarcodePrintModal from '../../components/order/ParcelBarcodePrintModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import { fetchIntegrationsRequest } from '../../features/integration/integrationAPI.js';
import { createBulkSyncOrderProcessRequest } from '../../features/process/processAPI.js';
import {
  resolveOrderTrackingInfo,
} from '../../features/courier/courierAPI.js';
import { DEBUG } from '../../config/env.js';
import { posInvoiceRoutePath } from '../../config/appBase.js';
import { toast } from '../../utils/toast.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import {
  integrationNameFromRecord,
  storeTypeLabel,
} from '../integration/integrationForm.js';
import { pickIntegrationStoreLogoUrl } from '../../features/integration/integrationAPI.js';
import './orders-list-page.css';

const normalizeStatusKey = (raw) => {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  return s.replace(/\s+/g, '_').replace(/-+/g, '_');
};

const orderStatusKey = (row) => {
  const raw = row?.order_status ?? row?.orderStatus ?? row?.status ?? '';
  return normalizeStatusKey(raw);
};

const pickOrderCreatedAt = (row) => row?.createdAt ?? row?.created_at ?? row?.date ?? null;

const isWithinLastHours = (dt, hours) => {
  if (!dt) return false;
  const ts = Date.parse(String(dt));
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= hours * 60 * 60 * 1000;
};

const tileGradientClass = (variant) => {
  const v = String(variant || '').trim().toLowerCase();
  if (!v) return 'bg-gradient-secondary';
  // Map to existing theme classes (Argon/Bootstrap)
  if (v === 'primary') return 'bg-gradient-primary';
  if (v === 'info') return 'bg-gradient-info';
  if (v === 'success') return 'bg-gradient-success';
  if (v === 'warning') return 'bg-gradient-warning';
  if (v === 'danger') return 'bg-gradient-danger';
  if (v === 'dark') return 'bg-gradient-dark';
  if (v === 'secondary') return 'bg-gradient-secondary';
  return 'bg-gradient-secondary';
};

const buildOmsTileValue = (tile, { data, pagination }) => {
  const type = String(tile?.type || '').trim();
  if (type === 'total') return Number(pagination?.total ?? 0) || 0;
  if (type === 'last24h') {
    // Note: based on currently loaded page data (server list is paginated).
    return (Array.isArray(data) ? data : []).filter((row) =>
      isWithinLastHours(pickOrderCreatedAt(row), 24)
    ).length;
  }

  const match = Array.isArray(tile?.statusKeys) ? tile.statusKeys : [];
  if (!match.length) return 0;

  const set = new Set(match.map((s) => normalizeStatusKey(s)).filter(Boolean));
  return (Array.isArray(data) ? data : []).filter((row) => set.has(orderStatusKey(row))).length;
};

const getOrderStatusDisplay = (row) => {
  if (!row || typeof row !== 'object') return '';
  const v = row.order_status ?? row.orderStatus;
  if (v == null || String(v).trim() === '') return '';
  return String(v).trim();
};

const getOrderItemsTotalDisplay = (row) => {
  if (!row || typeof row !== 'object') return '—';
  const raw = row.order_items_total ?? row.orderItemsTotal ?? row.items_total ?? row.itemsTotal;
  if (raw == null || raw === '') return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const orderDisplayStatus = (row) => {
  const orderStatus = getOrderStatusDisplay(row);
  if (orderStatus) return orderStatus;
  const s = row?.status;
  if (s == null || String(s).trim() === '') return '—';
  return String(s).trim();
};

const getOrderIntegrationRecord = (row) => {
  const integration = row?.integration_id ?? row?.integrationId;
  if (!integration || typeof integration !== 'object' || Array.isArray(integration)) {
    return null;
  }
  return integration;
};

const normalizeStoreBaseUrl = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${path === '/' ? '' : path}`;
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

const buildWooCommerceOrderAdminUrl = (integration, integrationOrderId) => {
  const orderId = String(integrationOrderId ?? '').trim();
  if (!orderId || orderId === '—') return '';

  const storeType = String(integration?.store_type || integration?.storeType || '').toLowerCase();
  if (storeType && storeType !== 'woocommerce') return '';

  const baseUrl = normalizeStoreBaseUrl(
    integration?.url || integration?.store_url || integration?.storeUrl
  );
  if (!baseUrl) return '';

  return `${baseUrl}/wp-admin/admin.php?page=wc-orders&action=edit&id=${encodeURIComponent(orderId)}`;
};

function OrderIntegrationMergedCell({
  integration,
  integrationOrderId,
  wooOrderAdminUrl,
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const hasOrderId = integrationOrderId && integrationOrderId !== '—';

  if (!integration && !hasOrderId) {
    return <span className="text-muted">—</span>;
  }

  const logoSrc = integration ? pickIntegrationStoreLogoUrl(integration) : '';
  const rawName = integration ? integrationNameFromRecord(integration) : '';
  const displayName =
    rawName !== 'Integration'
      ? rawName
      : integration?._id || integration?.id
        ? String(integration._id || integration.id)
        : '';
  const storeType = integration?.store_type || integration?.storeType || '';
  const integrationTitle = storeType
    ? `${displayName} (${storeTypeLabel(storeType)})`
    : displayName;

  const orderIdNode = hasOrderId ? (
    wooOrderAdminUrl ? (
      <a
        href={wooOrderAdminUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-weight-bold text-decoration-none text-nowrap"
        title={`Open WooCommerce order ${integrationOrderId}`}
      >
        {integrationOrderId}
      </a>
    ) : (
      <span className="font-weight-bold text-nowrap" title={String(integrationOrderId)}>
        {integrationOrderId}
      </span>
    )
  ) : null;

  let identityNode = null;
  if (integration) {
    if (logoSrc && !logoFailed) {
      identityNode = (
        <img
          src={logoSrc}
          alt={displayName || 'Integration'}
          title={integrationTitle || undefined}
          className="list-product-thumb flex-shrink-0"
          onError={() => setLogoFailed(true)}
        />
      );
    } else if (displayName) {
      identityNode = (
        <span className="list-cell-truncate-sm text-sm" title={integrationTitle || displayName}>
          {displayName}
        </span>
      );
    }
  }

  if (!identityNode && !orderIdNode) {
    return <span className="text-muted">—</span>;
  }

  return (
    <div className="d-flex flex-column align-items-start gap-1 min-width-0">
      {identityNode}
      {orderIdNode}
    </div>
  );
}

/** Orders table columns. `sno`, `order_no`, `actions` are always visible. */
const ORDER_COLUMNS = [
  { key: 'sno', label: '#', alwaysVisible: true },
  { key: 'order_no', label: 'Order no', alwaysVisible: true },
  { key: 'channel', label: 'Online/Offline' },
  { key: 'integration', label: 'Integration' },
  { key: 'name', label: 'Customer' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'items', label: 'Items' },
  { key: 'total', label: 'Total' },
  { key: 'status', label: 'Status' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Last updated' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

/** True when the order came from an online channel (Woo/Shopify/etc.), else POS/offline. */
function isOnlineOrder(row) {
  if (!row || typeof row !== 'object') return false;

  const explicit = row.is_online ?? row.isOnline ?? row.online;
  if (explicit === true || explicit === 1 || explicit === '1') return true;
  if (explicit === false || explicit === 0 || explicit === '0') return false;
  const explicitStr = String(explicit ?? '')
    .trim()
    .toLowerCase();
  if (explicitStr === 'true' || explicitStr === 'online') return true;
  if (explicitStr === 'false' || explicitStr === 'offline') return false;

  const channel = String(
    row.order_channel ?? row.channel ?? row.source ?? row.order_source ?? row.order_type ?? ''
  )
    .trim()
    .toLowerCase();
  if (
    channel === 'online' ||
    channel === 'web' ||
    channel === 'ecommerce' ||
    channel === 'e-commerce'
  ) {
    return true;
  }
  if (
    channel === 'offline' ||
    channel === 'pos' ||
    channel === 'in_store' ||
    channel === 'instore' ||
    channel === 'in-store'
  ) {
    return false;
  }

  const integration = row.integration_id ?? row.integrationId;
  if (integration && typeof integration === 'object' && !Array.isArray(integration)) {
    if (integration._id || integration.id) return true;
  }
  if (typeof integration === 'string' && integration.trim()) return true;

  const integrationOrderId = row.integration_order_id ?? row.integrationOrderId;
  if (
    integrationOrderId != null &&
    String(integrationOrderId).trim() !== '' &&
    String(integrationOrderId).trim() !== '—'
  ) {
    return true;
  }

  return false;
}

const channelBadgeClass = (online) =>
  online ? 'bg-gradient-info' : 'bg-gradient-secondary';

const statusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'completed' || s === 'posted' || s === 'delivered') {
    return 'bg-gradient-success';
  }
  if (s === 'pending' || s === 'draft' || s === 'placed') return 'bg-gradient-warning';
  if (s === 'cancelled' || s === 'void' || s === 'refunded') return 'bg-gradient-danger';
  return 'bg-gradient-secondary';
};

/**
 * @param {{
 *   config: {
 *     permissionModule: string,
 *     pageTitle: string,
 *     pageSubtitle?: string,
 *     idPrefix: string,
 *     exportFilePrefix: string,
 *     exportSheetTitle: string,
 *     exportPdfTitle: string,
 *     showFetchSyncToolbar?: boolean,
 *     showRowSyncButton?: boolean,
 *     showIntegrationColumn?: boolean,
 *     showTrackingColumn?: boolean,
 *     showDeletedTab?: boolean,
 *     viewReadOnly?: boolean,
 *     listPath?: string,
 *   },
 * }} props
 */
export default function OrdersListPage({ config }) {
  const {
    permissionModule,
    pageTitle,
    pageSubtitle = '',
    idPrefix,
    exportFilePrefix,
    exportSheetTitle,
    exportPdfTitle,
    showFetchSyncToolbar = false,
    showRowSyncButton = false,
    showIntegrationColumn = false,
    showTrackingColumn = false,
    showDeletedTab = false,
    viewReadOnly = false,
    topSummaryName = '',
    topTiles = null,
    listPath,
  } = config;
  const logLabel = pageTitle;

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    filters,
    sort,
    deleteStatus,
  } = useSelector((state) => state.orders);
  const { canCreate, canEdit, canDelete } = usePermissions(permissionModule);
  useRequireModuleAccess(permissionModule);
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');
  const [editLoadingId, setEditLoadingId] = useState('');
  const [fetchOrdersModalOpen, setFetchOrdersModalOpen] = useState(false);
  const [syncOrdersModalOpen, setSyncOrdersModalOpen] = useState(false);
  const [shipmentModal, setShipmentModal] = useState({ open: false, orderId: '', orderNo: '' });
  const [shipmentOverrides, setShipmentOverrides] = useState({});
  const [parcelBarcodeModal, setParcelBarcodeModal] = useState({
    open: false,
    orderId: '',
    trackingId: '',
    orderNo: '',
    provider: '',
    customerName: '',
    city: '',
  });
  const [syncingOrderId, setSyncingOrderId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(Boolean(filters.startDate || filters.endDate));
  const [showDeleted, setShowDeleted] = useState(false);
  const searchTimeoutRef = useRef(null);
  const isDeletedView = Boolean(showDeletedTab && showDeleted);
  const canViewOrder = canEdit || isDeletedView || viewReadOnly;

  const orderColumns = useMemo(() => {
    let cols = ORDER_COLUMNS;
    if (!showIntegrationColumn) cols = cols.filter((col) => col.key !== 'integration');
    if (!showTrackingColumn) cols = cols.filter((col) => col.key !== 'tracking');
    return cols;
  }, [showIntegrationColumn, showTrackingColumn]);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    permissionModule,
    orderColumns
  );

  const activeFilterCount = (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (listPath) params.listPath = listPath;
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    if (isDeletedView) {
      dispatch(fetchDeletedOrders(params));
    } else {
      dispatch(fetchOrders(params));
    }
  }, [
    dispatch,
    listPath,
    pagination.page,
    pagination.limit,
    searchTerm,
    filters.startDate,
    filters.endDate,
    sort.sortBy,
    sort.sortOrder,
    isDeletedView,
  ]);

  const handleDeletedTabChange = (nextDeleted) => {
    if (Boolean(nextDeleted) === isDeletedView) return;
    setShowDeleted(Boolean(nextDeleted));
    dispatch(setPage(1));
  };

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    setLocalStartDate(filters.startDate || '');
    setLocalEndDate(filters.endDate || '');
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };
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

  const applyDateFilters = () => {
    if (localStartDate && localEndDate && localStartDate > localEndDate) {
      toast.error('From date cannot be later than to date.');
      return;
    }
    dispatch(
      setDateFilters({
        startDate: localStartDate,
        endDate: localEndDate,
      })
    );
  };

  const resetDateFilters = () => {
    setLocalStartDate('');
    setLocalEndDate('');
    dispatch(clearDateFilters());
  };

  const buildExportParams = () => {
    const params = {};
    if (isDeletedView) {
      params.listPath = DELETED_ORDER_BY_ORDER_ITEM_PATH;
    } else if (listPath) {
      params.listPath = listPath;
    }
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    return params;
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const orders = await fetchAllOrdersForExportRequest(buildExportParams());
      if (!orders.length) {
        toast.info('No orders to export.');
        return;
      }
      const mapped = mapOrdersToDetailExportRows(orders);
      const stamp = moment().format('YYYY-MM-DD-HHmm');
      const filename = `${exportFilePrefix}-${stamp}`;
      if (format === 'csv') {
        exportRowsToCsv({ columns: ORDER_DETAIL_EXPORT_COLUMNS, rows: mapped, filename });
      } else if (format === 'excel') {
        exportRowsToExcel({
          columns: ORDER_DETAIL_EXPORT_COLUMNS,
          rows: mapped,
          filename,
          sheetTitle: exportSheetTitle,
        });
      } else if (format === 'pdf') {
        await exportRowsToPdf({
          columns: ORDER_DETAIL_EXPORT_COLUMNS,
          rows: mapped,
          filename,
          title: exportPdfTitle,
        });
      }
      toast.success(
        `Exported ${mapped.length} line(s) from ${orders.length} order(s) as ${format.toUpperCase()}.`
      );
    } catch (err) {
      console.error(`[${logLabel}] export failed`, err);
      toast.error(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh
      column={column}
      label={label}
      sort={sort}
      onSort={handleSort}
      className={className}
    />
  );

  const handleOpenInvoice = async (row) => {
    const rowKey = String(row._id || row.id || row.order_no || row.orderNo || '');
    setEditLoadingId(rowKey);
    try {
      const invoiceId = pickInvoiceRouteId(row);

      if (!invoiceId) {
        console.error(`[${logLabel}] open invoice: could not resolve invoice id`, { row });
        window.alert('Could not open invoice: missing order / invoice reference.');
        return;
      }

      const path = posInvoiceRoutePath(invoiceId);
      const readOnly = viewReadOnly || isDeletedView;
      const query = new URLSearchParams();
      if (readOnly) query.set('readonly', '1');
      if (isDeletedView) query.set('deleted', '1');
      const qs = query.toString();
      navigate(qs ? `${path}?${qs}` : path, {
        state: {
          readonly: readOnly,
          deleted: isDeletedView,
          orderRow: row,
        },
      });
    } catch (err) {
      console.error(`[${logLabel}] open invoice failed`, err);
      window.alert(err?.message || 'Failed to load order for this line.');
    } finally {
      setEditLoadingId('');
    }
  };

  const handleDelete = async (row) => {
    const orderId = pickOrderDocumentId(row);
    if (!orderId) {
      toast.error('Could not delete: missing order id.');
      return;
    }
    const orderNo = row.order_no || row.orderNo || orderId;
    if (!window.confirm(`Delete order "${orderNo}"? This action cannot be undone.`)) {
      return;
    }
    const result = await dispatch(deleteOrder(orderId));
    if (deleteOrder.fulfilled.match(result)) {
      toast.success('Order deleted successfully.');
    } else {
      toast.error(result.payload || 'Failed to delete order.');
    }
    dispatch(clearDeleteStatus());
  };

  const handleQueueOrderSync = async (orderId, orderNo) => {
    if (!orderId) {
      toast.error('Could not sync: missing order id.');
      return;
    }

    const rowKey = String(orderId);
    setSyncingOrderId(rowKey);

    try {
      const result = await fetchIntegrationsRequest();
      const integrations = Array.isArray(result?.data) ? result.data : [];

      if (integrations.length === 0) {
        toast.error('No integrations found. Add one under Integrations first.');
        return;
      }

      if (integrations.length > 1) {
        toast.info('Multiple integrations found. Use Sync orders from the toolbar.');
        return;
      }

      const integrationId = integrationIdFromRecord(integrations[0]);
      if (!integrationId) {
        toast.error('Could not resolve integration id.');
        return;
      }

      await createBulkSyncOrderProcessRequest(integrationId, [orderId]);
      const label = orderNo && orderNo !== '—' ? orderNo : rowKey;
      toast.success(`Order sync queued for ${label}.`);
    } catch (err) {
      console.error(`[${logLabel}] queue order sync failed`, err);
      toast.error(err?.message || 'Failed to queue order sync.');
    } finally {
      setSyncingOrderId('');
    }
  };

  const refreshOrderList = useCallback(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (listPath) params.listPath = listPath;
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    if (isDeletedView) {
      dispatch(fetchDeletedOrders(params));
    } else {
      dispatch(fetchOrders(params));
    }
  }, [
    dispatch,
    listPath,
    pagination.page,
    pagination.limit,
    searchTerm,
    filters.startDate,
    filters.endDate,
    sort.sortBy,
    sort.sortOrder,
    isDeletedView,
  ]);

  const handleOpenShipmentModal = (orderId, orderNo) => {
    if (!orderId) {
      toast.error('Could not add tracking: missing order id.');
      return;
    }
    setShipmentModal({ open: true, orderId: String(orderId), orderNo: orderNo || '' });
  };

  const handleOpenParcelBarcode = ({
    orderId,
    trackingId,
    orderNo,
    provider,
    customerName,
    city,
  } = {}) => {
    const cn = String(trackingId || '').trim();
    const oid = String(orderId || '').trim();
    if (!cn && !oid) {
      toast.error('No tracking id / order to print.');
      return;
    }
    setParcelBarcodeModal({
      open: true,
      orderId: oid,
      trackingId: cn,
      orderNo: orderNo || '',
      provider: provider || '',
      customerName: customerName || '',
      city: city || '',
    });
  };

  const handleShipmentCreated = ({ orderId, provider, result } = {}) => {
    const trackingId = result?.tracking_id || result?.tracking_number || '';
    const trackingUrl = result?.tracking_url || '';
    const courier = result?.courier || provider || '';
    const apiSaysSuccess =
      result?.success === true ||
      String(result?.message || '')
        .trim()
        .toLowerCase() === 'success';

    if (!trackingId && !apiSaysSuccess) {
      toast.error('Shipment response did not include a tracking id.');
      return;
    }

    if (trackingId) {
      toast.success(
        courier
          ? `Shipment created via ${courier}. Tracking ID: ${trackingId}`
          : `Shipment created. Tracking ID: ${trackingId}`
      );
    } else {
      toast.success(courier ? `Shipment created via ${courier}.` : 'Shipment created successfully.');
    }

    if (orderId && trackingId) {
      setShipmentOverrides((prev) => ({
        ...prev,
        [String(orderId)]: {
          tracking_id: trackingId,
          tracking_number: trackingId,
          tracking_url: trackingUrl,
          courier,
          provider: courier,
        },
      }));

      const orderRow = Array.isArray(data)
        ? data.find((row) => String(pickOrderDocumentId(row)) === String(orderId))
        : null;
      handleOpenParcelBarcode({
        orderId,
        trackingId,
        orderNo: shipmentModal.orderNo || orderRow?.order_no || orderRow?.orderNo || '',
        provider: courier,
        customerName: orderRow?.name || '',
        city: orderRow?.city || '',
      });
    }

    refreshOrderList();
  };

  const handleRetryFetch = useCallback(() => {
    refreshOrderList();
  }, [refreshOrderList]);

  const handleFetchOrdersSaved = () => {
    toast.success('Order fetch process queued successfully!');
    refreshOrderList();
  };

  const handleSyncOrdersSaved = () => {
    toast.success('Order sync processes queued successfully!');
    refreshOrderList();
  };

  const showTopSummary = Boolean(topSummaryName && String(topSummaryName).trim());
  const tiles = Array.isArray(topTiles) ? topTiles : [];
  const showTopTiles = tiles.length > 0;

  const tileRows = useMemo(() => {
    if (!showTopTiles) return [];
    return tiles.map((tile) => {
      const value = buildOmsTileValue(tile, { data, pagination });
      return { ...tile, value };
    });
  }, [showTopTiles, tiles, data, pagination]);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          {showTopSummary ? (
            <div className="mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h5 className="mb-0">{topSummaryName}</h5>
              </div>

              {showTopTiles ? (
                <div className="oms-tiles-grid">
                  {tileRows.map((tile) => {
                    const gradient = tileGradientClass(tile.variant);
                    const shadow =
                      gradient === 'bg-gradient-primary'
                        ? 'shadow-primary'
                        : gradient === 'bg-gradient-info'
                          ? 'shadow-info'
                          : gradient === 'bg-gradient-success'
                            ? 'shadow-success'
                            : gradient === 'bg-gradient-warning'
                              ? 'shadow-warning'
                              : gradient === 'bg-gradient-danger'
                                ? 'shadow-danger'
                                : gradient === 'bg-gradient-dark'
                                  ? 'shadow-dark'
                                  : 'shadow-secondary';

                    return (
                      <div key={tile.id || tile.label} className="card oms-kpi-card border-0 shadow-sm">
                        <div className="card-body p-3">
                          <div className="row">
                            <div className="col-8">
                              <div className="numbers">
                                <p className="text-sm mb-0 text-uppercase font-weight-bold">
                                  {tile.label}
                                </p>
                                <h5 className="font-weight-bolder mb-0">
                                  {(tile.value ?? 0).toLocaleString()}
                                </h5>
                              </div>
                            </div>
                            <div className="col-4 text-end">
                              <div
                                className={`icon icon-shape ${gradient} ${shadow} text-center rounded-circle d-inline-flex align-items-center justify-content-center`}
                              >
                                <span className="text-white opacity-10 oms-kpi-icon">
                                  {tile.icon}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-4 col-md-5">
                  <h5 className="mb-1">{isDeletedView ? 'Deleted Orders' : pageTitle}</h5>
                  {pageSubtitle ? (
                    <p className="text-sm text-muted mb-0">{pageSubtitle}</p>
                  ) : DEBUG ? (
                    <p className="text-sm text-muted mb-0">Server-side pagination and search.</p>
                  ) : null}
                  {showDeletedTab ? (
                    <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Orders list tabs">
                      <button
                        type="button"
                        className={`btn mb-0 ${!isDeletedView ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleDeletedTabChange(false)}
                        aria-pressed={!isDeletedView}
                      >
                        Orders
                      </button>
                      <button
                        type="button"
                        className={`btn mb-0 ${isDeletedView ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleDeletedTabChange(true)}
                        aria-pressed={isDeletedView}
                      >
                        Deleted Orders
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="col-lg-8 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search orders…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search orders"
                      />
                    </div>
                    <ColumnVisibilityMenu
                      columns={orderColumns}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                      id={`${idPrefix}ColumnVisibilityMenu`}
                    />
                    {showFetchSyncToolbar && canCreate ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setFetchOrdersModalOpen(true)}
                        >
                          <i className="fas fa-cloud-download-alt me-1" aria-hidden="true" />
                          Fetch orders
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-0"
                          onClick={() => setSyncOrdersModalOpen(true)}
                        >
                          <NavIcon icon={FaCloudArrowUp} className="me-1" size={14} />
                          Sync orders
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className={`btn btn-sm mb-0 position-relative ${
                        showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-outline-primary'
                      }`}
                      onClick={() => setShowFilters((prev) => !prev)}
                      aria-expanded={showFilters}
                      aria-controls={`${idPrefix}-filter-panel`}
                      aria-label="Filters and export"
                      title="Filters & export"
                    >
                      <NavIcon icon={FaFilter} size={14} />
                      {activeFilterCount > 0 ? (
                        <span className="badge bg-gradient-danger text-white rounded-pill position-absolute top-0 start-100 translate-middle">
                          {activeFilterCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {showFilters ? (
              <div className="card-body pt-0 px-3 pb-0">
                <div className="orders-filter-panel" id={`${idPrefix}-filter-panel`}>
                  <div className="row g-3 align-items-end">
                    <div className="col-xl-3 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor={`${idPrefix}-from-date`}
                      >
                        From date
                      </label>
                      <input
                        id={`${idPrefix}-from-date`}
                        type="date"
                        className="form-control form-control-sm"
                        value={localStartDate}
                        onChange={(e) => setLocalStartDate(e.target.value)}
                      />
                    </div>
                    <div className="col-xl-3 col-md-4 col-sm-6">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor={`${idPrefix}-to-date`}
                      >
                        To date
                      </label>
                      <input
                        id={`${idPrefix}-to-date`}
                        type="date"
                        className="form-control form-control-sm"
                        value={localEndDate}
                        onChange={(e) => setLocalEndDate(e.target.value)}
                      />
                    </div>
                    <div className="col-xl-6 col-md-4 d-flex flex-wrap align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm mb-0"
                        onClick={applyDateFilters}
                      >
                        <i className="fas fa-check me-1" aria-hidden="true" />
                        Apply
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm mb-0"
                        onClick={resetDateFilters}
                      >
                        <i className="fas fa-rotate-left me-1" aria-hidden="true" />
                        Clear
                      </button>
                    </div>
                  </div>
                  <hr className="my-3 opacity-50" />
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="text-xs text-uppercase fw-bold text-muted me-1">
                      <i className="fas fa-download me-1" aria-hidden="true" />
                      Download all
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm mb-0"
                      disabled={exporting}
                      onClick={() => handleExport('csv')}
                    >
                      <i className="fas fa-file-csv me-1" aria-hidden="true" />
                      {exporting ? 'Exporting…' : 'CSV'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm mb-0"
                      disabled={exporting}
                      onClick={() => handleExport('excel')}
                    >
                      <i className="fas fa-file-excel me-1" aria-hidden="true" />
                      Excel
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm mb-0"
                      disabled={exporting}
                      onClick={() => handleExport('pdf')}
                    >
                      <i className="fas fa-file-pdf me-1" aria-hidden="true" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className={`list-data-table--${idPrefix}`}
                loading={loading}
                loadingLabel={`Loading ${pageTitle.toLowerCase()}…`}
                error={error}
                errorPrefix={`Error loading ${pageTitle.toLowerCase()}`}
                onRetry={handleRetryFetch}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId={`${idPrefix}-table-page-size`}
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th className="text-center list-col-sno">#</th>
                      {sortableTh('order_no', 'Order no')}
                      {isVisible('channel') ? (
                        <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                          Online/Offline
                        </th>
                      ) : null}
                      {showIntegrationColumn && isVisible('integration')
                        ? sortableTh('integration_order_id', 'Integration', 'list-col-truncate')
                        : null}
                      {isVisible('name')
                        ? sortableTh('name', 'Customer', 'list-col-truncate')
                        : null}
                      {isVisible('email')
                        ? sortableTh('email', 'Email', 'list-col-truncate')
                        : null}
                      {isVisible('phone')
                        ? sortableTh('phone', 'Phone', 'list-col-truncate-sm')
                        : null}
                      {isVisible('items')
                        ? sortableTh('no_of_items', 'Items', 'text-center')
                        : null}
                      {isVisible('total')
                        ? sortableTh('order_items_total', 'Total', 'text-end list-col-amount')
                        : null}
                      {isVisible('status') ? sortableTh('order_status', 'Status') : null}
                      {showTrackingColumn && isVisible('tracking') ? (
                        <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                          Tracking
                        </th>
                      ) : null}
                      {isVisible('created')
                        ? sortableTh('createdAt', 'Created', 'list-col-date')
                        : null}
                      {isVisible('updated')
                        ? sortableTh('updatedAt', 'Last updated', 'list-col-date')
                        : null}
                      <th className="text-end list-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCount} className="text-center py-5 text-muted">
                          {isDeletedView
                            ? 'No deleted orders found. Try adjusting your search or date range.'
                            : 'No orders found. Try adjusting your search or date range.'}
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const key = item._id || item.id || index;
                        const orderId = pickOrderDocumentId(item);
                        const orderNo = item.order_no || item.orderNo || '—';
                        const integrationOrderId =
                          item.integration_order_id || item.integrationOrderId || '—';
                        const integrationRecord = getOrderIntegrationRecord(item);
                        const wooOrderAdminUrl = buildWooCommerceOrderAdminUrl(
                          integrationRecord,
                          integrationOrderId
                        );
                        const statusVal = orderDisplayStatus(item);
                        const onlineChannel = isOnlineOrder(item);
                        const rowKey = String(orderId || item._id || item.id || index);
                        const isRowLoading = editLoadingId === rowKey;
                        const isSyncing = syncingOrderId === rowKey;
                        const created = item.createdAt ?? item.created_at;
                        const updated = item.updatedAt ?? item.updated_at;
                        const customerName = item.name || '—';
                        const email = item.email || '—';
                        const phone = item.phone || '—';
                        const total = getOrderItemsTotalDisplay(item);
                        const trackingInfo = showTrackingColumn
                          ? resolveOrderTrackingInfo(
                              item,
                              orderId ? shipmentOverrides[String(orderId)] : null
                            )
                          : null;
                        return (
                          <tr key={key}>
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            <td className="text-sm font-weight-bold text-dark">
                              {canViewOrder && orderNo !== '—' ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 mb-0 text-dark font-weight-bold text-decoration-none"
                                  disabled={isRowLoading}
                                  onClick={() => handleOpenInvoice(item)}
                                  title="View order details"
                                >
                                  {isRowLoading ? 'Opening…' : orderNo}
                                </button>
                              ) : (
                                orderNo
                              )}
                            </td>
                            {isVisible('channel') ? (
                              <td className="text-sm">
                                <span className={`badge text-xxs ${channelBadgeClass(onlineChannel)}`}>
                                  {onlineChannel ? 'Online' : 'Offline'}
                                </span>
                              </td>
                            ) : null}
                            {showIntegrationColumn && isVisible('integration') ? (
                              <td className="text-sm">
                                <OrderIntegrationMergedCell
                                  integration={integrationRecord}
                                  integrationOrderId={integrationOrderId}
                                  wooOrderAdminUrl={wooOrderAdminUrl}
                                />
                              </td>
                            ) : null}
                            {isVisible('name') ? (
                              <td
                                className="text-sm list-cell-truncate"
                                title={customerName !== '—' ? customerName : undefined}
                              >
                                {customerName}
                              </td>
                            ) : null}
                            {isVisible('email') ? (
                              <td
                                className="text-sm list-cell-truncate"
                                title={email !== '—' ? email : undefined}
                              >
                                {email}
                              </td>
                            ) : null}
                            {isVisible('phone') ? (
                              <td className="text-sm list-cell-truncate-sm text-nowrap">{phone}</td>
                            ) : null}
                            {isVisible('items') ? (
                              <td className="text-sm text-center">{getNoOfItemsDisplay(item)}</td>
                            ) : null}
                            {isVisible('total') ? (
                              <td className="text-sm font-weight-bold text-end text-nowrap list-col-amount">
                                {total !== '—' ? `PKR ${total}` : total}
                              </td>
                            ) : null}
                            {isVisible('status') ? (
                              <td className="text-sm">
                                <span className={`badge text-xxs ${statusBadgeClass(statusVal)}`}>
                                  {String(statusVal)}
                                </span>
                              </td>
                            ) : null}
                            {showTrackingColumn && isVisible('tracking') ? (
                              <td className="text-sm">
                                {trackingInfo?.hasTracking ? (
                                  <div className="d-flex flex-column align-items-start gap-1 min-width-0">
                                    {trackingInfo.trackingId ? (
                                      <div className="text-nowrap" title={trackingInfo.trackingId}>
                                        <span className="text-xs text-muted d-block">Tracking ID</span>
                                        <span className="font-weight-bold text-dark text-sm">
                                          {trackingInfo.trackingId}
                                        </span>
                                      </div>
                                    ) : null}
                                    {trackingInfo.trackingUrl ? (
                                      <div className="min-width-0 w-100">
                                        <span className="text-xs text-muted d-block">Tracking URL</span>
                                        <a
                                          href={trackingInfo.trackingUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary text-decoration-underline text-break"
                                          title={trackingInfo.trackingUrl}
                                        >
                                          {trackingInfo.trackingUrl}
                                        </a>
                                      </div>
                                    ) : null}
                                    {trackingInfo.provider ? (
                                      <span className="text-xs text-muted">{trackingInfo.provider}</span>
                                    ) : null}
                                    {trackingInfo.trackingId ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-dark mb-0 px-2"
                                        title="Print barcode for parcel"
                                        onClick={() =>
                                          handleOpenParcelBarcode({
                                            orderId,
                                            trackingId: trackingInfo.trackingId,
                                            orderNo,
                                            provider: trackingInfo.provider,
                                            customerName:
                                              customerName !== '—' ? customerName : '',
                                            city: item.city || '',
                                          })
                                        }
                                      >
                                        Print barcode
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary mb-0 px-2"
                                    title="Add tracking"
                                    disabled={!orderId}
                                    onClick={() => handleOpenShipmentModal(orderId, orderNo)}
                                  >
                                    Add tracking
                                  </button>
                                )}
                              </td>
                            ) : null}
                            {isVisible('created') ? (
                              <td className="text-sm text-nowrap list-col-date">
                                {created ? moment(created).format('DD MMM YYYY h:mm a') : '—'}
                              </td>
                            ) : null}
                            {isVisible('updated') ? (
                              <td
                                className="text-sm text-nowrap list-col-date"
                                title={
                                  updated
                                    ? moment(updated).format('DD MMM YYYY h:mm a')
                                    : undefined
                                }
                              >
                                {updated ? moment(updated).fromNow() : '—'}
                              </td>
                            ) : null}
                            <td className="text-end">
                              <div className="list-table-actions">
                                {showRowSyncButton && !isDeletedView ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary mb-0 px-2"
                                    title="Sync order"
                                    aria-label="Sync order"
                                    onClick={() => handleQueueOrderSync(orderId, orderNo)}
                                    disabled={!orderId || isSyncing}
                                  >
                                    {isSyncing ? (
                                      <span
                                        className="spinner-border spinner-border-sm"
                                        role="status"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <NavIcon icon={FaArrowsRotate} size={14} />
                                    )}
                                  </button>
                                ) : null}
                                {canViewOrder ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary mb-0"
                                    disabled={isRowLoading}
                                    onClick={() => handleOpenInvoice(item)}
                                  >
                                    {isRowLoading ? 'Opening…' : 'View'}
                                  </button>
                                ) : null}
                                {canDelete && !isDeletedView ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger mb-0"
                                    onClick={() => handleDelete(item)}
                                    disabled={deleteStatus === 'loading'}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </td>
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

      {showFetchSyncToolbar ? (
        <>
          <FetchOrdersModal
            open={fetchOrdersModalOpen}
            onClose={() => setFetchOrdersModalOpen(false)}
            onSaved={handleFetchOrdersSaved}
          />

          <SyncOrdersModal
            open={syncOrdersModalOpen}
            onClose={() => setSyncOrdersModalOpen(false)}
            onSaved={handleSyncOrdersSaved}
          />
        </>
      ) : null}

      {showTrackingColumn ? (
        <>
          <CreateShipmentModal
            open={shipmentModal.open}
            orderId={shipmentModal.orderId}
            orderNo={shipmentModal.orderNo}
            onClose={() => setShipmentModal({ open: false, orderId: '', orderNo: '' })}
            onSaved={handleShipmentCreated}
          />
          <ParcelBarcodePrintModal
            open={parcelBarcodeModal.open}
            orderId={parcelBarcodeModal.orderId}
            trackingId={parcelBarcodeModal.trackingId}
            orderNo={parcelBarcodeModal.orderNo}
            provider={parcelBarcodeModal.provider}
            customerName={parcelBarcodeModal.customerName}
            city={parcelBarcodeModal.city}
            onClose={() =>
              setParcelBarcodeModal({
                open: false,
                orderId: '',
                trackingId: '',
                orderNo: '',
                provider: '',
                customerName: '',
                city: '',
              })
            }
          />
        </>
      ) : null}
    </div>
  );
}
