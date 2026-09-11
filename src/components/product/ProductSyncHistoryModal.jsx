import { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import {
  FaArrowUpRightFromSquare,
  FaArrowsRotate,
  FaBoxOpen,
  FaCalendarDay,
  FaCheck,
  FaChevronDown,
  FaCircleInfo,
  FaClock,
  FaCopy,
  FaLink,
  FaPlus,
  FaRotateRight,
  FaTriangleExclamation,
} from 'react-icons/fa6';
import AppModal from '../AppModal.jsx';
import NavIcon from '../NavIcon.jsx';
import { fetchProductVariationRequest } from '../../features/products/productsAPI.js';
import { fetchProcessesRequest } from '../../features/process/processAPI.js';
import { fetchLogsRequest } from '../../features/logs/logsAPI.js';
import {
  fetchSyncProductsForProductIdsRequest,
  productIdFromSyncRow,
} from '../../features/syncProduct/syncProductAPI.js';
import { pickIntegrationStoreLogoUrl } from '../../features/integration/integrationAPI.js';
import {
  integrationNameFromRecord,
  storeTypeLabel,
} from '../../routes/integration/integrationForm.js';
import {
  buildShopifyProductAdminUrl,
  pickShopifyProductIds,
} from '../../utils/parseStoreProductUrl.js';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { toast } from '../../utils/toast.js';
import './product-sync-history-modal.css';

const idFromRecord = (item) =>
  String(item?._id || item?.id || item?.product_id || '').trim();

const mappingIdFromRecord = (item) => String(item?._id || item?.id || '').trim();

const refId = (ref) => {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    return String(ref._id ?? ref.id ?? '').trim();
  }
  return String(ref).trim();
};

const refName = (ref) => {
  if (!ref || typeof ref !== 'object') return '';
  return String(ref.product_name || ref.name || ref.title || ref.store_name || '').trim();
};

const collectFamilyMeta = (body, rootId) => {
  const ids = new Set();
  const names = {};
  const images = {};
  const parentById = {};
  if (rootId) ids.add(String(rootId));

  const push = (item, parentId = '') => {
    if (!item || typeof item !== 'object') return;
    const id = idFromRecord(item);
    if (id) {
      ids.add(id);
      const name = String(item.product_name || item.name || item.title || '').trim();
      if (name) names[id] = name;
      const image = item.product_image ?? item.image ?? item.thumbnail ?? item.photo;
      if (image) images[id] = image;
      if (parentId) parentById[id] = String(parentId);
    }
    const kids = item.childproducts ?? item.child_products ?? item.variations;
    if (Array.isArray(kids)) kids.forEach((kid) => push(kid, id || parentId));
  };

  if (Array.isArray(body)) {
    body.forEach((item) => push(item, ''));
    return { ids: [...ids], names, images, parentById };
  }
  const record = body?.data ?? body?.product ?? body;
  if (Array.isArray(record)) record.forEach((item) => push(item, ''));
  else if (record && typeof record === 'object') push(record, '');
  return { ids: [...ids], names, images, parentById };
};

const pickSyncReferenceId = (item) => {
  const raw =
    item?.refference_id ??
    item?.reference_id ??
    item?.referenceId ??
    item?.external_id ??
    item?.remote_id ??
    '';
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    const product = String(raw.product_id ?? raw.productId ?? raw.id ?? '').trim();
    const variant = String(raw.variant_id ?? raw.variantId ?? '').trim();
    if (product && variant) return `${product}:${variant}`;
    return product;
  }
  return String(raw).trim();
};

const formatWhen = (value) => {
  if (!value) return '—';
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format('DD MMM YYYY h:mm a') : String(value);
};

const formatRelative = (value) => {
  if (!value) return '';
  const parsed = moment(value);
  return parsed.isValid() ? parsed.fromNow() : '';
};

const formatDuration = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return '—';
  const start = moment(createdAt);
  const end = moment(updatedAt);
  if (!start.isValid() || !end.isValid()) return '—';
  const diffMs = end.diff(start);
  if (diffMs < 0) return '—';
  const duration = moment.duration(diffMs);
  const hours = Math.floor(duration.asHours());
  const mins = duration.minutes();
  const secs = duration.seconds();
  const parts = [];
  if (hours > 0) parts.push(`${hours} hr`);
  if (mins > 0) parts.push(`${mins} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} sec`);
  return parts.join(' ');
};

const formatAction = (action) =>
  String(action || '—')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeStatus = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const isLinkedStatus = (value) => {
  const status = normalizeStatus(value);
  return (
    status === 'active' ||
    status === 'success' ||
    status === 'completed' ||
    status === 'synced' ||
    status === 'done'
  );
};

const isFailedStatus = (value) => {
  const status = normalizeStatus(value);
  return status === 'failed' || status === 'error';
};

const isPendingStatus = (value) => {
  const status = normalizeStatus(value);
  return (
    status === 'pending' ||
    status === 'not_started' ||
    status === 'in_progress' ||
    status === 'running' ||
    status === 'processing' ||
    status === 'partial' ||
    status === 'partially_synced'
  );
};

const isRunningProgress = (value) => {
  const status = normalizeStatus(value);
  return status === 'in_progress' || status === 'running' || status === 'processing';
};

const progressClass = (progress) => {
  const value = normalizeStatus(progress);
  if (value === 'completed' || value === 'done' || value === 'success') return 'psh-badge--ok';
  if (value === 'failed' || value === 'error') return 'psh-badge--err';
  if (value === 'in_progress' || value === 'running' || value === 'processing') return 'psh-badge--run';
  if (value === 'not_started' || value === 'pending') return 'psh-badge--wait';
  return 'psh-badge--muted';
};

const statusClass = (status) => {
  const value = normalizeStatus(status);
  if (isLinkedStatus(value)) return 'psh-badge--ok';
  if (isFailedStatus(value) || value === 'inactive') return 'psh-badge--err';
  if (isPendingStatus(value)) return value.includes('progress') ? 'psh-badge--run' : 'psh-badge--wait';
  return 'psh-badge--muted';
};

const statusIcon = (status) => {
  const value = normalizeStatus(status);
  if (isLinkedStatus(value)) return FaCheck;
  if (isFailedStatus(value)) return FaTriangleExclamation;
  if (isRunningProgress(value)) return FaArrowsRotate;
  if (isPendingStatus(value)) return FaClock;
  return null;
};

const prettyJson = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const SKIP_PROCESS_KEYS = new Set([
  '_id',
  'id',
  'action',
  'progress',
  'status',
  'remarks',
  'priority',
  'count',
  'page',
  'hits',
  'integration_id',
  'product_id',
  'category_id',
  'brand_id',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
  '__v',
]);

const extraProcessFields = (item) => {
  if (!item || typeof item !== 'object') return [];
  return Object.entries(item)
    .filter(([key, value]) => !SKIP_PROCESS_KEYS.has(key) && value != null && value !== '')
    .map(([key, value]) => ({ key, value: prettyJson(value) }));
};

const logCreator = (item) =>
  item?.created_by?.name ||
  item?.createdBy?.name ||
  item?.user?.name ||
  item?.created_by_name ||
  item?.userName ||
  (typeof item?.created_by === 'string' ? item.created_by : '') ||
  '—';

const logDescription = (item) =>
  String(
    item?.human_readable_description ||
      item?.humanReadableDescription ||
      item?.description ||
      item?.details ||
      item?.message ||
      ''
  ).trim();

const percentOf = (count, total) => {
  if (!total) return 0;
  return Math.round((Number(count) / Number(total)) * 100);
};

const mappingRole = ({ posProductId, rootId, familyIds, familyParentById, variantId, productType }) => {
  const type = String(productType || '').toLowerCase();
  const posId = String(posProductId || '').trim();
  const root = String(rootId || '').trim();
  if (!posId) return '';

  const isRoot = Boolean(root && posId === root);
  const isListedChild = Boolean(familyParentById?.[posId]) || (familyIds.includes(posId) && !isRoot);

  if (type === 'variable') {
    if (isRoot) return 'parent';
    if (isListedChild || variantId) return 'variant';
  }

  if (isListedChild) return 'variant';
  if (isRoot && type === 'variable') return 'parent';
  return '';
};

const pickMappingImageUrl = (row, posProductId, familyImages) => {
  const populated = typeof row?.product_id === 'object' && row.product_id ? row.product_id : null;
  const raw =
    populated?.product_image ??
    populated?.image ??
    row?.product_image ??
    row?.image ??
    familyImages?.[posProductId];
  return resolveCategoryMediaUrl(raw);
};

async function copyValue(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
    return true;
  } catch {
    toast.error('Unable to copy');
    return false;
  }
}

function CopyableId({ value, href, title }) {
  const [copied, setCopied] = useState(false);
  const text = String(value || '').trim();
  if (!text) return <span className="psh-id-empty">—</span>;

  const onCopy = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const ok = await copyValue(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <span className="psh-id">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="psh-id-value"
          title={title || text}
          onClick={(event) => event.stopPropagation()}
        >
          {text}
        </a>
      ) : (
        <span className="psh-id-value" title={title || text}>
          {text}
        </span>
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="psh-ext-icon"
          title="Open in Shopify"
          aria-label="Open in Shopify"
          onClick={(event) => event.stopPropagation()}
        >
          <NavIcon icon={FaArrowUpRightFromSquare} size={10} />
        </a>
      ) : null}
      <button
        type="button"
        className={`psh-copy-btn${copied ? ' is-copied' : ''}`}
        title={copied ? 'Copied' : 'Copy'}
        aria-label={copied ? 'Copied' : 'Copy ID'}
        onClick={onCopy}
      >
        <NavIcon icon={copied ? FaCheck : FaCopy} size={10} />
      </button>
    </span>
  );
}

function SyncStatusBadge({ status }) {
  const label = formatAction(status);
  const Icon = statusIcon(status);
  return (
    <span className={`psh-badge ${statusClass(status)}`}>
      {Icon ? <NavIcon icon={Icon} size={10} /> : null}
      {label}
    </span>
  );
}

function MetaItem({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="psh-meta">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SyncSummary({ productName, hasShopify, total, linked, inProgress, failed }) {
  const stats = [
    { key: 'total', label: 'Total Products', count: total, icon: FaBoxOpen, className: '' },
    { key: 'linked', label: 'Linked', count: linked, icon: FaLink, className: 'psh-stat--linked' },
    {
      key: 'progress',
      label: 'In Progress',
      count: inProgress,
      icon: FaArrowsRotate,
      className: 'psh-stat--progress',
    },
    {
      key: 'failed',
      label: 'Failed',
      count: failed,
      icon: FaTriangleExclamation,
      className: 'psh-stat--failed',
    },
  ];

  return (
    <section className="psh-summary">
      <p className="psh-summary-kicker">{hasShopify ? 'Shopify integration' : 'Store integration'}</p>
      <h6 className="psh-summary-title">{productName}</h6>
      <div className="psh-summary-stats">
        {stats.map((stat) => (
          <div key={stat.key} className={`psh-stat ${stat.className}`.trim()}>
            <span className="psh-stat-icon">
              <NavIcon icon={stat.icon} size={13} />
            </span>
            <div className="psh-stat-copy">
              <span className="psh-stat-label">{stat.label}</span>
              <span className="psh-stat-value">{stat.count}</span>
              <span className="psh-stat-pct">{percentOf(stat.count, total)}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MappingCard({
  row,
  rootProductId,
  productType,
  familyIds,
  familyNames,
  familyImages,
  familyParentById,
  integration,
  expanded,
  onToggle,
}) {
  const mappingId = mappingIdFromRecord(row);
  const referenceId = pickSyncReferenceId(row);
  const shopifyIds = pickShopifyProductIds(referenceId);
  const posProductId = productIdFromSyncRow(row);
  const created = row.createdAt ?? row.created_at;
  const updated = row.updatedAt ?? row.updated_at;
  const lastSync =
    row.last_synced_at || row.lastSyncedAt || row.synced_at || row.syncedAt || updated;
  const role = mappingRole({
    posProductId,
    rootId: rootProductId,
    familyIds,
    familyParentById,
    variantId: shopifyIds.variantId,
    productType,
  });
  const posName = familyNames[posProductId] || refName(row.product_id);
  const storeLabel = integration
    ? `${integrationNameFromRecord(integration)}${
        integration.store_type || integration.storeType
          ? ` (${storeTypeLabel(integration.store_type || integration.storeType)})`
          : ''
      }`
    : 'Store mapping';
  const imageUrl = pickMappingImageUrl(row, posProductId, familyImages);
  const logo = !imageUrl ? pickIntegrationStoreLogoUrl(integration) : '';
  const productUrl = shopifyIds.productId
    ? buildShopifyProductAdminUrl(integration, shopifyIds.productId)
    : '';
  const variantUrl = shopifyIds.variantId
    ? buildShopifyProductAdminUrl(
        integration,
        `${shopifyIds.productId}:${shopifyIds.variantId}`
      )
    : '';
  const variantDisplay = shopifyIds.variantId
    ? shopifyIds.variantId
    : role === 'parent'
      ? 'Parent product'
      : '—';

  return (
    <article
      className={`psh-card${role === 'parent' ? ' psh-card--parent' : ''}${
        role === 'variant' ? ' psh-card--child' : ''
      }`}
    >
      <header className="psh-card-head">
        <div className="psh-card-identity">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="psh-thumb" />
          ) : logo ? (
            <img src={logo} alt="" className="psh-thumb" />
          ) : (
            <span className="psh-thumb psh-thumb--placeholder">
              <NavIcon icon={FaBoxOpen} size={18} />
            </span>
          )}
          <div className="psh-card-copy">
            <div className="psh-card-title-row">
              <h6 className="psh-card-title">{posName || storeLabel}</h6>
              {role === 'parent' ? <span className="psh-role psh-role--parent">Parent product</span> : null}
              {role === 'variant' ? <span className="psh-role psh-role--variant">Variant</span> : null}
            </div>
            <p className="psh-card-sub">
              {posName ? storeLabel : null}
              {posName ? ' · ' : null}
              Mapping {mappingId || '—'}
            </p>
          </div>
        </div>
        <div className="psh-card-actions">
          <SyncStatusBadge status={row.status} />
          <button
            type="button"
            className="psh-icon-btn"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse mapping details' : 'Expand mapping details'}
            onClick={onToggle}
          >
            <NavIcon
              icon={FaChevronDown}
              size={12}
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
            />
          </button>
        </div>
      </header>

      <dl className={`psh-meta-grid${expanded ? '' : ' psh-meta-grid--compact'}`}>
        {expanded ? (
          <>
            <MetaItem label="POS Product">
              <CopyableId value={posProductId || rootProductId} />
            </MetaItem>
            <MetaItem label="Reference ID">
              <CopyableId value={referenceId} />
            </MetaItem>
          </>
        ) : null}
        <MetaItem label="Shopify Product">
          {shopifyIds.productId ? (
            <CopyableId value={shopifyIds.productId} href={productUrl || undefined} />
          ) : (
            <span className="psh-id-empty">—</span>
          )}
        </MetaItem>
        <MetaItem label="Shopify Variant">
          {shopifyIds.variantId ? (
            <CopyableId value={shopifyIds.variantId} href={variantUrl || undefined} />
          ) : (
            <span className="psh-id-empty">{variantDisplay}</span>
          )}
        </MetaItem>
        {expanded ? (
          <MetaItem label="Sync Price">{row.sync_price ?? row.syncPrice ?? '—'}</MetaItem>
        ) : null}
      </dl>

      {expanded ? (
        <div className="psh-timeline">
          <div className="psh-time-block psh-time-block--sync">
            <p className="psh-time-label">
              <NavIcon icon={FaCheck} size={11} /> Last synced
            </p>
            <p className="psh-time-value">{formatWhen(lastSync)}</p>
            {formatRelative(lastSync) ? <p className="psh-time-rel">{formatRelative(lastSync)}</p> : null}
          </div>
          <div className="psh-time-block">
            <p className="psh-time-label">
              <NavIcon icon={FaPlus} size={11} /> Created
            </p>
            <p className="psh-time-value">{formatWhen(created)}</p>
          </div>
          <div className="psh-time-block">
            <p className="psh-time-label">
              <NavIcon icon={FaCalendarDay} size={11} /> Updated
            </p>
            <p className="psh-time-value">{formatWhen(updated)}</p>
          </div>
        </div>
      ) : (
        <div className="psh-timeline">
          <div className="psh-time-block psh-time-block--sync">
            <p className="psh-time-label">
              <NavIcon icon={FaCheck} size={11} /> Last synced
            </p>
            <p className="psh-time-value">{formatWhen(lastSync)}</p>
            {formatRelative(lastSync) ? <p className="psh-time-rel">{formatRelative(lastSync)}</p> : null}
          </div>
        </div>
      )}

      <div className="psh-card-foot">
        <button type="button" className="psh-details-btn" onClick={onToggle}>
          {expanded ? 'Hide details' : 'View details'}
          <NavIcon
            icon={FaChevronDown}
            size={10}
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      </div>
    </article>
  );
}

function HistorySkeleton() {
  return (
    <div className="psh-stack" aria-hidden="true">
      <div className="psh-skel psh-skel-summary" />
      <div className="psh-skel psh-skel-card" />
      <div className="psh-skel psh-skel-card" />
    </div>
  );
}

export default function ProductSyncHistoryModal({
  open,
  onClose,
  productId,
  productName,
  productType = '',
  integrations = [],
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [familyIds, setFamilyIds] = useState([]);
  const [familyNames, setFamilyNames] = useState({});
  const [familyImages, setFamilyImages] = useState({});
  const [familyParentById, setFamilyParentById] = useState({});
  const [mappings, setMappings] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [openProcessId, setOpenProcessId] = useState('');
  const [openLogId, setOpenLogId] = useState('');
  const [collapsedMappingIds, setCollapsedMappingIds] = useState(() => new Set());
  const [mappingsOpen, setMappingsOpen] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!open || !productId) return undefined;

    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      setMappings([]);
      setProcesses([]);
      setLogs([]);
      setFamilyIds([]);
      setFamilyNames({});
      setFamilyImages({});
      setFamilyParentById({});
      setOpenProcessId('');
      setOpenLogId('');
      setCollapsedMappingIds(new Set());
      setMappingsOpen(true);

      try {
        let ids = [String(productId)];
        let names = {};
        let images = {};
        let parentById = {};
        try {
          const variationBody = await fetchProductVariationRequest(productId);
          const meta = collectFamilyMeta(variationBody, productId);
          ids = meta.ids;
          names = meta.names;
          images = meta.images;
          parentById = meta.parentById;
        } catch {
          ids = [String(productId)];
        }
        if (!ids.includes(String(productId))) ids.unshift(String(productId));
        if (cancelled) return;
        setFamilyIds(ids);
        setFamilyNames(names);
        setFamilyImages(images);
        setFamilyParentById(parentById);

        const [syncRows, processChunks, logChunks] = await Promise.all([
          fetchSyncProductsForProductIdsRequest(ids, { populate: 'integration_id' }),
          Promise.all(
            ids.map((id) =>
              fetchProcessesRequest({
                product_id: id,
                limit: 200,
                sortBy: 'createdAt',
                sortOrder: 'desc',
              }).catch(() => ({ data: [] }))
            )
          ),
          Promise.all(
            ids.map((id) =>
              fetchLogsRequest({
                reference_id: id,
                reference_type: 'product',
                limit: 200,
                sortBy: 'createdAt',
                sortOrder: 'desc',
              }).catch(() => ({ data: [] }))
            )
          ),
        ]);

        if (cancelled) return;

        const processMap = new Map();
        processChunks.forEach((chunk) => {
          (Array.isArray(chunk?.data) ? chunk.data : []).forEach((row) => {
            const id = idFromRecord(row);
            if (id) processMap.set(id, row);
          });
        });
        const processList = [...processMap.values()].sort((a, b) => {
          const ta = new Date(a.createdAt || a.created_at || 0).getTime();
          const tb = new Date(b.createdAt || b.created_at || 0).getTime();
          return tb - ta;
        });

        const logMap = new Map();
        logChunks.forEach((chunk) => {
          (Array.isArray(chunk?.data) ? chunk.data : []).forEach((row) => {
            const id = idFromRecord(row);
            if (id) logMap.set(id, row);
          });
        });
        const logList = [...logMap.values()].sort((a, b) => {
          const ta = new Date(a.createdAt || a.created_at || 0).getTime();
          const tb = new Date(b.createdAt || b.created_at || 0).getTime();
          return tb - ta;
        });

        setMappings(Array.isArray(syncRows) ? syncRows : []);
        setProcesses(processList);
        setLogs(logList);
        setStatus('succeeded');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load sync history');
          setStatus('failed');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, productId, reloadTick]);

  const integrationById = useMemo(() => {
    const map = new Map();
    (Array.isArray(integrations) ? integrations : []).forEach((row) => {
      const id = idFromRecord(row);
      if (id) map.set(id, row);
    });
    return map;
  }, [integrations]);

  const resolveIntegration = (syncRow) => {
    const populated =
      syncRow?.integration_id && typeof syncRow.integration_id === 'object'
        ? syncRow.integration_id
        : null;
    const id = refId(syncRow?.integration_id);
    const fromList = id ? integrationById.get(id) : null;
    if (fromList || populated) return { ...(populated || {}), ...(fromList || {}) };
    return populated;
  };

  const title = productName || 'Product';

  const summary = useMemo(() => {
    const total = familyIds.length || (productId ? 1 : 0);
    const linked = mappings.filter((row) => isLinkedStatus(row.status)).length;
    const inProgress = mappings.filter((row) => isPendingStatus(row.status)).length;
    const failed = mappings.filter((row) => isFailedStatus(row.status)).length;
    const hasShopify = mappings.some((row) => {
      const populated =
        row?.integration_id && typeof row.integration_id === 'object' ? row.integration_id : null;
      const id = refId(row?.integration_id);
      const integration = {
        ...(populated || {}),
        ...(id ? integrationById.get(id) || {} : {}),
      };
      const storeType = String(integration.store_type || integration.storeType || '').toLowerCase();
      if (storeType === 'shopify') return true;
      return Boolean(pickShopifyProductIds(pickSyncReferenceId(row)).productId);
    });
    return { total, linked, inProgress, failed, hasShopify };
  }, [familyIds, mappings, integrationById, productId]);

  const footerTone = useMemo(() => {
    const failedMappings = mappings.filter((row) => isFailedStatus(row.status)).length;
    const pendingMappings = mappings.filter((row) => isPendingStatus(row.status)).length;
    const linkedMappings = mappings.filter((row) => isLinkedStatus(row.status)).length;
    if (!mappings.length) return { kind: 'empty', label: 'No mappings' };
    if (failedMappings > 0) return { kind: 'failed', label: `${failedMappings} failed` };
    if (pendingMappings > 0 || linkedMappings < mappings.length) {
      return { kind: 'partial', label: 'Partially synced' };
    }
    return { kind: 'ok', label: 'All synced' };
  }, [mappings]);

  const syncedCount = mappings.filter((row) => isLinkedStatus(row.status)).length;

  const toggleMapping = (id) => {
    setCollapsedMappingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      className="psh-app-dialog"
      title={
        <span className="psh-title">
          <span className="psh-title-icon">
            <NavIcon icon={FaArrowsRotate} size={14} />
          </span>
          Sync status history
        </span>
      }
      subtitle={
        <>
          Full sync history for: <span className="psh-subtitle-name">{title}</span>
        </>
      }
      footer={
        <div className="psh-footer">
          <div className="psh-footer-meta">
            {status === 'succeeded' ? (
              <>
                <span className="psh-footer-info">
                  <NavIcon icon={FaCircleInfo} size={12} />
                  Showing {mappings.length} product{mappings.length === 1 ? '' : 's'}
                </span>
                <span className={`psh-badge ${statusClass(
                  footerTone.kind === 'ok'
                    ? 'synced'
                    : footerTone.kind === 'failed'
                      ? 'failed'
                      : footerTone.kind === 'partial'
                        ? 'partial'
                        : ''
                )}`}>
                  {footerTone.kind === 'ok' ? <NavIcon icon={FaCheck} size={10} /> : null}
                  {footerTone.kind === 'failed' ? <NavIcon icon={FaTriangleExclamation} size={10} /> : null}
                  {footerTone.kind === 'partial' ? <NavIcon icon={FaClock} size={10} /> : null}
                  {footerTone.label}
                </span>
              </>
            ) : null}
          </div>
          <button type="button" className="btn btn-secondary mb-0" onClick={onClose}>
            Close
          </button>
        </div>
      }
      ariaLabelledBy="productSyncHistoryModalLabel"
    >
      <div className="psh-modal">
        {status === 'loading' ? <HistorySkeleton /> : null}

        {status === 'failed' ? (
          <div className="psh-error-state">
            <span className="psh-error-icon">
              <NavIcon icon={FaTriangleExclamation} size={16} />
            </span>
            <h6>Unable to load sync history</h6>
            <p>{error || 'Please try again.'}</p>
            <button
              type="button"
              className="btn btn-primary mb-0"
              onClick={() => setReloadTick((value) => value + 1)}
            >
              <NavIcon icon={FaRotateRight} size={12} className="me-1" />
              Retry
            </button>
          </div>
        ) : null}

        {status === 'succeeded' ? (
          <>
            <SyncSummary
              productName={title}
              hasShopify={summary.hasShopify}
              total={summary.total}
              linked={summary.linked}
              inProgress={summary.inProgress}
              failed={summary.failed}
            />

            <section className="psh-section">
              <div className="psh-section-head">
                <h6 className="psh-section-title">
                  <span className="psh-section-title-icon">
                    <NavIcon icon={FaLink} size={13} />
                  </span>
                  Current store mappings
                </h6>
                <div className="psh-section-meta">
                  <span className="psh-section-count">
                    {syncedCount} synced
                  </span>
                  <button
                    type="button"
                    className="psh-icon-btn"
                    aria-expanded={mappingsOpen}
                    aria-label={mappingsOpen ? 'Collapse mappings' : 'Expand mappings'}
                    onClick={() => setMappingsOpen((value) => !value)}
                  >
                    <NavIcon
                      icon={FaChevronDown}
                      size={12}
                      style={{
                        transform: mappingsOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                </div>
              </div>

              {mappingsOpen ? (
                mappings.length === 0 ? (
                  <div className="psh-empty-state">
                    <span className="psh-empty-icon">
                      <NavIcon icon={FaLink} size={16} />
                    </span>
                    <h6>No store mappings yet</h6>
                    <p>This product has not been linked to a Shopify store.</p>
                  </div>
                ) : (
                  <div className="psh-stack">
                    {mappings.map((row, index) => {
                      const key = mappingIdFromRecord(row) || String(index);
                      return (
                        <MappingCard
                          key={key}
                          row={row}
                          rootProductId={productId}
                          productType={productType}
                          familyIds={familyIds}
                          familyNames={familyNames}
                          familyImages={familyImages}
                          familyParentById={familyParentById}
                          integration={resolveIntegration(row)}
                          expanded={!collapsedMappingIds.has(key)}
                          onToggle={() => toggleMapping(key)}
                        />
                      );
                    })}
                  </div>
                )
              ) : null}
            </section>

            <section className="psh-section">
              <div className="psh-section-head">
                <h6 className="psh-section-title">
                  <span className="psh-section-title-icon">
                    <NavIcon icon={FaArrowsRotate} size={13} />
                  </span>
                  Sync process jobs
                </h6>
                <span className="psh-section-count">{processes.length}</span>
              </div>
              {processes.length === 0 ? (
                <div className="psh-empty-state">
                  <span className="psh-empty-icon">
                    <NavIcon icon={FaClock} size={16} />
                  </span>
                  <h6>No process jobs</h6>
                  <p>No sync process jobs were found for this product family.</p>
                </div>
              ) : (
                <div className="psh-stack">
                  {processes.map((item, index) => {
                    const id = idFromRecord(item);
                    const created = item.createdAt ?? item.created_at;
                    const updated = item.updatedAt ?? item.updated_at;
                    const extras = extraProcessFields(item);
                    const expanded = openProcessId === id;
                    return (
                      <article key={id || index} className="psh-card">
                        <header className="psh-card-head">
                          <div className="psh-card-copy">
                            <h6 className="psh-card-title">{formatAction(item.action)}</h6>
                            <p className="psh-card-sub">
                              {formatWhen(created)}
                              {formatRelative(created) ? ` · ${formatRelative(created)}` : ''}
                            </p>
                          </div>
                          <div className="psh-card-actions">
                            <span className={`psh-badge ${progressClass(item.progress)}`}>
                              {formatAction(item.progress)}
                            </span>
                            <SyncStatusBadge status={item.status} />
                          </div>
                        </header>
                        <dl className="psh-meta-grid">
                          <MetaItem label="Tracking ID">
                            <CopyableId value={id} />
                          </MetaItem>
                          <MetaItem label="Integration">
                            {refName(item.integration_id) || refId(item.integration_id) || '—'}
                          </MetaItem>
                          <MetaItem label="Target product">
                            {refName(item.product_id) || refId(item.product_id) || '—'}
                          </MetaItem>
                          <MetaItem label="Priority">{item.priority ?? '—'}</MetaItem>
                          <MetaItem label="Count">{item.count ?? '—'}</MetaItem>
                          <MetaItem label="Duration">{formatDuration(created, updated)}</MetaItem>
                        </dl>
                        {extras.length ? (
                          <button
                            type="button"
                            className="psh-more"
                            onClick={() => setOpenProcessId(expanded ? '' : id)}
                          >
                            {expanded ? 'Hide extra fields' : `Show ${extras.length} extra field(s)`}
                          </button>
                        ) : null}
                        {expanded ? (
                          <dl className="psh-meta-grid psh-meta-grid--block">
                            {extras.map((field) => (
                              <MetaItem key={field.key} label={field.key}>
                                <pre className="psh-pre">{field.value}</pre>
                              </MetaItem>
                            ))}
                          </dl>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="psh-section">
              <div className="psh-section-head">
                <h6 className="psh-section-title">
                  <span className="psh-section-title-icon">
                    <NavIcon icon={FaCalendarDay} size={13} />
                  </span>
                  Audit / activity logs
                </h6>
                <span className="psh-section-count">{logs.length}</span>
              </div>
              {logs.length === 0 ? (
                <div className="psh-empty-state">
                  <span className="psh-empty-icon">
                    <NavIcon icon={FaCircleInfo} size={16} />
                  </span>
                  <h6>No audit logs</h6>
                  <p>No activity logs were found for this product family.</p>
                </div>
              ) : (
                <div className="psh-stack">
                  {logs.map((item, index) => {
                    const id = idFromRecord(item);
                    const created = item.createdAt ?? item.created_at;
                    const description = logDescription(item);
                    const expanded = openLogId === id;
                    const tags = Array.isArray(item.tags) ? item.tags : [];
                    return (
                      <article key={id || index} className="psh-card">
                        <header className="psh-card-head">
                          <div className="psh-card-copy">
                            <h6 className="psh-card-title">
                              {item.action || item.title || item.event || 'Log'}
                            </h6>
                            <p className="psh-card-sub">
                              {formatWhen(created)} · {logCreator(item)}
                            </p>
                          </div>
                          <SyncStatusBadge status={item.status} />
                        </header>
                        {description ? <p className="psh-desc">{description}</p> : null}
                        {tags.length ? (
                          <div className="psh-tags">
                            {tags.map((tag) => (
                              <span key={String(tag)} className="psh-tag">
                                {String(tag)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <dl className="psh-meta-grid">
                          <MetaItem label="Log ID">
                            <CopyableId value={id} />
                          </MetaItem>
                          <MetaItem label="URL">{item.url || '—'}</MetaItem>
                          <MetaItem label="Reference">
                            {item.reference_id || item.referenceId || '—'}
                          </MetaItem>
                        </dl>
                        {item.description || item.details || item.meta ? (
                          <button
                            type="button"
                            className="psh-more"
                            onClick={() => setOpenLogId(expanded ? '' : id)}
                          >
                            {expanded ? 'Hide raw details' : 'Show raw details'}
                          </button>
                        ) : null}
                        {expanded ? (
                          <pre className="psh-pre">
                            {prettyJson({
                              description: item.description,
                              details: item.details,
                              meta: item.meta,
                              data: item.data,
                            })}
                          </pre>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppModal>
  );
}
