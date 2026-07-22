import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchProcesses,
  setSearch,
  setProgressFilter,
  setPage,
  setLimit,
  setSort,
} from '../../features/process/processSlice.js';
import {
  executeProcessRequest,
  stopProcessRequest,
  restartProcessRequest,
  deleteProcessRequest,
  fetchQueueWorkerStatusRequest,
} from '../../features/process/processAPI.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { toast } from '../../utils/toast.js';
import { DEBUG } from '../../config/env.js';

const WORKER_POLL_ACTIVE_MS = 4000;
const WORKER_POLL_IDLE_MS = 15000;

const processIdFromRecord = (item) => item?._id || item?.id || item?.process_id || '';

const boolBadge = (value, yesLabel = 'Yes', noLabel = 'No') =>
  value ? (
    <span className="badge bg-success">{yesLabel}</span>
  ) : (
    <span className="badge bg-secondary">{noLabel}</span>
  );

const formatCount = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value);
};

const formatMs = (ms) => {
  if (ms == null || !Number.isFinite(Number(ms))) return '—';
  const n = Number(ms);
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}s`;
};

const whySlowAlertClass = (whySlow) => {
  if (!whySlow) return 'alert-secondary';
  const top = whySlow.reasons?.[0]?.severity || (whySlow.is_slow ? 'warning' : 'info');
  if (top === 'error') return 'alert-danger';
  if (top === 'warning' || whySlow.is_slow) return 'alert-warning';
  return 'alert-info';
};

const reasonSeverityBadge = (severity) => {
  const value = String(severity || 'info').toLowerCase();
  if (value === 'error') return 'bg-danger';
  if (value === 'warning') return 'bg-warning text-dark';
  return 'bg-info';
};

const WorkerStat = ({ label, children, title }) => (
  <div className="col-6 col-md-4 col-lg-2">
    <div className="border border-radius-md p-2 h-100">
      <p className="text-xs text-muted mb-1">{label}</p>
      <div className="text-sm mb-0 text-break" title={title}>
        {children}
      </div>
    </div>
  </div>
);

const displayId = (value) => {
  if (value == null || value === '') return '—';
  return <code className="text-xs">{String(value)}</code>;
};

const displayValue = (value) => {
  if (value == null || value === '') return '—';
  return String(value);
};

const workerNeedsFastPoll = (data) =>
  Boolean(
    data?.draining ||
      Number(data?.remaining_processes ?? data?.remaining_in_db ?? 0) > 0 ||
      Number(data?.remaining_in_queue ?? 0) > 0
  );

/** Processes table columns. `sno`, `action`, `actions` are always visible. */
const PROCESS_COLUMNS = [
  { key: 'sno', label: 'S.No', alwaysVisible: true },
  { key: 'action', label: 'Action', alwaysVisible: true },
  { key: 'integration', label: 'Integration' },
  { key: 'product', label: 'Item Name' },
  { key: 'priority', label: 'Priority' },
  { key: 'count', label: 'Count' },
  { key: 'page', label: 'Page' },
  { key: 'hits', label: 'Hits' },
  { key: 'progress', label: 'Progress' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'duration', label: 'Duration' },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const formatAction = (action) => {
  if (!action) return '-';
  return String(action)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const shortId = (value) => {
  if (!value) return '-';
  const id = String(value);
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
};

const refId = (ref) => {
  if (!ref) return '';
  if (typeof ref === 'object') return String(ref._id ?? ref.id ?? '');
  return String(ref);
};

/** Display name of a populated reference (product/category/brand/integration). */
const refName = (ref) => {
  if (!ref || typeof ref !== 'object') return '';
  return ref.product_name || ref.name || ref.title || '';
};

/** Integration cell: populated name, else short id. */
const formatIntegration = (item) => refName(item?.integration_id) || shortId(refId(item?.integration_id));

/**
 * Item name: a process targets one of product / category / brand at a time.
 * Show whichever reference is populated with its name.
 */
const formatItemName = (item) => {
  const candidates = [
    { ref: item?.product_id, type: 'Product' },
    { ref: item?.category_id, type: 'Category' },
    { ref: item?.brand_id, type: 'Brand' },
  ];
  for (const { ref, type } of candidates) {
    const name = refName(ref);
    if (name) return { name, type };
    const id = refId(ref);
    if (id) return { name: shortId(id), type };
  }
  return { name: '-', type: '' };
};

const formatProgress = (progress) => {
  if (!progress) return '-';
  return String(progress)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const progressBadgeClass = (progress) => {
  const value = String(progress || '').toLowerCase();
  if (value === 'completed' || value === 'done' || value === 'success') return 'bg-success';
  if (value === 'failed' || value === 'error') return 'bg-danger';
  if (value === 'in_progress' || value === 'running' || value === 'processing') return 'bg-primary';
  if (value === 'not_started' || value === 'pending') return 'bg-warning text-dark';
  return 'bg-secondary';
};

const processTimestamp = (item, field) => {
  if (!item) return null;
  if (field === 'createdAt') {
    return item.createdAt ?? item.created_at ?? null;
  }
  return item.updatedAt ?? item.updated_at ?? null;
};

const formatProcessTimestamp = (value) => {
  if (!value) return '-';
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format('MM-DD-YYYY h:mm a') : '-';
};

const formatProcessDuration = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return '-';
  const start = moment(createdAt);
  const end = moment(updatedAt);
  if (!start.isValid() || !end.isValid()) return '-';

  const diffMs = end.diff(start);
  if (diffMs < 0) return '-';
  if (diffMs === 0) return '0 sec';

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

const ProcessIndex = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    progressFilter,
    sort,
  } = useSelector((state) => state.process);
  useRequireModuleAccess('process');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const [executingProcessId, setExecutingProcessId] = useState(null);
  const [stoppingProcessId, setStoppingProcessId] = useState(null);
  const [restartingProcessId, setRestartingProcessId] = useState(null);
  const [deletingProcessId, setDeletingProcessId] = useState(null);
  const [executeError, setExecuteError] = useState(null);
  const [workerStatus, setWorkerStatus] = useState(null);
  const [workerStatusError, setWorkerStatusError] = useState(null);
  const [workerStatusLoading, setWorkerStatusLoading] = useState(true);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility('processes', PROCESS_COLUMNS);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    const schedule = (draining) => {
      if (cancelled) return;
      if (timerId) clearTimeout(timerId);
      const delay = draining ? WORKER_POLL_ACTIVE_MS : WORKER_POLL_IDLE_MS;
      timerId = setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await fetchQueueWorkerStatusRequest();
        if (cancelled) return;
        setWorkerStatus(data && typeof data === 'object' ? data : null);
        setWorkerStatusError(null);
        setWorkerStatusLoading(false);
        schedule(workerNeedsFastPoll(data));
      } catch (err) {
        if (cancelled) return;
        setWorkerStatusError(err?.message || 'Failed to load queue worker status');
        setWorkerStatusLoading(false);
        schedule(false);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const buildFetchParams = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (progressFilter) params.progress = progressFilter;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    return params;
  };

  const refreshProcesses = () => {
    dispatch(fetchProcesses(buildFetchParams()));
  };

  useEffect(() => {
    refreshProcesses();
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    progressFilter,
    sort.sortBy,
    sort.sortOrder,
  ]);

  const handleExecuteProcess = async (processId) => {
    if (!processId) return;

    setExecutingProcessId(processId);
    setExecuteError(null);

    try {
      await executeProcessRequest(processId);
      refreshProcesses();
    } catch (err) {
      setExecuteError(err?.message || 'Failed to execute process');
      console.error('[Process module] Failed to execute process', { processId, error: err });
    } finally {
      setExecutingProcessId(null);
    }
  };

  const handleRestartProcess = async (processId) => {
    if (!processId) return;

    setRestartingProcessId(processId);
    setExecuteError(null);

    try {
      const result = await restartProcessRequest(processId);
      toast.success(result?.message || 'Process restarted successfully.');
      refreshProcesses();
    } catch (err) {
      setExecuteError(err?.message || 'Failed to restart process');
      console.error('[Process module] Failed to restart process', { processId, error: err });
    } finally {
      setRestartingProcessId(null);
    }
  };

  const handleStopProcess = async (processId) => {
    if (!processId) return;

    setStoppingProcessId(processId);
    setExecuteError(null);

    try {
      await stopProcessRequest(processId);
      refreshProcesses();
    } catch (err) {
      setExecuteError(err?.message || 'Failed to stop process');
      console.error('[Process module] Failed to stop process', { processId, error: err });
    } finally {
      setStoppingProcessId(null);
    }
  };

  const handleDeleteProcess = async (processId, actionLabel = '') => {
    if (!processId) return;

    const label = actionLabel || shortId(processId);
    if (!window.confirm(`Delete process "${label}"? This cannot be undone.`)) {
      return;
    }

    setDeletingProcessId(processId);
    setExecuteError(null);

    try {
      const result = await deleteProcessRequest(processId);
      toast.success(result?.message || 'Process deleted successfully.');
      refreshProcesses();
    } catch (err) {
      const message = err?.message || 'Failed to delete process';
      setExecuteError(message);
      toast.error(message);
      console.error('[Process module] Failed to delete process', { processId, error: err });
    } finally {
      setDeletingProcessId(null);
    }
  };

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

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    if (error) {
      console.error('[Process module] Failed to fetch process list', error);
    }
  }, [error]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Processes</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Background sync jobs and integration tasks.</p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
                    <select
                      className="form-select"
                      style={{ maxWidth: '180px' }}
                      value={progressFilter}
                      onChange={(event) => dispatch(setProgressFilter(event.target.value))}
                      aria-label="Filter by progress"
                    >
                      <option value="">All progress</option>
                      <option value="not_started">Not started</option>
                      <option value="completed">Success</option>
                      <option value="failed">Failed</option>
                    </select>
                    <div className="input-group" style={{ maxWidth: '300px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search processes..."
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <ColumnVisibilityMenu
                      columns={PROCESS_COLUMNS}
                      isVisible={isVisible}
                      onToggle={toggle}
                      onReset={reset}
                      id="processColumnVisibilityMenu"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-3 pb-2">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                <h6 className="mb-0 text-sm text-uppercase text-muted">Queue worker</h6>
                {workerStatusLoading ? (
                  <span className="text-xs text-muted">Loading…</span>
                ) : workerStatus?.draining ? (
                  <span className="badge bg-primary">Draining</span>
                ) : Number(workerStatus?.remaining_processes ?? workerStatus?.remaining_in_db ?? 0) >
                  0 ? (
                  <span className="badge bg-warning text-dark">Backlog</span>
                ) : (
                  <span className="badge bg-secondary">Idle</span>
                )}
              </div>
              {workerStatusError ? (
                <div className="alert alert-warning text-sm py-2 mb-2" role="alert">
                  {workerStatusError}
                </div>
              ) : null}

              <p className="text-xs text-uppercase text-muted mb-1">Overview</p>
              <div className="row g-2 mb-3">
                <WorkerStat label="Enabled">
                  {boolBadge(workerStatus?.enabled, 'Yes', 'No')}
                </WorkerStat>
                <WorkerStat label="Draining">
                  {boolBadge(workerStatus?.draining, 'Yes', 'No')}
                </WorkerStat>
                <WorkerStat label="Queue enabled">
                  {boolBadge(workerStatus?.queue_enabled, 'Yes', 'No')}
                </WorkerStat>
                <WorkerStat label="Remaining processes">
                  <span className="h6 mb-0 d-block">
                    {formatCount(
                      workerStatus?.remaining_processes ?? workerStatus?.remaining_in_db
                    )}
                  </span>
                </WorkerStat>
                <WorkerStat label="Remaining in DB">
                  {formatCount(workerStatus?.remaining_in_db ?? workerStatus?.remaining_processes)}
                </WorkerStat>
                <WorkerStat label="Remaining in queue">
                  {formatCount(workerStatus?.remaining_in_queue)}
                </WorkerStat>
              </div>

              <p className="text-xs text-uppercase text-muted mb-1">Current job</p>
              <div className="row g-2 mb-3">
                <WorkerStat label="Action" title={workerStatus?.current_action || ''}>
                  {workerStatus?.current_action
                    ? formatAction(workerStatus.current_action)
                    : '—'}
                </WorkerStat>
                <WorkerStat label="Progress">
                  {workerStatus?.current_progress ? (
                    <span className={`badge ${progressBadgeClass(workerStatus.current_progress)}`}>
                      {formatProgress(workerStatus.current_progress)}
                    </span>
                  ) : (
                    '—'
                  )}
                </WorkerStat>
                <WorkerStat label="Status">
                  {workerStatus?.current_status
                    ? formatProgress(workerStatus.current_status)
                    : '—'}
                </WorkerStat>
                <WorkerStat label="Batch index">
                  {displayValue(workerStatus?.batch_index)}
                </WorkerStat>
                <WorkerStat label="Page">{displayValue(workerStatus?.current_page)}</WorkerStat>
                <WorkerStat label="Hits">{displayValue(workerStatus?.current_hits)}</WorkerStat>
                <WorkerStat label="Running for">
                  {workerStatus?.running_for?.human || '—'}
                  {workerStatus?.running_for?.seconds != null ? (
                    <span className="text-xs text-muted d-block">
                      {formatCount(workerStatus.running_for.seconds)}s ·{' '}
                      {formatMs(workerStatus.running_for.ms)}
                    </span>
                  ) : null}
                </WorkerStat>
                <WorkerStat label="Started at">
                  {formatProcessTimestamp(workerStatus?.started_at)}
                </WorkerStat>
              </div>

              <p className="text-xs text-uppercase text-muted mb-1">Current ids</p>
              <div className="row g-2 mb-3">
                <WorkerStat label="Process id">{displayId(workerStatus?.current_process_id)}</WorkerStat>
                <WorkerStat label="Company id">{displayId(workerStatus?.current_company_id)}</WorkerStat>
                <WorkerStat label="Product id">{displayId(workerStatus?.current_product_id)}</WorkerStat>
                <WorkerStat label="Category id">{displayId(workerStatus?.current_category_id)}</WorkerStat>
                <WorkerStat label="Brand id">{displayId(workerStatus?.current_brand_id)}</WorkerStat>
                <WorkerStat label="Integration id">
                  {displayId(workerStatus?.current_integration_id)}
                </WorkerStat>
              </div>

              {workerStatus?.current_remarks ? (
                <div className="border border-radius-md p-2 mb-3">
                  <p className="text-xs text-muted mb-1">Current remarks</p>
                  <p className="text-sm mb-0">{workerStatus.current_remarks}</p>
                </div>
              ) : null}

              {Array.isArray(workerStatus?.remaining_by_company) &&
              workerStatus.remaining_by_company.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs text-uppercase text-muted mb-1">Remaining by company</p>
                  <div className="table-responsive border border-radius-md">
                    <table className="table table-sm mb-0 align-items-center">
                      <thead>
                        <tr>
                          <th className="text-xs text-muted">Company id</th>
                          <th className="text-xs text-muted text-end">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerStatus.remaining_by_company.map((row) => (
                          <tr key={String(row.company_id)}>
                            <td>
                              <code className="text-xs">{displayValue(row.company_id)}</code>
                            </td>
                            <td className="text-end">{formatCount(row.remaining)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {workerStatus?.why_slow?.timing ? (
                <div className="mb-3">
                  <p className="text-xs text-uppercase text-muted mb-1">Timing</p>
                  <div className="row g-2 mb-2">
                    <WorkerStat label="Current batch (human)">
                      {workerStatus.why_slow.timing.current_batch_running_for?.human || '—'}
                    </WorkerStat>
                    <WorkerStat label="Current batch seconds">
                      {formatCount(workerStatus.why_slow.timing.current_batch_running_for?.seconds)}
                    </WorkerStat>
                    <WorkerStat label="Current batch ms">
                      {formatCount(workerStatus.why_slow.timing.current_batch_ms)}
                      <span className="text-xs text-muted d-block">
                        {formatMs(workerStatus.why_slow.timing.current_batch_ms)}
                      </span>
                    </WorkerStat>
                    <WorkerStat label="Current running_for ms">
                      {formatCount(workerStatus.why_slow.timing.current_batch_running_for?.ms)}
                    </WorkerStat>
                    <WorkerStat label="Last batch ms">
                      {formatCount(workerStatus.why_slow.timing.last_batch_ms)}
                      <span className="text-xs text-muted d-block">
                        {formatMs(workerStatus.why_slow.timing.last_batch_ms)}
                      </span>
                    </WorkerStat>
                    <WorkerStat label="Avg batch ms">
                      {formatCount(workerStatus.why_slow.timing.avg_batch_ms)}
                      <span className="text-xs text-muted d-block">
                        {formatMs(workerStatus.why_slow.timing.avg_batch_ms)}
                      </span>
                    </WorkerStat>
                    <WorkerStat label="Batches timed">
                      {formatCount(workerStatus.why_slow.timing.batches_timed)}
                    </WorkerStat>
                    <WorkerStat label="Same process batches">
                      {formatCount(workerStatus.why_slow.timing.same_process_batches)}
                    </WorkerStat>
                    <WorkerStat label="Page unchanged batches">
                      {formatCount(workerStatus.why_slow.timing.page_unchanged_batches)}
                    </WorkerStat>
                    <WorkerStat label="Batch delay ms">
                      {formatCount(workerStatus.why_slow.timing.batch_delay_ms)}
                      <span className="text-xs text-muted d-block">
                        {formatMs(workerStatus.why_slow.timing.batch_delay_ms)}
                      </span>
                    </WorkerStat>
                    <WorkerStat label="Slow threshold ms">
                      {formatCount(workerStatus.why_slow.timing.slow_batch_threshold_ms)}
                      <span className="text-xs text-muted d-block">
                        {formatMs(workerStatus.why_slow.timing.slow_batch_threshold_ms)}
                      </span>
                    </WorkerStat>
                    <WorkerStat label="Stuck threshold ms">
                      {formatCount(workerStatus.why_slow.timing.stuck_batch_threshold_ms)}
                      <span className="text-xs text-muted d-block">
                        {formatMs(workerStatus.why_slow.timing.stuck_batch_threshold_ms)}
                      </span>
                    </WorkerStat>
                    <WorkerStat label="Last batch success">
                      {workerStatus.why_slow.timing.last_batch_success == null
                        ? '—'
                        : boolBadge(
                            workerStatus.why_slow.timing.last_batch_success,
                            'Yes',
                            'No'
                          )}
                    </WorkerStat>
                  </div>
                  {workerStatus.why_slow.timing.last_batch_message ? (
                    <div className="border border-radius-md p-2">
                      <p className="text-xs text-muted mb-1">Last batch message</p>
                      <p className="text-sm mb-0">{workerStatus.why_slow.timing.last_batch_message}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {workerStatus?.why_slow ? (
                <div
                  className={`alert ${whySlowAlertClass(workerStatus.why_slow)} text-sm py-2 mb-0`}
                  role="status"
                >
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                    <strong>{workerStatus.why_slow.is_slow ? 'Why slow' : 'Worker health'}</strong>
                    {workerStatus.why_slow.is_slow ? (
                      <span className="badge bg-warning text-dark">is_slow</span>
                    ) : (
                      <span className="badge bg-success">ok</span>
                    )}
                    {workerStatus.why_slow.eta?.human ? (
                      <span className="badge bg-dark">ETA {workerStatus.why_slow.eta.human}</span>
                    ) : null}
                  </div>

                  {workerStatus.why_slow.primary_reason ? (
                    <p className="mb-2">{workerStatus.why_slow.primary_reason}</p>
                  ) : null}

                  {Array.isArray(workerStatus.why_slow.reasons) &&
                  workerStatus.why_slow.reasons.length > 0 ? (
                    <div className="mb-2">
                      <p className="text-xs text-uppercase mb-1 opacity-75">All reasons</p>
                      <ul className="mb-0 ps-3">
                        {workerStatus.why_slow.reasons.map((reason) => (
                          <li key={reason.code || reason.message} className="mb-1">
                            <span
                              className={`badge ${reasonSeverityBadge(reason.severity)} me-1`}
                            >
                              {reason.severity || 'info'}
                            </span>
                            {reason.code ? (
                              <code className="text-xs me-1">{reason.code}</code>
                            ) : null}
                            {reason.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {workerStatus.why_slow.eta ? (
                    <div className="border border-radius-md p-2 bg-white bg-opacity-25">
                      <p className="text-xs text-uppercase mb-1 opacity-75">ETA</p>
                      <div className="row g-2">
                        <div className="col-6 col-md-3">
                          <span className="text-xs text-muted d-block">Human</span>
                          {workerStatus.why_slow.eta.human || '—'}
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-xs text-muted d-block">Seconds</span>
                          {formatCount(workerStatus.why_slow.eta.seconds)}
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-xs text-muted d-block">Ms</span>
                          {formatCount(workerStatus.why_slow.eta.ms)}
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-xs text-muted d-block">Remaining</span>
                          {formatCount(workerStatus.why_slow.eta.remaining)}
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-xs text-muted d-block">Avg batch</span>
                          {formatMs(workerStatus.why_slow.eta.avg_batch_ms)}
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-xs text-muted d-block">Batch delay</span>
                          {formatMs(workerStatus.why_slow.eta.batch_delay_ms)}
                        </div>
                        <div className="col-12 col-md-6">
                          <span className="text-xs text-muted d-block">Based on</span>
                          {displayValue(workerStatus.why_slow.eta.based_on)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {executeError ? (
              <div className="px-4 pb-2">
                <div className="alert alert-danger py-2 mb-0">{executeError}</div>
              </div>
            ) : null}
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading processes…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="process-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      {sortableTh('action', 'Action')}
                      {isVisible('integration') ? <th>Integration</th> : null}
                      {isVisible('product') ? <th>Product</th> : null}
                      {isVisible('priority') ? <th>Priority</th> : null}
                      {isVisible('count') ? <th>Count</th> : null}
                      {isVisible('page') ? <th>Page</th> : null}
                      {isVisible('hits') ? <th>Hits</th> : null}
                      {isVisible('progress') ? sortableTh('progress', 'Progress') : null}
                      {isVisible('remarks') ? <th>Remarks</th> : null}
                      {isVisible('status') ? sortableTh('status', 'Status') : null}
                      {isVisible('createdAt') ? sortableTh('createdAt', 'Created At') : null}
                      {isVisible('updatedAt') ? sortableTh('updatedAt', 'Updated At') : null}
                      {isVisible('duration') ? <th>Duration</th> : null}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCount} className="text-center text-sm font-weight-normal p-4">
                          No processes found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const id = processIdFromRecord(item);
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        const createdAt = processTimestamp(item, 'createdAt');
                        const updatedAt = processTimestamp(item, 'updatedAt');
                        const duration = formatProcessDuration(createdAt, updatedAt);
                        const isActive = String(item.status || '').toLowerCase() === 'active';
                        return (
                          <tr key={id || index}>
                            <td>{seriesNumber}</td>
                            <td>
                              <span className="badge bg-info text-dark">
                                {formatAction(item.action)}
                              </span>
                            </td>
                            {isVisible('integration') ? (
                              <td title={refId(item.integration_id)}>
                                {formatIntegration(item)}
                              </td>
                            ) : null}
                            {isVisible('product')
                              ? (() => {
                                  const { name, type } = formatItemName(item);
                                  return (
                                    <td>
                                      {name}
                                      {type ? (
                                        <span className="badge bg-light text-dark ms-1">
                                          {type}
                                        </span>
                                      ) : null}
                                    </td>
                                  );
                                })()
                              : null}
                            {isVisible('priority') ? <td>{item.priority ?? '-'}</td> : null}
                            {isVisible('count') ? <td>{item.count ?? '-'}</td> : null}
                            {isVisible('page') ? <td>{item.page ?? '-'}</td> : null}
                            {isVisible('hits') ? <td>{item.hits ?? 0}</td> : null}
                            {isVisible('progress') ? (
                              <td>
                                <span className={`badge ${progressBadgeClass(item.progress)}`}>
                                  {formatProgress(item.progress)}
                                </span>
                              </td>
                            ) : null}
                            {isVisible('remarks') ? <td>{item.remarks || '-'}</td> : null}
                            {isVisible('status') ? (
                              <td>
                                <span
                                  className={`badge ${
                                    String(item.status || '').toLowerCase() === 'active'
                                      ? 'bg-success'
                                      : 'bg-secondary'
                                  }`}
                                >
                                  {item.status || 'inactive'}
                                </span>
                              </td>
                            ) : null}
                            {isVisible('createdAt') ? (
                              <td>{formatProcessTimestamp(createdAt)}</td>
                            ) : null}
                            {isVisible('updatedAt') ? (
                              <td>{formatProcessTimestamp(updatedAt)}</td>
                            ) : null}
                            {isVisible('duration') ? (
                              <td title={duration !== '-' ? 'Updated − created' : undefined}>
                                {duration}
                              </td>
                            ) : null}
                            <td>
                              <div className="d-flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary mb-0"
                                  onClick={() => handleExecuteProcess(id)}
                                  disabled={
                                    !id ||
                                    executingProcessId === id ||
                                    stoppingProcessId === id ||
                                    restartingProcessId === id ||
                                    deletingProcessId === id
                                  }
                                >
                                  {executingProcessId === id ? (
                                    <>
                                      <span
                                        className="spinner-border spinner-border-sm me-1"
                                        role="status"
                                        aria-hidden="true"
                                      />
                                      Executing…
                                    </>
                                  ) : (
                                    'Execute'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary mb-0"
                                  onClick={() => handleRestartProcess(id)}
                                  disabled={
                                    !id ||
                                    restartingProcessId === id ||
                                    executingProcessId === id ||
                                    stoppingProcessId === id ||
                                    deletingProcessId === id
                                  }
                                  title="Restart failed or completed process"
                                >
                                  {restartingProcessId === id ? (
                                    <>
                                      <span
                                        className="spinner-border spinner-border-sm me-1"
                                        role="status"
                                        aria-hidden="true"
                                      />
                                      Restarting…
                                    </>
                                  ) : (
                                    'Restart'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger mb-0"
                                  onClick={() => handleStopProcess(id)}
                                  disabled={
                                    !id ||
                                    !isActive ||
                                    stoppingProcessId === id ||
                                    executingProcessId === id ||
                                    restartingProcessId === id ||
                                    deletingProcessId === id
                                  }
                                  title={isActive ? 'Set status to inactive' : 'Already inactive'}
                                >
                                  {stoppingProcessId === id ? (
                                    <>
                                      <span
                                        className="spinner-border spinner-border-sm me-1"
                                        role="status"
                                        aria-hidden="true"
                                      />
                                      Stopping…
                                    </>
                                  ) : (
                                    'Stop'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger mb-0"
                                  onClick={() =>
                                    handleDeleteProcess(id, formatAction(item.action))
                                  }
                                  disabled={
                                    !id ||
                                    deletingProcessId === id ||
                                    executingProcessId === id ||
                                    stoppingProcessId === id ||
                                    restartingProcessId === id
                                  }
                                  title="Delete process"
                                >
                                  {deletingProcessId === id ? (
                                    <>
                                      <span
                                        className="spinner-border spinner-border-sm me-1"
                                        role="status"
                                        aria-hidden="true"
                                      />
                                      Deleting…
                                    </>
                                  ) : (
                                    'Delete'
                                  )}
                                </button>
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
    </div>
  );
};

export default ProcessIndex;
