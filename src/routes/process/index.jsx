import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchProcesses,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/process/processSlice.js';
import { executeProcessRequest, stopProcessRequest } from '../../features/process/processAPI.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import ColumnVisibilityMenu from '../../components/list/ColumnVisibilityMenu.jsx';
import { useColumnVisibility } from '../../hooks/useColumnVisibility.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';

const processIdFromRecord = (item) => item?._id || item?.id || item?.process_id || '';

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
    sort,
  } = useSelector((state) => state.process);
  useRequireModuleAccess('process');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const [executingProcessId, setExecutingProcessId] = useState(null);
  const [stoppingProcessId, setStoppingProcessId] = useState(null);
  const [executeError, setExecuteError] = useState(null);

  const { isVisible, toggle, reset, visibleCount } = useColumnVisibility('processes', PROCESS_COLUMNS);

  const buildFetchParams = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
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
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

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
            <div className="card-header">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Processes</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0">Background sync jobs and integration tasks.</p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
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
            {executeError ? (
              <div className="px-4 pt-3">
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
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary mb-0"
                                  onClick={() => handleExecuteProcess(id)}
                                  disabled={!id || executingProcessId === id || stoppingProcessId === id}
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
                                  className="btn btn-sm btn-outline-danger mb-0"
                                  onClick={() => handleStopProcess(id)}
                                  disabled={
                                    !id || !isActive || stoppingProcessId === id || executingProcessId === id
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
