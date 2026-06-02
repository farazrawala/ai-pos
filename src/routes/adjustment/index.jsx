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
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { DEBUG } from '../../config/env.js';

const AdjustmentIndex = () => {
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
  const sortClickTimeoutRef = useRef(null);

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
        dispatch(setSort({ sortBy, sortOrder: 'asc' }));
        sortClickTimeoutRef.current = null;
      }, 250);
    }
  };

  const renderSortIcon = (column) => {
    if (sort.sortBy !== column) return null;
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up ms-1" aria-hidden="true"></i>
    ) : (
      <i className="fas fa-sort-down ms-1" aria-hidden="true"></i>
    );
  };

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
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Stock adjustments</h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      List from <code className="text-xs">GET /adjustment/get-all-active</code>
                    </p>
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
                        placeholder="Search adjustments…"
                        value={localSearch}
                        onChange={handleSearchChange}
                      />
                    </div>
                    <AddNewButton to="/adjustments/add" label="Add adjustment" />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
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
                        <th>#</th>
                        <th>Product</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('quantity')}
                          onDoubleClick={() => handleSort('quantity', true)}
                        >
                          Quantity
                          {renderSortIcon('quantity')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('type')}
                          onDoubleClick={() => handleSort('type', true)}
                        >
                          Type
                          {renderSortIcon('type')}
                        </th>
                        <th>Description</th>
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
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="text-center text-sm p-4 text-muted">
                            No adjustments found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const rowKey = item._id || item.id || `row-${index}`;
                          const description =
                            item.description != null ? String(item.description) : '';
                          const typeBadge =
                            item.type === 'add'
                              ? 'bg-success'
                              : item.type === 'remove'
                                ? 'bg-warning text-dark'
                                : 'bg-secondary';
                          return (
                            <tr key={rowKey}>
                              <td className="text-sm text-muted">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {getAdjustmentProductName(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.quantity != null
                                  ? Number(item.quantity).toLocaleString()
                                  : '—'}
                              </td>
                              <td className="text-sm">
                                <span className={`badge ${typeBadge}`}>
                                  {formatAdjustmentType(item.type)}
                                </span>
                              </td>
                              <td
                                className="text-sm font-weight-normal"
                                style={{ maxWidth: '220px' }}
                                title={description}
                              >
                                {description ? (
                                  <span
                                    className="text-truncate d-inline-block"
                                    style={{ maxWidth: '210px' }}
                                  >
                                    {description}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm">
                                <span
                                  className={`badge ${item.status === 'active' ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {item.status || '—'}
                                </span>
                              </td>
                              <td className="text-sm text-muted text-nowrap">
                                {item.createdAt
                                  ? moment(item.createdAt).format('YYYY-MM-DD HH:mm')
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
