import { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import {
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaArrowsRotate,
  FaCalendarDay,
  FaCheck,
  FaCircleInfo,
  FaClock,
  FaClockRotateLeft,
  FaCopy,
  FaListOl,
  FaRotateRight,
  FaTriangleExclamation,
  FaUser,
} from 'react-icons/fa6';
import AppModal from '../AppModal.jsx';
import NavIcon from '../NavIcon.jsx';
import { fetchOrderStatusUpdatesRequest } from '../../features/orders/ordersAPI.js';
import { fetchProcessesRequest } from '../../features/process/processAPI.js';
import { fetchLogsRequest } from '../../features/logs/logsAPI.js';
import { posInvoiceRoutePath, withBase } from '../../config/appBase.js';
import { toast } from '../../utils/toast.js';
import {
  buildHumanReadableLogView,
  formatLogMoney,
} from '../../utils/logHumanReadable.js';
import { formatOrderStatusOptionLabel } from './ChangeOrderStatusModal.jsx';
import { orderStatusBadgeClass } from './orderStatusBadge.js';
import '../product/product-sync-history-modal.css';
import './order-status-history-modal.css';

const idFromRecord = (item) => String(item?._id || item?.id || '').trim();

const refId = (ref) => {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object' && !Array.isArray(ref)) {
    return String(ref._id ?? ref.id ?? '').trim();
  }
  return String(ref).trim();
};

const refName = (ref) => {
  if (!ref || typeof ref !== 'object') return '';
  return String(
    ref.name || ref.store_name || ref.order_no || ref.orderNo || ref.title || ''
  ).trim();
};

const getOrderStatus = (row) => {
  const value = row?.order_status ?? row?.orderStatus ?? row?.to_status ?? row?.toStatus;
  return value != null && String(value).trim() !== '' ? String(value).trim() : '';
};

const getChangedBy = (row) => {
  const user = row?.created_by ?? row?.updated_by ?? row?.user_id ?? row?.changed_by;
  if (user && typeof user === 'object') {
    const name = String(user.name ?? '').trim();
    if (name) return name;
    const email = String(user.email ?? '').trim();
    if (email) return email;
  }
  if (typeof user === 'string' && user.trim()) return user.trim();
  return '—';
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

const isOkStatus = (value) => {
  const status = normalizeStatus(value);
  return (
    status === 'active' ||
    status === 'success' ||
    status === 'completed' ||
    status === 'synced' ||
    status === 'done' ||
    status === 'delivered' ||
    status === 'confirmed'
  );
};

const isFailedStatus = (value) => {
  const status = normalizeStatus(value);
  return (
    status === 'failed' ||
    status === 'error' ||
    status === 'cancelled' ||
    status === 'canceled'
  );
};

const isPendingStatus = (value) => {
  const status = normalizeStatus(value);
  return (
    status === 'pending' ||
    status === 'not_started' ||
    status === 'in_progress' ||
    status === 'running' ||
    status === 'processing' ||
    status === 'placed' ||
    status === 'on_hold' ||
    status === 'packed'
  );
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
  if (isOkStatus(value)) return 'psh-badge--ok';
  if (isFailedStatus(value) || value === 'inactive') return 'psh-badge--err';
  if (isPendingStatus(value)) return value.includes('progress') ? 'psh-badge--run' : 'psh-badge--wait';
  return 'psh-badge--muted';
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

const PROCESS_HEADER_KEYS = new Set(['action', 'progress', 'status']);

const PROCESS_DETAIL_ORDER = [
  'tracking_id',
  'integration_id',
  'order_id',
  'product_id',
  'category_id',
  'brand_id',
  'company_id',
  'priority',
  'count',
  'page',
  'offset',
  'limit',
  'hits',
  'remarks',
  'created_by',
  'updated_by',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'duration',
];

const PROCESS_LABELS = {
  tracking_id: 'Tracking ID',
  integration_id: 'Integration',
  order_id: 'Order',
  product_id: 'Product',
  category_id: 'Category',
  brand_id: 'Brand',
  company_id: 'Company',
  priority: 'Priority',
  count: 'Count',
  page: 'Page',
  offset: 'Offset',
  limit: 'Limit',
  hits: 'Hits',
  remarks: 'Remarks',
  created_by: 'Created by',
  updated_by: 'Updated by',
  createdAt: 'Created at',
  updatedAt: 'Updated at',
  deletedAt: 'Deleted at',
  duration: 'Duration',
};

const formatProcessLabel = (key) =>
  PROCESS_LABELS[key] ||
  String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const formatRefDisplay = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    return (
      refName(value) ||
      String(value.company_name || value.companyName || value.email || '').trim() ||
      refId(value)
    );
  }
  return String(value).trim();
};

const isEmptyProcessValue = (value) => {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

/** All process fields for the details panel (header action/progress/status excluded). */
const buildProcessDetails = (item) => {
  if (!item || typeof item !== 'object') return [];

  const created = item.createdAt ?? item.created_at;
  const updated = item.updatedAt ?? item.updated_at;
  const known = {
    tracking_id: idFromRecord(item),
    integration_id: item.integration_id,
    order_id: item.order_id,
    product_id: item.product_id,
    category_id: item.category_id,
    brand_id: item.brand_id,
    company_id: item.company_id,
    priority: item.priority,
    count: item.count,
    page: item.page,
    offset: item.offset,
    limit: item.limit,
    hits: item.hits,
    remarks: item.remarks,
    created_by: item.created_by,
    updated_by: item.updated_by,
    createdAt: created,
    updatedAt: updated,
    deletedAt: item.deletedAt ?? item.deleted_at,
    duration: formatDuration(created, updated),
  };

  const rows = [];
  const used = new Set([...PROCESS_HEADER_KEYS, '_id', 'id', '__v', 'created_at', 'updated_at', 'deleted_at']);

  PROCESS_DETAIL_ORDER.forEach((key) => {
    used.add(key);
    const value = known[key];
    if (isEmptyProcessValue(value)) return;
    rows.push({ key, label: formatProcessLabel(key), value, kind: key });
  });

  Object.entries(item).forEach(([key, value]) => {
    if (used.has(key) || isEmptyProcessValue(value)) return;
    rows.push({ key, label: formatProcessLabel(key), value, kind: 'extra' });
  });

  return rows;
};

const renderProcessDetailValue = (detail) => {
  const { kind, value } = detail;
  if (kind === 'tracking_id') {
    return <CopyableId value={refId(value) || value} />;
  }
  if (
    kind === 'integration_id' ||
    kind === 'order_id' ||
    kind === 'product_id' ||
    kind === 'category_id' ||
    kind === 'brand_id' ||
    kind === 'company_id'
  ) {
    const label = formatRefDisplay(value);
    const id = refId(value);
    if (!id && !label) return '—';
    if (!id) return label;
    return (
      <>
        {label && label !== id ? (
          <span className="text-sm text-dark me-1" title={`${label} (${id})`}>
            {label}
          </span>
        ) : null}
        <CopyableId value={id} title={label || id} />
      </>
    );
  }
  if (kind === 'created_by' || kind === 'updated_by') {
    return formatRefDisplay(value) || '—';
  }
  if (kind === 'createdAt' || kind === 'updatedAt' || kind === 'deletedAt') {
    return (
      <>
        {formatWhen(value)}
        {formatRelative(value) ? (
          <span className="psh-time-rel"> · {formatRelative(value)}</span>
        ) : null}
      </>
    );
  }
  if (kind === 'remarks') {
    return <span className="psh-desc" style={{ margin: 0 }}>{String(value)}</span>;
  }
  if (kind === 'extra' || (value && typeof value === 'object')) {
    return <pre className="psh-pre">{prettyJson(value)}</pre>;
  }
  return String(value);
};

const logCreator = (item) =>
  item?.created_by?.name ||
  item?.createdBy?.name ||
  item?.user?.name ||
  item?.created_by_name ||
  item?.userName ||
  (typeof item?.created_by === 'string' ? item.created_by : '') ||
  '—';

function formatDetailMoney(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return formatLogMoney(raw);
}

function HumanValue({ value }) {
  const raw = String(value ?? '').trim();
  if (!raw) return <span className="osh-log-value osh-log-value--muted">—</span>;
  if (/^[a-f0-9]{24}$/i.test(raw)) {
    return (
      <code className="osh-log-value osh-log-value--id" title={raw}>
        {raw.slice(0, 8)}…{raw.slice(-4)}
      </code>
    );
  }
  return <span className="osh-log-value">{raw}</span>;
}

function OrderLogHumanReadable({ item }) {
  const view = buildHumanReadableLogView(item);
  if (!view.hasStructured && !view.summary) return null;

  const changedFields = view.fieldChanges.filter((row) => row.changed);
  const unchangedFields = view.fieldChanges.filter((row) => !row.changed);
  const productRows = view.products?.rows || [];

  return (
    <div className="osh-log-human">
      {view.summary ? <p className="psh-desc">{view.summary}</p> : null}

      {changedFields.length || unchangedFields.length ? (
        <section className="osh-log-block">
          <div className="osh-log-block-head">
            <div>
              <h6 className="osh-log-block-title">Change comparison</h6>
              <span className="osh-log-block-sub">Before and after values for this update</span>
            </div>
            <span className="psh-badge psh-badge--run">
              {changedFields.length} change{changedFields.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="table-responsive">
            <table className="osh-log-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {[...changedFields, ...unchangedFields].map((row) => (
                  <tr key={row.key} className={row.changed ? 'is-changed' : ''}>
                    <td>
                      <span className="osh-log-field">{row.label}</span>
                      {row.changed ? <span className="osh-log-dot" title="Changed" /> : null}
                    </td>
                    <td>
                      <HumanValue value={row.before} />
                    </td>
                    <td>
                      <HumanValue value={row.after} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {productRows.length ? (
        <section className="osh-log-block">
          <div className="osh-log-block-head">
            <div>
              <h6 className="osh-log-block-title">Product cart</h6>
              <span className="osh-log-block-sub">Line items before and after this update</span>
            </div>
            <span className="psh-badge psh-badge--run">
              {productRows.filter((row) => row.status !== 'unchanged').length} line change
              {productRows.filter((row) => row.status !== 'unchanged').length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="table-responsive">
            <table className="osh-log-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-end">Before qty</th>
                  <th className="text-end">Before price</th>
                  <th className="text-end">After qty</th>
                  <th className="text-end">After price</th>
                  <th className="text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.status === 'added'
                        ? 'is-added'
                        : row.status === 'removed'
                          ? 'is-removed'
                          : row.status === 'changed'
                            ? 'is-changed'
                            : ''
                    }
                  >
                    <td>
                      <div className="osh-log-product-name">{row.name}</div>
                      {row.productId ? (
                        <code className="osh-log-value osh-log-value--id" title={row.productId}>
                          {row.productId.slice(0, 8)}…{row.productId.slice(-4)}
                        </code>
                      ) : null}
                    </td>
                    <td className="text-end">{row.before?.qty || '—'}</td>
                    <td className="text-end">
                      {row.before ? formatDetailMoney(row.before.price) : '—'}
                    </td>
                    <td className="text-end">{row.after?.qty || '—'}</td>
                    <td className="text-end">
                      {row.after ? formatDetailMoney(row.after.price) : '—'}
                    </td>
                    <td className="text-end">
                      {row.status === 'added' ? (
                        <span className="psh-badge psh-badge--ok">Added</span>
                      ) : row.status === 'removed' ? (
                        <span className="psh-badge psh-badge--err">Removed</span>
                      ) : row.status === 'changed' ? (
                        <span className="psh-badge psh-badge--wait">Changed</span>
                      ) : (
                        <span className="psh-badge psh-badge--muted">Same</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : view.products?.after?.length && !view.products?.before?.length ? (
        <section className="osh-log-block">
          <div className="osh-log-block-head">
            <div>
              <h6 className="osh-log-block-title">Products</h6>
              <span className="osh-log-block-sub">Line items on this log</span>
            </div>
            <span className="psh-badge psh-badge--muted">{view.products.after.length}</span>
          </div>
          <div className="table-responsive">
            <table className="osh-log-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Price</th>
                  <th className="text-end">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {view.products.after.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <div className="osh-log-product-name">{row.name}</div>
                    </td>
                    <td className="text-end">{row.qty || '—'}</td>
                    <td className="text-end">{formatDetailMoney(row.price)}</td>
                    <td className="text-end">{formatDetailMoney(row.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view.sections.map((section) => (
        <section className="osh-log-block" key={section.title}>
          <div className="osh-log-block-head">
            <h6 className="osh-log-block-title">{section.title}</h6>
          </div>
          <div className="table-responsive">
            <table className="osh-log-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={`${section.title}-${row.key || row.label}`}>
                    <td>
                      <span className="osh-log-field">{row.label}</span>
                    </td>
                    <td>
                      <HumanValue value={row.value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

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

function CopyableId({ value, href, title, openLabel = 'Open' }) {
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
          title={openLabel}
          aria-label={openLabel}
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

function StatusBadge({ status }) {
  if (!status) return <span className="psh-id-empty">—</span>;
  return (
    <span className={`badge text-xxs ${orderStatusBadgeClass(status)}`}>
      {formatOrderStatusOptionLabel(status)}
    </span>
  );
}

function SyncStatusBadge({ status }) {
  const label = formatAction(status);
  return <span className={`psh-badge ${statusClass(status)}`}>{label}</span>;
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

function HistorySkeleton() {
  return (
    <div className="psh-stack" aria-hidden="true">
      <div className="psh-skel psh-skel-summary" />
      <div className="psh-skel psh-skel-card" />
      <div className="psh-skel psh-skel-card" />
    </div>
  );
}

/**
 * Order status history — same layout as product sync status history.
 */
export default function OrderStatusUpdatesModal({
  open,
  orderId,
  orderNo,
  currentStatus = '',
  onClose,
}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [openProcessId, setOpenProcessId] = useState('');
  const [openLogId, setOpenLogId] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!open || !orderId) return undefined;

    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      setUpdates([]);
      setProcesses([]);
      setLogs([]);
      setOpenProcessId('');
      setOpenLogId('');

      try {
        const [updateResult, processResult, logResult] = await Promise.all([
          fetchOrderStatusUpdatesRequest({ order_id: orderId, limit: 200 }),
          fetchProcessesRequest({
            order_id: orderId,
            limit: 200,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            populate: 'integration_id,order_id,product_id,category_id,brand_id,company_id,created_by,updated_by',
          }).catch(() => ({ data: [] })),
          fetchLogsRequest({
            reference_id: orderId,
            reference_type: 'order',
            limit: 200,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }).catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const updateList = Array.isArray(updateResult?.data) ? updateResult.data : [];
        const processList = (Array.isArray(processResult?.data) ? processResult.data : []).filter(
          (row) => refId(row?.order_id) === String(orderId)
        );
        const logList = Array.isArray(logResult?.data) ? logResult.data : [];

        setUpdates(updateList);
        setProcesses(processList);
        setLogs(logList);
        setStatus('succeeded');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load status history');
          setStatus('failed');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, orderId, reloadTick]);

  const title = orderNo || 'Order';
  const invoiceHref = orderId ? withBase(posInvoiceRoutePath(orderId)) : '';

  const latestStatus = useMemo(() => {
    const fromHistory = getOrderStatus(updates[0]);
    return fromHistory || String(currentStatus || '').trim();
  }, [updates, currentStatus]);

  const uniqueStatuses = useMemo(() => {
    const seen = new Set();
    updates.forEach((row) => {
      const value = normalizeStatus(getOrderStatus(row));
      if (value) seen.add(value);
    });
    if (latestStatus) seen.add(normalizeStatus(latestStatus));
    return seen.size;
  }, [updates, latestStatus]);

  const lastChangedAt = updates[0]?.createdAt || updates[0]?.created_at || '';

  const footerTone = useMemo(() => {
    if (!updates.length) return { kind: 'empty', label: 'No updates' };
    if (isFailedStatus(latestStatus)) {
      return { kind: 'failed', label: formatOrderStatusOptionLabel(latestStatus) };
    }
    if (isOkStatus(latestStatus)) {
      return { kind: 'ok', label: formatOrderStatusOptionLabel(latestStatus) };
    }
    return { kind: 'partial', label: formatOrderStatusOptionLabel(latestStatus) || 'Updated' };
  }, [updates, latestStatus]);

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      className="psh-app-dialog"
      title={
        <span className="psh-title">
          <span className="psh-title-icon">
            <NavIcon icon={FaClockRotateLeft} size={14} />
          </span>
          Order status history
        </span>
      }
      subtitle={
        <>
          Full status history for:{' '}
          {invoiceHref ? (
            <a
              href={invoiceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="psh-subtitle-name"
            >
              {title}
            </a>
          ) : (
            <span className="psh-subtitle-name">{title}</span>
          )}
          {latestStatus ? (
            <span className="osh-current">
              <StatusBadge status={latestStatus} />
            </span>
          ) : null}
        </>
      }
      footer={
        <div className="psh-footer">
          <div className="psh-footer-meta">
            {status === 'succeeded' ? (
              <>
                <span className="psh-footer-info">
                  <NavIcon icon={FaCircleInfo} size={12} />
                  Showing {updates.length} update{updates.length === 1 ? '' : 's'}
                </span>
                <span
                  className={`psh-badge ${statusClass(
                    footerTone.kind === 'ok'
                      ? 'synced'
                      : footerTone.kind === 'failed'
                        ? 'failed'
                        : footerTone.kind === 'partial'
                          ? 'partial'
                          : ''
                  )}`}
                >
                  {footerTone.kind === 'ok' ? <NavIcon icon={FaCheck} size={10} /> : null}
                  {footerTone.kind === 'failed' ? (
                    <NavIcon icon={FaTriangleExclamation} size={10} />
                  ) : null}
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
      ariaLabelledBy="orderStatusUpdatesModalLabel"
    >
      <div className="psh-modal">
        {status === 'loading' ? <HistorySkeleton /> : null}

        {status === 'failed' ? (
          <div className="psh-error-state">
            <span className="psh-error-icon">
              <NavIcon icon={FaTriangleExclamation} size={16} />
            </span>
            <h6>Unable to load status history</h6>
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
            <section className="psh-summary">
              <p className="psh-summary-kicker">OMS order</p>
              <h6 className="psh-summary-title">{title}</h6>
              <div className="psh-summary-stats">
                <div className="psh-stat">
                  <span className="psh-stat-icon">
                    <NavIcon icon={FaListOl} size={13} />
                  </span>
                  <div className="psh-stat-copy">
                    <span className="psh-stat-label">Updates</span>
                    <span className="psh-stat-value">{updates.length}</span>
                  </div>
                </div>
                <div className="psh-stat psh-stat--linked">
                  <span className="psh-stat-icon">
                    <NavIcon icon={FaCheck} size={13} />
                  </span>
                  <div className="psh-stat-copy">
                    <span className="psh-stat-label">Unique statuses</span>
                    <span className="psh-stat-value">{uniqueStatuses}</span>
                  </div>
                </div>
                <div className="psh-stat psh-stat--progress">
                  <span className="psh-stat-icon">
                    <NavIcon icon={FaArrowsRotate} size={13} />
                  </span>
                  <div className="psh-stat-copy">
                    <span className="psh-stat-label">Process jobs</span>
                    <span className="psh-stat-value">{processes.length}</span>
                  </div>
                </div>
                <div className="psh-stat">
                  <span className="psh-stat-icon">
                    <NavIcon icon={FaCalendarDay} size={13} />
                  </span>
                  <div className="psh-stat-copy">
                    <span className="psh-stat-label">Last change</span>
                    <span className="psh-stat-value">
                      {lastChangedAt ? formatRelative(lastChangedAt) || formatWhen(lastChangedAt) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="psh-section">
              <div className="psh-section-head">
                <h6 className="psh-section-title">
                  <span className="psh-section-title-icon">
                    <NavIcon icon={FaClockRotateLeft} size={13} />
                  </span>
                  Status timeline
                </h6>
                <span className="psh-section-count">{updates.length}</span>
              </div>
              {updates.length === 0 ? (
                <div className="psh-empty-state">
                  <span className="psh-empty-icon">
                    <NavIcon icon={FaClock} size={16} />
                  </span>
                  <h6>No status updates yet</h6>
                  <p>No status history was recorded for this order.</p>
                </div>
              ) : (
                <div className="osh-timeline">
                  {updates.map((row, index) => {
                    const key = idFromRecord(row) || String(index);
                    const toStatus = getOrderStatus(row);
                    const fromStatus = getOrderStatus(updates[index + 1]);
                    const when = row?.createdAt || row?.created_at || row?.updatedAt;
                    const isInitial = index === updates.length - 1;
                    return (
                      <article key={key} className="osh-step">
                        <div className="osh-rail" aria-hidden="true">
                          <span className="osh-dot" />
                        </div>
                        <div className="psh-card">
                          <header className="psh-card-head">
                            <div className="psh-card-copy">
                              <div className="psh-card-title-row">
                                {fromStatus && toStatus && fromStatus !== toStatus ? (
                                  <div className="osh-fromto">
                                    <StatusBadge status={fromStatus} />
                                    <NavIcon
                                      icon={FaArrowRight}
                                      size={11}
                                      className="osh-fromto-arrow"
                                    />
                                    <StatusBadge status={toStatus} />
                                  </div>
                                ) : (
                                  <StatusBadge status={toStatus} />
                                )}
                                {isInitial ? <span className="osh-initial">Initial</span> : null}
                              </div>
                              <p className="psh-card-sub">
                                {formatWhen(when)}
                                {formatRelative(when) ? ` · ${formatRelative(when)}` : ''}
                              </p>
                            </div>
                          </header>
                          <dl className="psh-meta-grid psh-meta-grid--3">
                            <MetaItem label="Changed by">
                              <span className="psh-footer-info">
                                <NavIcon icon={FaUser} size={11} />
                                {getChangedBy(row)}
                              </span>
                            </MetaItem>
                            <MetaItem label="When">{formatWhen(when)}</MetaItem>
                            <MetaItem label="Update ID">
                              <CopyableId value={idFromRecord(row)} />
                            </MetaItem>
                          </dl>
                        </div>
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
                  <p>No push, pull, or tracking jobs were found for this order.</p>
                </div>
              ) : (
                <div className="psh-stack">
                  {processes.map((item, index) => {
                    const id = idFromRecord(item);
                    const created = item.createdAt ?? item.created_at;
                    const details = buildProcessDetails(item);
                    const showRaw = openProcessId === id;
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
                        {item.remarks ? (
                          <p className="psh-desc">{String(item.remarks)}</p>
                        ) : null}
                        <dl className="psh-meta-grid">
                          {details
                            .filter((detail) => detail.kind !== 'remarks')
                            .map((detail) => (
                              <MetaItem key={detail.key} label={detail.label}>
                                {renderProcessDetailValue(detail)}
                              </MetaItem>
                            ))}
                        </dl>
                        <button
                          type="button"
                          className="psh-more"
                          onClick={() => setOpenProcessId(showRaw ? '' : id)}
                        >
                          {showRaw ? 'Hide raw process JSON' : 'Show raw process JSON'}
                        </button>
                        {showRaw ? <pre className="psh-pre">{prettyJson(item)}</pre> : null}
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
                  <p>No activity logs were found for this order.</p>
                </div>
              ) : (
                <div className="psh-stack">
                  {logs.map((item, index) => {
                    const id = idFromRecord(item);
                    const created = item.createdAt ?? item.created_at;
                    const expanded = openLogId === id;
                    const tags = Array.isArray(item.tags) ? item.tags : [];
                    const referenceId = refId(
                      item.reference_id ?? item.referenceId ?? item.refference_id
                    );
                    const hasRaw =
                      item.description ||
                      item.details ||
                      item.meta ||
                      item.data ||
                      item.human_readable_description ||
                      item.humanReadableDescription;
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
                        <OrderLogHumanReadable item={item} />
                        {tags.length ? (
                          <div className="psh-tags">
                            {tags.map((tag) => (
                              <span key={String(tag)} className="psh-tag">
                                {String(tag)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <dl className="psh-meta-grid psh-meta-grid--3">
                          <MetaItem label="Log ID">
                            <CopyableId value={id} />
                          </MetaItem>
                          <MetaItem label="URL">
                            <span className="psh-url" title={item.url || ''}>
                              {item.url || '—'}
                            </span>
                          </MetaItem>
                          <MetaItem label="Reference">
                            <CopyableId
                              value={referenceId}
                              href={
                                referenceId && invoiceHref ? invoiceHref : undefined
                              }
                              title={title}
                              openLabel="Open invoice"
                            />
                          </MetaItem>
                        </dl>
                        {hasRaw ? (
                          <button
                            type="button"
                            className="psh-more"
                            onClick={() => setOpenLogId(expanded ? '' : id)}
                          >
                            {expanded ? 'Hide raw JSON' : 'Show raw JSON'}
                          </button>
                        ) : null}
                        {expanded ? (
                          <pre className="psh-pre">
                            {prettyJson({
                              human_readable_description:
                                item.human_readable_description ??
                                item.humanReadableDescription,
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
