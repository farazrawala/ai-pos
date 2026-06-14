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
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';

const processIdFromRecord = (item) => item?._id || item?.id || item?.process_id || '';

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

const ProcessIndex = () => {
  const dispatch = useDispatch();
  const { list: data, status, error, pagination, search: searchTerm, sort } = useSelector(
    (state) => state.process
  );
  useRequireModuleAccess('process');
  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchProcesses(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

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

  const handleSort = (sortBy, isDoubleClick = false) => {
    if (isDoubleClick) {
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    sortClickTimeoutRef.current = setTimeout(() => dispatch(setSort({ sortBy })), 200);
  };

  const renderSortIcon = (columnName) =>
    sort.sortBy !== columnName ? (
      <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
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
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
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
                  </div>
                </div>
              </div>
            </div>
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
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('action')}
                        onDoubleClick={() => handleSort('action', true)}
                      >
                        Action
                        {renderSortIcon('action')}
                      </th>
                      <th>Integration</th>
                      <th>Product</th>
                      <th>Priority</th>
                      <th>Count</th>
                      <th>Page</th>
                      <th>Remarks</th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('status')}
                        onDoubleClick={() => handleSort('status', true)}
                      >
                        Status
                        {renderSortIcon('status')}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('createdAt')}
                        onDoubleClick={() => handleSort('createdAt', true)}
                      >
                        Created At
                        {renderSortIcon('createdAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center text-sm font-weight-normal p-4">
                          No processes found
                        </td>
                      </tr>
                    ) : (
                      data.map((item, index) => {
                        const id = processIdFromRecord(item);
                        const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                        return (
                          <tr key={id || index}>
                            <td>{seriesNumber}</td>
                            <td>
                              <span className="badge bg-info text-dark">
                                {formatAction(item.action)}
                              </span>
                            </td>
                            <td title={item.integration_id || ''}>
                              {shortId(item.integration_id)}
                            </td>
                            <td title={item.product_id || ''}>{shortId(item.product_id)}</td>
                            <td>{item.priority ?? '-'}</td>
                            <td>{item.count ?? '-'}</td>
                            <td>{item.page ?? '-'}</td>
                            <td>{item.remarks || '-'}</td>
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
                            <td>
                              {item.createdAt
                                ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                : '-'}
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
