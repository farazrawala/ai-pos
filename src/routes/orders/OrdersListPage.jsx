import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  FaArrowsRotate,
  FaCloudArrowUp,
  FaFilter,
  FaClockRotateLeft,
  FaWhatsapp,
  FaListCheck,
  FaHourglassStart,
  FaMoneyBillWave,
  FaHand,
  FaBoxOpen,
  FaCircleCheck,
  FaLocationDot,
  FaBox,
  FaCodeBranch,
  FaLayerGroup,
  FaFlag,
  FaTruckFast,
  FaTruck,
  FaRoad,
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
  setIntegrationFilter,
  setOrderTypeFilter,
  setOrderStatusFilter,
  setTagFilter,
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
  updateOrderStatusRequest,
  mergeOrdersRequest,
  DELETED_ORDER_BY_ORDER_ITEM_PATH,
  DEFAULT_ORDER_LIST_PATH,
  ORDER_STATUS_UPDATE_LIST_PATH,
  ORDER_MERGE_PATH,
  ORDER_UPDATE_TAGS_PATH,
  ORDER_VALIDATE_ADDRESS_PATH,
  ORDER_UPDATE_ADDRESS_PATH,
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
import TrackingStatusModal from '../../components/order/TrackingStatusModal.jsx';
import ChangeOrderStatusModal, {
  OMS_ORDER_STATUS_OPTIONS,
  formatOrderStatusOptionLabel,
} from '../../components/order/ChangeOrderStatusModal.jsx';
import OrderStatusUpdatesModal from '../../components/order/OrderStatusUpdatesModal.jsx';
import CustomerOrderHistoryModal from '../../components/order/CustomerOrderHistoryModal.jsx';
import OrderConfirmationTagsModal, {
  normalizeOrderTags,
  ORDER_CONFIRMATION_TAG_VALUES,
} from '../../components/order/OrderConfirmationTagsModal.jsx';
import ValidateOrderAddressModal from '../../components/order/ValidateOrderAddressModal.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import DevApiSourcesFooter from '../../components/common/DevApiSourcesFooter.jsx';
import { fetchIntegrationsRequest } from '../../features/integration/integrationAPI.js';
import { createBulkSyncOrderProcessRequest } from '../../features/process/processAPI.js';
import {
  resolveOrderTrackingInfo,
  TCS_TRACKING_DETAIL_URL,
} from '../../features/courier/courierAPI.js';
import { buildWhatsAppUrl } from '../../features/bigCommerce/marketplaceUtils.js';
import { DEBUG } from '../../config/env.js';
import { buildApiUrl } from '../../config/apiConfig.js';
import { posInvoiceRoutePath } from '../../config/appBase.js';
import { toast } from '../../utils/toast.js';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../utils/listExport.js';
import {
  integrationIdFromRecord as integrationIdFromFormRecord,
  integrationNameFromRecord,
  storeTypeLabel,
} from '../integration/integrationForm.js';
import { pickIntegrationStoreLogoUrl } from '../../features/integration/integrationAPI.js';
import './orders-list-page.css';
import '../../components/common/devApiSources.css';

const mapLoadStatus = (status) => {
  if (status === 'loading' || status === true) return 'loading';
  if (status === 'failed') return 'error';
  if (status === 'succeeded' || status === false) return 'success';
  return 'pending';
};

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
  { key: 'integration', label: 'Integration' },
  { key: 'name', label: 'Customer' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'items', label: 'Items' },
  { key: 'total', label: 'Total' },
  { key: 'status', label: 'Status' },
  { key: 'tags', label: 'Tags' },
  { key: 'order_website_status', label: 'Website status' },
  { key: 'channel', label: 'Order type' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Last updated' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const integrationIdFromRecord = (item) =>
  integrationIdFromFormRecord(item) || item?._id || item?.id || item?.integration_id || '';

const integrationFilterLabel = (item) => {
  const name = integrationNameFromRecord(item);
  const storeType = item?.store_type || item?.storeType || '';
  return storeType ? `${name} (${storeTypeLabel(storeType)})` : name;
};

const ORDER_TYPE_FILTER_OPTIONS = [
  { value: 'offline', label: 'Offline' },
  { value: 'online', label: 'Online' },
  { value: 'bigcommerce', label: 'BigCommerce' },
  { value: 'website', label: 'Website' },
];

/** Known order `tags` values for OMS filter / confirmation. */
const ORDER_TAG_VALUES = [
  'coupon',
  'order_merged',
  'last_order_return',
  'incomplete_address',
  'not_answering',
  'stock_awaiting',
  'customer_cancel',
  'previous_data',
  'confirmed_by_email',
  'confirmed_by_sms',
  'confirmed_by_whatsapp',
  'confirmed_by_call',
];

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

const getOrderType = (row) => {
  const raw = row?.order_type ?? row?.orderType ?? '';
  return String(raw ?? '').trim();
};

const formatOrderTypeLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const statusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (
    s === 'active' ||
    s === 'completed' ||
    s === 'posted' ||
    s === 'delivered' ||
    s === 'confirmed' ||
    s === 'shipped'
  ) {
    return 'bg-gradient-success';
  }
  if (
    s === 'pending' ||
    s === 'draft' ||
    s === 'placed' ||
    s === 'processing' ||
    s === 'on-hold' ||
    s === 'checkout-draft' ||
    s === 'auto-draft'
  ) {
    return 'bg-gradient-warning';
  }
  if (
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'void' ||
    s === 'refunded' ||
    s === 'failed' ||
    s === 'trash'
  ) {
    return 'bg-gradient-danger';
  }
  return 'bg-gradient-secondary';
};

const formatWebsiteStatusLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatOrderTagLabel = (value) => formatWebsiteStatusLabel(value);

const buildOrderAddressText = (row) => {
  if (!row || typeof row !== 'object') return '';
  const direct = String(row.address ?? row.shipping_address ?? row.shippingAddress ?? '').trim();
  const parts = [row.city, row.state, row.zip, row.postal]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  if (direct && parts.length) {
    const lower = direct.toLowerCase();
    const missing = parts.filter((part) => !lower.includes(part.toLowerCase()));
    return missing.length ? `${direct}, ${missing.join(', ')}` : direct;
  }
  if (direct) return direct;
  return [row.address_line1, row.address_line2, ...parts]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
};

const orderTagBadgeClass = (tag) => {
  const s = String(tag || '')
    .trim()
    .toLowerCase();
  if (s.startsWith('confirmed_by_')) return 'bg-gradient-success';
  return 'bg-gradient-secondary';
};

const getOrderWebsiteStatus = (row) => {
  const raw = row?.order_website_status ?? row?.orderWebsiteStatus ?? '';
  const s = String(raw ?? '').trim();
  return s || '';
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
 *     showIntegrationFilter?: boolean,
 *     showOrderTypeFilter?: boolean,
 *     showOrderStatusFilter?: boolean,
 *     showTrackingColumn?: boolean,
 *     showWebsiteStatusColumn?: boolean,
 *     showStatusChangeModal?: boolean,
 *     showRowSelection?: boolean,
 *     showTagFilter?: boolean,
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
    showIntegrationFilter = false,
    showOrderTypeFilter = false,
    showOrderStatusFilter = false,
    showTrackingColumn = false,
    showWebsiteStatusColumn = false,
    showStatusChangeModal = false,
    showRowSelection = false,
    showTagFilter = false,
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
  const [statusModal, setStatusModal] = useState({
    open: false,
    orderId: '',
    orderNo: '',
    currentStatus: '',
  });
  const [statusHistoryModal, setStatusHistoryModal] = useState({
    open: false,
    orderId: '',
    orderNo: '',
  });
  const [orderHistoryModal, setOrderHistoryModal] = useState({
    open: false,
    phone: '',
    email: '',
    customerName: '',
    currentOrderId: '',
  });
  const [confirmationModal, setConfirmationModal] = useState({
    open: false,
    orderId: '',
    orderNo: '',
    tags: [],
  });
  const [validateAddressModal, setValidateAddressModal] = useState({
    open: false,
    orderId: '',
    orderNo: '',
    address: '',
    name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [shipmentOverrides, setShipmentOverrides] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [tagsOverrides, setTagsOverrides] = useState({});
  const [parcelBarcodeModal, setParcelBarcodeModal] = useState({
    open: false,
    orderId: '',
    trackingId: '',
    orderNo: '',
    provider: '',
    customerName: '',
    city: '',
  });
  const [trackingStatusModal, setTrackingStatusModal] = useState({
    open: false,
    orderId: '',
    trackingId: '',
    orderNo: '',
    provider: '',
    trackingUrl: '',
  });
  const [syncingOrderId, setSyncingOrderId] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [mergeOrdersUpdating, setMergeOrdersUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(
    Boolean(
      filters.startDate ||
        filters.endDate ||
        filters.integrationId ||
        filters.orderType ||
        filters.orderStatus ||
        filters.tag
    )
  );
  const [showDeleted, setShowDeleted] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [integrationsStatus, setIntegrationsStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);
  const isDeletedView = Boolean(showDeletedTab && showDeleted);
  const canViewOrder = canEdit || isDeletedView || viewReadOnly;

  const orderColumns = useMemo(() => {
    let cols = ORDER_COLUMNS;
    if (!showIntegrationColumn) cols = cols.filter((col) => col.key !== 'integration');
    if (!showTrackingColumn) cols = cols.filter((col) => col.key !== 'tracking');
    if (!showWebsiteStatusColumn) cols = cols.filter((col) => col.key !== 'order_website_status');
    return cols;
  }, [showIntegrationColumn, showTrackingColumn, showWebsiteStatusColumn]);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility(
    permissionModule,
    orderColumns
  );

  const tableColSpan = visibleCount + (showRowSelection ? 1 : 0);

  const selectablePageIds = useMemo(() => {
    if (!showRowSelection) return [];
    return (Array.isArray(data) ? data : [])
      .map((row) => String(pickOrderDocumentId(row) || row?._id || row?.id || '').trim())
      .filter(Boolean);
  }, [data, showRowSelection]);

  const allPageSelected =
    selectablePageIds.length > 0 && selectablePageIds.every((id) => selectedOrderIds.has(id));

  const somePageSelected =
    selectablePageIds.some((id) => selectedOrderIds.has(id)) && !allPageSelected;

  const toggleOrderSelected = useCallback((orderId) => {
    const id = String(orderId || '').trim();
    if (!id) return;
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllPage = useCallback(() => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        selectablePageIds.forEach((id) => next.delete(id));
      } else {
        selectablePageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allPageSelected, selectablePageIds]);

  const clearOrderSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
  }, []);

  useEffect(() => {
    if (!showRowSelection) return;
    setSelectedOrderIds(new Set());
  }, [
    showRowSelection,
    searchTerm,
    filters.startDate,
    filters.endDate,
    filters.integrationId,
    filters.orderType,
    filters.orderStatus,
    filters.tag,
    isDeletedView,
  ]);

  const activeFilterCount =
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0) +
    (filters.integrationId ? 1 : 0) +
    (filters.orderType ? 1 : 0) +
    (filters.orderStatus ? 1 : 0) +
    (filters.tag ? 1 : 0);

  useEffect(() => {
    if (!showIntegrationFilter) return undefined;

    let cancelled = false;
    setIntegrationsStatus('loading');

    fetchIntegrationsRequest()
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result?.data) ? result.data : [];
        setIntegrations(list);
        setIntegrationsStatus('succeeded');
      })
      .catch(() => {
        if (!cancelled) {
          setIntegrations([]);
          setIntegrationsStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showIntegrationFilter]);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (listPath) params.listPath = listPath;
    if (searchTerm) params.search = searchTerm;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.integrationId) params.integrationId = filters.integrationId;
    if (filters.orderType) params.orderType = filters.orderType;
    if (filters.orderStatus) params.orderStatus = filters.orderStatus;
    if (filters.tag) params.tag = filters.tag;
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
    filters.integrationId,
    filters.orderType,
    filters.orderStatus,
    filters.tag,
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

  const handleIntegrationFilterChange = (e) => {
    dispatch(setIntegrationFilter(e.target.value));
  };

  const handleOrderTypeFilterChange = (e) => {
    dispatch(setOrderTypeFilter(e.target.value));
  };

  const handleOrderStatusFilterChange = (e) => {
    dispatch(setOrderStatusFilter(e.target.value));
  };

  const handleTagFilterChange = (e) => {
    dispatch(setTagFilter(e.target.value));
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
    if (filters.integrationId) params.integrationId = filters.integrationId;
    if (filters.orderType) params.orderType = filters.orderType;
    if (filters.orderStatus) params.orderStatus = filters.orderStatus;
    if (filters.tag) params.tag = filters.tag;
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
      className={`text-center ${className}`.trim()}
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
    if (filters.integrationId) params.integrationId = filters.integrationId;
    if (filters.orderType) params.orderType = filters.orderType;
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
    filters.integrationId,
    filters.orderType,
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

  const handleOpenStatusModal = (row) => {
    const orderId = pickOrderDocumentId(row);
    if (!orderId) {
      toast.error('Could not change status: missing order id.');
      return;
    }
    const orderNo = row?.order_no || row?.orderNo || '';
    const override = statusOverrides[String(orderId)];
    const currentStatus = override || orderDisplayStatus(row);
    setStatusModal({
      open: true,
      orderId: String(orderId),
      orderNo: orderNo || '',
      currentStatus: currentStatus === '—' ? '' : String(currentStatus),
    });
  };

  const handleStatusUpdated = ({ orderId, orderStatus } = {}) => {
    if (orderId && orderStatus) {
      setStatusOverrides((prev) => ({
        ...prev,
        [String(orderId)]: orderStatus,
      }));
    }
    toast.success('Order status updated.');
    refreshOrderList();
  };

  const getOrderTags = (row, orderId) => {
    const override = orderId ? tagsOverrides[String(orderId)] : null;
    if (Array.isArray(override)) return override;
    return normalizeOrderTags(row?.tags ?? row?.order_tags ?? row?.orderTags);
  };

  const handleOpenConfirmationModal = (row) => {
    const orderId = pickOrderDocumentId(row);
    if (!orderId) return;
    const orderNo = row?.order_no || row?.orderNo || '';
    setConfirmationModal({
      open: true,
      orderId: String(orderId),
      orderNo: orderNo || '',
      tags: getOrderTags(row, orderId),
    });
  };

  const handleOpenValidateAddressModal = (row) => {
    const orderId = pickOrderDocumentId(row);
    const orderNo = row?.order_no || row?.orderNo || '';
    const address = buildOrderAddressText(row);
    if (!orderId && !address) {
      toast.error('No address available to validate.');
      return;
    }
    setValidateAddressModal({
      open: true,
      orderId: orderId ? String(orderId) : '',
      orderNo: orderNo || '',
      address,
      name: String(row?.name || '').trim(),
      phone: String(row?.phone || '').trim(),
      email: String(row?.email || '').trim(),
      city: String(row?.city || '').trim(),
      state: String(row?.state || '').trim(),
      zip: String(row?.zip || row?.postal_code || '').trim(),
      country: String(row?.country || '').trim(),
    });
  };

  const handleAddressUpdated = () => {
    toast.success('Address updated.');
    refreshOrderList();
  };

  const handleConfirmationTagsUpdated = ({ orderId, tags } = {}) => {
    if (orderId) {
      setTagsOverrides((prev) => ({
        ...prev,
        [String(orderId)]: normalizeOrderTags(tags),
      }));
    }
    toast.success('Confirmation tags updated.');
    refreshOrderList();
  };

  const canBulkChangeStatus =
    showRowSelection &&
    showStatusChangeModal &&
    !isDeletedView &&
    !viewReadOnly &&
    (canEdit || canCreate);

  const handleBulkStatusChange = async (event) => {
    const nextStatus = String(event?.target?.value || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_')
      .replace(/\s+/g, '_');
    setBulkStatusValue('');
    if (!nextStatus || !canBulkChangeStatus) return;

    const ids = Array.from(selectedOrderIds).filter(Boolean);
    if (!ids.length) {
      toast.error('Select at least one order.');
      return;
    }

    setBulkStatusUpdating(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => updateOrderStatusRequest(id, { order_status: nextStatus }))
      );

      const succeeded = [];
      let failCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const saved =
            String(result.value?.data?.order?.order_status || nextStatus)
              .trim()
              .toLowerCase()
              .replace(/-/g, '_')
              .replace(/\s+/g, '_') || nextStatus;
          succeeded.push({ id: ids[index], status: saved });
        } else {
          failCount += 1;
        }
      });

      if (succeeded.length) {
        setStatusOverrides((prev) => {
          const next = { ...prev };
          succeeded.forEach(({ id, status }) => {
            next[String(id)] = status;
          });
          return next;
        });
      }

      if (failCount === 0) {
        toast.success(
          `Updated ${succeeded.length} order${succeeded.length === 1 ? '' : 's'} to ${formatOrderStatusOptionLabel(nextStatus)}.`
        );
      } else if (succeeded.length === 0) {
        toast.error(`Failed to update ${failCount} order${failCount === 1 ? '' : 's'}.`);
      } else {
        toast.warning(
          `Updated ${succeeded.length}, failed ${failCount}.`
        );
      }

      clearOrderSelection();
      refreshOrderList();
    } catch (err) {
      toast.error(err?.message || 'Failed to update order status.');
    } finally {
      setBulkStatusUpdating(false);
    }
  };

  const handleMergeOrders = async () => {
    if (!canBulkChangeStatus) return;

    const ids = Array.from(selectedOrderIds).filter(Boolean);
    if (ids.length < 2) {
      toast.error('Select at least two orders to merge.');
      return;
    }

    const targetId = ids[ids.length - 1];
    const targetRow = data.find((row) => String(pickOrderDocumentId(row) || '') === String(targetId));
    const targetLabel =
      targetRow?.order_no || targetRow?.orderNo || String(targetId).slice(-6);
    const sourceCount = ids.length - 1;

    if (
      !window.confirm(
        `Merge ${sourceCount} order${sourceCount === 1 ? '' : 's'} into ${targetLabel}?\n\n` +
          `The last selected order is kept. Other selected orders become Duplicate.`
      )
    ) {
      return;
    }

    setMergeOrdersUpdating(true);
    try {
      await mergeOrdersRequest(ids);
      toast.success(`Orders merged into ${targetLabel}.`);
      clearOrderSelection();
      refreshOrderList();
    } catch (err) {
      toast.error(err?.message || 'Failed to merge orders.');
    } finally {
      setMergeOrdersUpdating(false);
    }
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

  const handleOpenTrackingStatus = ({
    orderId,
    trackingId,
    orderNo,
    provider,
    trackingUrl,
  } = {}) => {
    const cn = String(trackingId || '').trim();
    const oid = String(orderId || '').trim();
    if (!cn && !oid) {
      toast.error('No tracking id / order to check status.');
      return;
    }
    setTrackingStatusModal({
      open: true,
      orderId: oid,
      trackingId: cn,
      orderNo: orderNo || '',
      provider: provider || '',
      trackingUrl: trackingUrl || '',
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

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];

    const listQuery = new URLSearchParams();
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.max(1, Number(pagination.limit) || 10);
    listQuery.set('skip', String((page - 1) * limit));
    listQuery.set('limit', String(limit));
    if (searchTerm) listQuery.set('search', String(searchTerm));
    if (filters.startDate) listQuery.set('startDate', String(filters.startDate));
    if (filters.endDate) listQuery.set('endDate', String(filters.endDate));
    if (filters.integrationId) listQuery.set('integration_id', String(filters.integrationId));
    if (filters.orderType) listQuery.set('order_type', String(filters.orderType));
    if (filters.orderStatus) listQuery.set('order_status', String(filters.orderStatus));
    if (filters.tag) listQuery.set('tag', String(filters.tag));
    if (sort.sortBy) {
      listQuery.set('sortBy', String(sort.sortBy));
      if (sort.sortOrder) listQuery.set('sortOrder', String(sort.sortOrder));
    }

    const activeListPath = isDeletedView
      ? DELETED_ORDER_BY_ORDER_ITEM_PATH
      : String(listPath || DEFAULT_ORDER_LIST_PATH).replace(/^\/+/, '');
    const qs = listQuery.toString();

    const sources = [
      {
        key: 'orders-list',
        label: isDeletedView ? 'Deleted orders list' : `${pageTitle} list`,
        url: buildApiUrl(`${activeListPath}${qs ? `?${qs}` : ''}`),
        status: mapLoadStatus(status),
        durationMs: null,
        error: status === 'failed' ? error : null,
      },
    ];

    if (showIntegrationFilter || showFetchSyncToolbar) {
      sources.push({
        key: 'integrations',
        label: 'Integrations (filter / sync)',
        url: buildApiUrl('integration/get-all-active'),
        status: mapLoadStatus(integrationsStatus),
        durationMs: null,
        error: null,
      });
    }

    if (showFetchSyncToolbar) {
      sources.push(
        {
          key: 'fetch-orders',
          label: 'Fetch orders (queue)',
          url: buildApiUrl('process/create'),
          status: fetchOrdersModalOpen ? 'loading' : 'pending',
          durationMs: null,
          error: null,
        },
        {
          key: 'sync-orders',
          label: 'Sync orders (bulk queue)',
          url: buildApiUrl('process/bulk-create'),
          status: syncOrdersModalOpen || syncingOrderId ? 'loading' : 'pending',
          durationMs: null,
          error: null,
        }
      );
    }

    if (showStatusChangeModal) {
      sources.push(
        {
          key: 'order-status',
          label: 'Update order status',
          url: buildApiUrl('order/update-status/:orderId'),
          status: statusModal.open ? 'loading' : 'pending',
          durationMs: null,
          error: null,
        },
        {
          key: 'order-status-updates',
          label: 'Order status updates',
          url: buildApiUrl(`${ORDER_STATUS_UPDATE_LIST_PATH}?order_id=:orderId`),
          status: statusHistoryModal.open ? 'loading' : 'pending',
          durationMs: null,
          error: null,
        },
        {
          key: 'order-merge',
          label: 'Merge orders',
          url: buildApiUrl(ORDER_MERGE_PATH),
          status: mergeOrdersUpdating ? 'loading' : 'pending',
          durationMs: null,
          error: null,
        }
      );
    }

    sources.push({
      key: 'customer-order-history',
      label: 'Customer order history',
      url: buildApiUrl(
        `${String(listPath || DEFAULT_ORDER_LIST_PATH).replace(/^\/+/, '')}?search=:phoneOrEmail`
      ),
      status: orderHistoryModal.open ? 'loading' : 'pending',
      durationMs: null,
      error: null,
    });

    sources.push({
      key: 'order-update-tags',
      label: 'Update order tags',
      url: buildApiUrl(`${ORDER_UPDATE_TAGS_PATH}/:orderId`),
      status: confirmationModal.open ? 'loading' : 'pending',
      durationMs: null,
      error: null,
    });

    sources.push({
      key: 'order-validate-address',
      label: 'Validate order address',
      url: buildApiUrl(ORDER_VALIDATE_ADDRESS_PATH),
      status: validateAddressModal.open ? 'loading' : 'pending',
      durationMs: null,
      error: null,
    });

    sources.push({
      key: 'order-update-address',
      label: 'Update order address',
      url: buildApiUrl(`${ORDER_UPDATE_ADDRESS_PATH}/:orderId`),
      status: validateAddressModal.open ? 'loading' : 'pending',
      durationMs: null,
      error: null,
    });

    sources.push({
      key: 'order-delete',
      label: 'Delete order',
      url: buildApiUrl('order/order_delete/:orderId'),
      status: mapLoadStatus(deleteStatus),
      durationMs: null,
      error: null,
    });

    sources.push(
      {
        key: 'couriers',
        label: 'Couriers (create shipment)',
        url: buildApiUrl('courier/get-all-active'),
        status: shipmentModal.open ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'create-shipment',
        label: 'Create shipment',
        url: buildApiUrl('courier/create/:orderId'),
        status: shipmentModal.open ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'courier-label',
        label: 'Print courier label',
        url: buildApiUrl('courier/label/:orderId'),
        status: parcelBarcodeModal.open ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'tracking-status',
        label: 'Courier tracking (TCS)',
        url: `${TCS_TRACKING_DETAIL_URL}?consignee={cn}`,
        status: trackingStatusModal.open ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'orders-export',
        label: 'Export orders (paged list)',
        url: buildApiUrl(`${activeListPath}${qs ? `?${qs}` : ''}`),
        status: exporting ? 'loading' : 'pending',
        durationMs: null,
        error: null,
      }
    );

    return sources;
  }, [
    pageTitle,
    listPath,
    isDeletedView,
    pagination.page,
    pagination.limit,
    searchTerm,
    filters.startDate,
    filters.endDate,
    filters.integrationId,
    filters.orderType,
    filters.orderStatus,
    filters.tag,
    sort.sortBy,
    sort.sortOrder,
    status,
    error,
    deleteStatus,
    integrationsStatus,
    showIntegrationFilter,
    showFetchSyncToolbar,
    showStatusChangeModal,
    fetchOrdersModalOpen,
    syncOrdersModalOpen,
    syncingOrderId,
    statusModal.open,
    statusHistoryModal.open,
    orderHistoryModal.open,
    confirmationModal.open,
    validateAddressModal.open,
    mergeOrdersUpdating,
    shipmentModal.open,
    parcelBarcodeModal.open,
    trackingStatusModal.open,
    exporting,
  ]);

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
                    {canBulkChangeStatus || showTagFilter ? (
                      <div className="d-flex align-items-center gap-2 me-md-auto">
                        {canBulkChangeStatus ? (
                          <select
                            id={`${idPrefix}-bulk-status`}
                            className="form-select form-select-sm"
                            style={{ minWidth: '180px', maxWidth: '220px' }}
                            value={bulkStatusValue}
                            disabled={
                              selectedOrderIds.size === 0 ||
                              bulkStatusUpdating ||
                              mergeOrdersUpdating
                            }
                            onChange={handleBulkStatusChange}
                            aria-label="Change status of selected orders"
                            title={
                              selectedOrderIds.size === 0
                                ? 'Select one or more orders to change status'
                                : `Change status for ${selectedOrderIds.size} selected order${selectedOrderIds.size === 1 ? '' : 's'}`
                            }
                          >
                            <option value="">
                              {bulkStatusUpdating
                                ? 'Updating…'
                                : selectedOrderIds.size > 0
                                  ? `Set status (${selectedOrderIds.size})`
                                  : 'Change status…'}
                            </option>
                            {OMS_ORDER_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {formatOrderStatusOptionLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {showTagFilter ? (
                          <select
                            id={`${idPrefix}-tag-filter`}
                            className="form-select form-select-sm"
                            style={{ minWidth: '180px', maxWidth: '240px' }}
                            value={filters.tag || ''}
                            onChange={handleTagFilterChange}
                            aria-label="Filter orders by tag"
                            title="Filter by tag"
                          >
                            <option value="">All tags</option>
                            {ORDER_TAG_VALUES.map((tag) => (
                              <option key={tag} value={tag}>
                                {formatOrderTagLabel(tag)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {canBulkChangeStatus && selectedOrderIds.size > 0 ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary mb-0"
                            onClick={clearOrderSelection}
                            disabled={bulkStatusUpdating || mergeOrdersUpdating}
                          >
                            Clear
                          </button>
                        ) : null}
                        {canBulkChangeStatus ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary mb-0"
                            onClick={handleMergeOrders}
                            disabled={
                              selectedOrderIds.size < 2 ||
                              bulkStatusUpdating ||
                              mergeOrdersUpdating
                            }
                            title={
                              selectedOrderIds.size < 2
                                ? 'Select two or more orders to merge'
                                : `Merge ${selectedOrderIds.size} selected orders (last selected is kept)`
                            }
                          >
                            {mergeOrdersUpdating ? (
                              <>
                                <span
                                  className="spinner-border spinner-border-sm me-1"
                                  role="status"
                                  aria-hidden="true"
                                />
                                Merging…
                              </>
                            ) : (
                              `Merge${selectedOrderIds.size > 1 ? ` (${selectedOrderIds.size})` : ''}`
                            )}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
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
                    {showIntegrationFilter ? (
                      <div className="col-xl-3 col-md-4 col-sm-6">
                        <label
                          className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                          htmlFor={`${idPrefix}-integration-filter`}
                        >
                          Integration
                        </label>
                        <select
                          id={`${idPrefix}-integration-filter`}
                          className="form-select form-select-sm"
                          value={filters.integrationId || ''}
                          onChange={handleIntegrationFilterChange}
                          disabled={integrationsStatus === 'loading'}
                        >
                          <option value="">All integrations</option>
                          {integrations.map((item) => {
                            const id = String(integrationIdFromRecord(item) || '');
                            if (!id) return null;
                            return (
                              <option key={id} value={id}>
                                {integrationFilterLabel(item)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : null}
                    {showOrderTypeFilter ? (
                      <div className="col-xl-3 col-md-4 col-sm-6">
                        <label
                          className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                          htmlFor={`${idPrefix}-order-type-filter`}
                        >
                          Order type
                        </label>
                        <select
                          id={`${idPrefix}-order-type-filter`}
                          className="form-select form-select-sm"
                          value={filters.orderType || ''}
                          onChange={handleOrderTypeFilterChange}
                        >
                          <option value="">All order types</option>
                          {ORDER_TYPE_FILTER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {showTagFilter ? (
                      <div className="col-xl-3 col-md-4 col-sm-6">
                        <label
                          className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                          htmlFor={`${idPrefix}-tag-filter-panel`}
                        >
                          Tag
                        </label>
                        <select
                          id={`${idPrefix}-tag-filter-panel`}
                          className="form-select form-select-sm"
                          value={filters.tag || ''}
                          onChange={handleTagFilterChange}
                        >
                          <option value="">All tags</option>
                          {ORDER_TAG_VALUES.map((tag) => (
                            <option key={tag} value={tag}>
                              {formatOrderTagLabel(tag)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
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
                    <div className="col-xl-3 col-md-4 d-flex flex-wrap align-items-center gap-2">
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
                      {showRowSelection ? (
                        <th className="text-center list-col-check">
                          <input
                            type="checkbox"
                            className="form-check-input oms-row-check m-0"
                            checked={allPageSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = somePageSelected;
                            }}
                            onChange={toggleSelectAllPage}
                            disabled={selectablePageIds.length === 0}
                            aria-label="Select all orders on this page"
                          />
                        </th>
                      ) : null}
                      {sortableTh('order_no', 'Order no')}
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
                        ? sortableTh('no_of_items', 'Items')
                        : null}
                      {isVisible('total')
                        ? sortableTh('order_items_total', 'Total', 'list-col-amount')
                        : null}
                      {isVisible('status') ? sortableTh('order_status', 'Status') : null}
                      {isVisible('tags') ? (
                        <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                          Tags
                        </th>
                      ) : null}
                      {showWebsiteStatusColumn && isVisible('order_website_status')
                        ? sortableTh('order_website_status', 'Website status')
                        : null}
                      {isVisible('channel') ? (
                        <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                          Order type
                        </th>
                      ) : null}
                      {showTrackingColumn && isVisible('tracking') ? (
                        <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">
                          Tracking
                        </th>
                      ) : null}
                      {isVisible('created')
                        ? sortableTh('createdAt', 'Created', 'list-col-date')
                        : null}
                      {isVisible('updated')
                        ? sortableTh('updatedAt', 'Last updated', 'list-col-date')
                        : null}
                      <th className="text-center list-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={tableColSpan} className="text-center py-5 text-muted">
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
                        const statusVal = (() => {
                          const override = orderId ? statusOverrides[String(orderId)] : '';
                          return override || orderDisplayStatus(item);
                        })();
                        const canChangeStatus =
                          showStatusChangeModal && !isDeletedView && !viewReadOnly && (canEdit || canCreate);
                        const websiteStatus = showWebsiteStatusColumn
                          ? getOrderWebsiteStatus(item)
                          : '';
                        const onlineChannel = isOnlineOrder(item);
                        const orderType = getOrderType(item);
                        const rowKey = String(orderId || item._id || item.id || index);
                        const selectionId = String(orderId || item._id || item.id || '').trim();
                        const isRowSelected =
                          showRowSelection && selectionId
                            ? selectedOrderIds.has(selectionId)
                            : false;
                        const isRowLoading = editLoadingId === rowKey;
                        const isSyncing = syncingOrderId === rowKey;
                        const created = item.createdAt ?? item.created_at;
                        const updated = item.updatedAt ?? item.updated_at;
                        const customerName = item.name || '—';
                        const email = item.email || '—';
                        const phone = item.phone || '—';
                        const total = getOrderItemsTotalDisplay(item);
                        const itemsCountRaw = getNoOfItemsDisplay(item);
                        const itemsCount =
                          typeof itemsCountRaw === 'number'
                            ? itemsCountRaw
                            : parseInt(String(itemsCountRaw ?? ''), 10);
                        const hasOrderItems = Number.isFinite(itemsCount) && itemsCount > 0;
                        const trackingInfo = showTrackingColumn
                          ? resolveOrderTrackingInfo(
                              item,
                              orderId ? shipmentOverrides[String(orderId)] : null
                            )
                          : null;
                        return (
                          <tr key={key} className={isRowSelected ? 'table-active' : undefined}>
                            <td className="text-center text-muted text-sm">{seriesNumber}</td>
                            {showRowSelection ? (
                              <td className="text-center list-col-check">
                                <input
                                  type="checkbox"
                                  className="form-check-input oms-row-check m-0"
                                  checked={isRowSelected}
                                  disabled={!selectionId}
                                  onChange={() => toggleOrderSelected(selectionId)}
                                  aria-label={`Select order ${orderNo}`}
                                />
                              </td>
                            ) : null}
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
                              <td className="text-sm list-col-customer">
                                <div className="oms-customer-cell d-flex align-items-start gap-2">
                                  <div className="oms-customer-cell__actions d-flex flex-column align-items-center gap-1 flex-shrink-0 mt-1">
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 mb-0 text-secondary"
                                      title="Order history"
                                      aria-label="Order history"
                                      onClick={() =>
                                        setOrderHistoryModal({
                                          open: true,
                                          phone: phone !== '—' ? phone : '',
                                          email: email !== '—' ? email : '',
                                          customerName: customerName !== '—' ? customerName : '',
                                          currentOrderId: orderId || '',
                                        })
                                      }
                                      disabled={phone === '—' && email === '—'}
                                    >
                                      <NavIcon icon={FaClockRotateLeft} size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 mb-0 oms-customer-cell__whatsapp"
                                      title={
                                        phone !== '—'
                                          ? 'Open WhatsApp Web chat'
                                          : 'No phone number'
                                      }
                                      aria-label="Open WhatsApp Web chat"
                                      disabled={phone === '—'}
                                      onClick={() => {
                                        const url = buildWhatsAppUrl(phone !== '—' ? phone : '');
                                        if (!url) {
                                          toast.error('Could not open WhatsApp.');
                                          return;
                                        }
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <NavIcon icon={FaWhatsapp} size={14} />
                                    </button>
                                  </div>
                                  <div className="oms-customer-cell__info min-width-0">
                                    <div
                                      className="oms-customer-cell__name text-dark font-weight-bold text-truncate"
                                      title={customerName !== '—' ? customerName : undefined}
                                    >
                                      {customerName}
                                    </div>
                                    {email !== '—' ? (
                                      <div
                                        className="oms-customer-cell__meta text-truncate"
                                        title={email}
                                      >
                                        {email}
                                      </div>
                                    ) : null}
                                    {phone !== '—' ? (
                                      <div
                                        className="oms-customer-cell__meta text-truncate"
                                        title={phone}
                                      >
                                        {phone}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
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
                                {canChangeStatus && orderId ? (
                                  <button
                                    type="button"
                                    className={`badge text-xxs border-0 ${statusBadgeClass(statusVal)}`}
                                    style={{ cursor: 'pointer' }}
                                    title="Change status"
                                    onClick={() => handleOpenStatusModal(item)}
                                  >
                                    {String(statusVal)}
                                  </button>
                                ) : (
                                  <span className={`badge text-xxs ${statusBadgeClass(statusVal)}`}>
                                    {String(statusVal)}
                                  </span>
                                )}
                              </td>
                            ) : null}
                            {isVisible('tags') ? (
                              <td className="text-sm">
                                {(() => {
                                  const rowTags = getOrderTags(item, orderId);
                                  if (!rowTags.length) {
                                    return <span className="text-muted">—</span>;
                                  }
                                  const canEditTags =
                                    !isDeletedView &&
                                    !viewReadOnly &&
                                    Boolean(orderId) &&
                                    (canEdit || canCreate);
                                  return (
                                    <div className="d-flex flex-wrap gap-1 justify-content-center">
                                      {rowTags.map((tag) => {
                                        const label = formatOrderTagLabel(tag);
                                        if (canEditTags) {
                                          return (
                                            <button
                                              key={tag}
                                              type="button"
                                              className={`badge text-xxs border-0 ${orderTagBadgeClass(tag)}`}
                                              style={{ cursor: 'pointer' }}
                                              title="Edit confirmation tags"
                                              onClick={() => handleOpenConfirmationModal(item)}
                                            >
                                              {label}
                                            </button>
                                          );
                                        }
                                        return (
                                          <span
                                            key={tag}
                                            className={`badge text-xxs ${orderTagBadgeClass(tag)}`}
                                            title={tag}
                                          >
                                            {label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </td>
                            ) : null}
                            {showWebsiteStatusColumn && isVisible('order_website_status') ? (
                              <td className="text-sm">
                                {websiteStatus ? (
                                  <span
                                    className={`badge text-xxs ${statusBadgeClass(websiteStatus)}`}
                                    title={websiteStatus}
                                  >
                                    {formatWebsiteStatusLabel(websiteStatus)}
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                            ) : null}
                            {isVisible('channel') ? (
                              <td className="text-sm">
                                {orderType ? (
                                  <span
                                    className={`badge text-xxs ${channelBadgeClass(
                                      orderType.toLowerCase() !== 'offline'
                                    )}`}
                                    title={orderType}
                                  >
                                    {formatOrderTypeLabel(orderType)}
                                  </span>
                                ) : (
                                  <span className={`badge text-xxs ${channelBadgeClass(onlineChannel)}`}>
                                    {onlineChannel ? 'Online' : 'Offline'}
                                  </span>
                                )}
                              </td>
                            ) : null}
                            {showTrackingColumn && isVisible('tracking') ? (
                              <td className="text-sm">
                                {trackingInfo?.hasTracking ? (
                                  <div className="d-flex flex-column align-items-start gap-1 min-width-0">
                                    {trackingInfo.trackingId ? (
                                      <div className="d-flex flex-wrap gap-1">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-info mb-0 px-2"
                                          title="Get live tracking status"
                                          onClick={() =>
                                            handleOpenTrackingStatus({
                                              orderId,
                                              trackingId: trackingInfo.trackingId,
                                              orderNo,
                                              provider: trackingInfo.provider,
                                              trackingUrl: trackingInfo.trackingUrl,
                                            })
                                          }
                                        >
                                          Get status
                                        </button>
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
                                      </div>
                                    ) : null}
                                  </div>
                                ) : hasOrderItems ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary mb-0 px-2"
                                    title="Add tracking"
                                    disabled={!orderId}
                                    onClick={() => handleOpenShipmentModal(orderId, orderNo)}
                                  >
                                    Add tracking
                                  </button>
                                ) : (
                                  <span className="text-muted">—</span>
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
                                {!isDeletedView && !viewReadOnly ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary mb-0 px-2"
                                    title="Validate address"
                                    aria-label="Validate address"
                                    onClick={() => handleOpenValidateAddressModal(item)}
                                    disabled={!orderId && !buildOrderAddressText(item)}
                                  >
                                    <NavIcon icon={FaLocationDot} size={14} />
                                  </button>
                                ) : null}
                                {!isDeletedView && !viewReadOnly ? (
                                  <button
                                    type="button"
                                    className={`btn btn-sm mb-0 px-2 ${
                                      ORDER_CONFIRMATION_TAG_VALUES.some((tag) =>
                                        getOrderTags(item, orderId).includes(tag)
                                      )
                                        ? 'btn-outline-success'
                                        : 'btn-outline-secondary'
                                    }`}
                                    title="Confirmation"
                                    aria-label="Confirmation"
                                    onClick={() => handleOpenConfirmationModal(item)}
                                    disabled={!orderId || !(canEdit || canCreate)}
                                  >
                                    <NavIcon icon={FaCircleCheck} size={14} />
                                  </button>
                                ) : null}
                                {showStatusChangeModal ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary mb-0 px-2"
                                    title="Status history"
                                    aria-label="Status history"
                                    onClick={() =>
                                      setStatusHistoryModal({
                                        open: true,
                                        orderId: orderId || '',
                                        orderNo: orderNo !== '—' ? orderNo : '',
                                      })
                                    }
                                    disabled={!orderId}
                                  >
                                    <NavIcon icon={FaClockRotateLeft} size={14} />
                                  </button>
                                ) : null}
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

      {showStatusChangeModal ? (
        <>
          <ChangeOrderStatusModal
            open={statusModal.open}
            orderId={statusModal.orderId}
            orderNo={statusModal.orderNo}
            currentStatus={statusModal.currentStatus}
            onClose={() =>
              setStatusModal({ open: false, orderId: '', orderNo: '', currentStatus: '' })
            }
            onSaved={handleStatusUpdated}
          />
          <OrderStatusUpdatesModal
            open={statusHistoryModal.open}
            orderId={statusHistoryModal.orderId}
            orderNo={statusHistoryModal.orderNo}
            onClose={() =>
              setStatusHistoryModal({ open: false, orderId: '', orderNo: '' })
            }
          />
        </>
      ) : null}

      <CustomerOrderHistoryModal
        open={orderHistoryModal.open}
        phone={orderHistoryModal.phone}
        email={orderHistoryModal.email}
        customerName={orderHistoryModal.customerName}
        currentOrderId={orderHistoryModal.currentOrderId}
        listPath={listPath}
        onClose={() =>
          setOrderHistoryModal({
            open: false,
            phone: '',
            email: '',
            customerName: '',
            currentOrderId: '',
          })
        }
      />

      <OrderConfirmationTagsModal
        open={confirmationModal.open}
        orderId={confirmationModal.orderId}
        orderNo={confirmationModal.orderNo}
        currentTags={confirmationModal.tags}
        onClose={() =>
          setConfirmationModal({ open: false, orderId: '', orderNo: '', tags: [] })
        }
        onSaved={handleConfirmationTagsUpdated}
      />

      <ValidateOrderAddressModal
        open={validateAddressModal.open}
        orderId={validateAddressModal.orderId}
        orderNo={validateAddressModal.orderNo}
        address={validateAddressModal.address}
        name={validateAddressModal.name}
        phone={validateAddressModal.phone}
        email={validateAddressModal.email}
        city={validateAddressModal.city}
        state={validateAddressModal.state}
        zip={validateAddressModal.zip}
        country={validateAddressModal.country}
        onClose={() =>
          setValidateAddressModal({
            open: false,
            orderId: '',
            orderNo: '',
            address: '',
            name: '',
            phone: '',
            email: '',
            city: '',
            state: '',
            zip: '',
            country: '',
          })
        }
        onSaved={handleAddressUpdated}
      />

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
          <TrackingStatusModal
            open={trackingStatusModal.open}
            orderId={trackingStatusModal.orderId}
            trackingId={trackingStatusModal.trackingId}
            orderNo={trackingStatusModal.orderNo}
            provider={trackingStatusModal.provider}
            trackingUrl={trackingStatusModal.trackingUrl}
            onClose={() =>
              setTrackingStatusModal({
                open: false,
                orderId: '',
                trackingId: '',
                orderNo: '',
                provider: '',
                trackingUrl: '',
              })
            }
          />
        </>
      ) : null}

      <DevApiSourcesFooter sources={apiSources} className="mt-3" />
    </div>
  );
}
