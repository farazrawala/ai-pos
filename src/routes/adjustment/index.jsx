import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchAdjustments,
  setSearch,
  setPage,
  setLimit,
  setSort,
} from '../../features/adjustments/adjustmentsSlice.js';
import {
  formatAdjustmentType,
  getAdjustmentProductName,
} from '../../features/adjustments/adjustmentsAPI.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import ListSortableTh from '../../components/list/ListSortableTh.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { DEBUG } from '../../config/env.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';

const typeBadgeClass = (type) => {
  if (type === 'add') return 'bg-gradient-success';
  if (type === 'remove' || type === 'subtract') return 'bg-gradient-warning';
  return 'bg-gradient-secondary';
};

const AdjustmentIndex = () => {
  useRequireModuleAccess('adjustments');
  const dispatch = useDispatch();
  const {
    list: data,
    listStatus,
    listError,
    pagination,
    search: searchTerm,
    sort,
  } = useSelector((state) => state.adjustments);
  const loading = listStatus === 'loading';
  const error = listError;
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
    };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchAdjustments(params));
  }, [dispatch, pagination.page, pagination.limit, searchTerm, sort.sortBy, sort.sortOrder]);

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

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  const handleSort = (column, isDoubleClick = false) => {
    if (isDoubleClick) {
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    dispatch(setSort({ sortBy: column }));
  };

  const sortableTh = (column, label, className = '') => (
    <ListSortableTh column={column} label={label} sort={sort} onSort={handleSort} className={className} />
  );

  const loadAdjustments = () => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    dispatch(fetchAdjustments(params));
  };


  const colCount = 7;

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-5 col-md-5">
                  <h5 className="mb-1">Stock adjustments</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      List from <code className="text-xs">GET /adjustment/get-all-active</code>
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-7 col-md-7">
                  <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
                    <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search adjustments…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search adjustments"
                      />
                    </div>
                    <AddNewButton to="/adjustments/add" label="Add adjustment" size="sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                className="list-data-table--adjustments"
                loading={loading}
                loadingLabel="Loading adjustments…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="adjustments-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th className="text-center list-col-sno">#</th>
                        <th className="list-col-truncate">Product</th>
                        {sortableTh('quantity', 'Quantity', 'text-end')}
                        {sortableTh('type', 'Type')}
                        <th className="list-col-truncate">Description</th>
                        {sortableTh('status', 'Status')}
                        {sortableTh('createdAt', 'Created', 'list-col-date')}
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center py-5 text-muted">
                            No adjustments found. Try adjusting your search.
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const rowKey = item._id || item.id || `row-${index}`;
                          const description =
                            item.description != null ? String(item.description) : '';
                          const productName = getAdjustmentProductName(item);
                          const isActive = String(item.status || '').toLowerCase() === 'active';
                          return (
                            <tr key={rowKey}>
                              <td className="text-center text-muted text-sm">{seriesNumber}</td>
                              <td
                                className="text-sm font-weight-bold text-dark list-cell-truncate"
                                title={productName}
                              >
                                {productName || '—'}
                              </td>
                              <td className="text-sm text-end font-weight-bold">
                                {item.quantity != null
                                  ? Number(item.quantity).toLocaleString()
                                  : '—'}
                              </td>
                              <td className="text-sm">
                                <span className={`badge text-xxs ${typeBadgeClass(item.type)}`}>
                                  {formatAdjustmentType(item.type)}
                                </span>
                              </td>
                              <td
                                className="text-sm text-muted list-cell-truncate"
                                title={description || undefined}
                              >
                                {description || '—'}
                              </td>
                              <td className="text-sm">
                                <span
                                  className={`badge text-xxs ${
                                    isActive ? 'bg-gradient-success' : 'bg-gradient-secondary'
                                  }`}
                                >
                                  {item.status || '—'}
                                </span>
                              </td>
                              <td
                                className="text-sm text-nowrap list-col-date"
                                title={
                                  item.createdAt
                                    ? moment(item.createdAt).format('DD MMM YYYY h:mm a')
                                    : undefined
                                }
                              >
                                {item.createdAt
                                  ? moment(item.createdAt).format('DD MMM YYYY h:mm a')
                                  : '—'}
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

export default AdjustmentIndex;
