import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchSalesReturns,
  deleteSalesReturn,
  setSearch,
  setPage,
  setLimit,
  setSort,
  clearDeleteStatus,
} from '../../features/salesReturns/salesReturnsSlice.js';
import { DEBUG } from '../../config/env.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import AddNewButton from '../../components/AddNewButton.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';

const poRef = (row) =>
  row?.sales_return_no ??
  row?.salesReturnNo ??
  row?.sales_order_no ??
  row?.po_no ??
  row?.order_no ??
  row?.reference ??
  row?.invoice_no ??
  '—';

const poStatus = (row) =>
  row?.return_status ??
  row?.returnStatus ??
  row?.order_status ??
  row?.status ??
  row?.sales_order_status ??
  row?.po_status ??
  '—';

const customerDisplayName = (customer) => {
  if (customer == null || typeof customer !== 'object' || Array.isArray(customer)) return null;
  const n =
    customer.name ??
    customer.customer_name ??
    customer.business_name ??
    customer.company_name ??
    customer.full_name ??
    '';
  const s = String(n).trim();
  return s || null;
};

const poCustomer = (row) =>
  row?.customer_name ??
  customerDisplayName(row?.customer_id) ??
  row?.customer?.name ??
  row?.customer_name ??
  (row?.customer_id != null && typeof row.customer_id !== 'object' ? String(row.customer_id) : null) ??
  (row?.customer_id != null && typeof row.customer_id !== 'object'
    ? String(row.customer_id)
    : null) ??
  '—';

const poCreated = (row) => row?.createdAt ?? row?.created_at ?? null;

const poTraceId = (row) => row?._id ?? row?.id ?? '';

const poTotalAmount = (row) => {
  const v = row?.total_amount ?? row?.total ?? row?.grand_total;
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const poTransactionNumber = (row) => {
  const v =
    row?.transaction_number ??
    row?.transactionNumber ??
    row?.txn_no ??
    row?.transaction_no ??
    '';
  return v !== '' && v != null ? String(v) : '—';
};

const SalesReturns = () => {
  useRequireModuleAccess('sales-returns');
  const { canView, canDelete } = usePermissions('sales-returns');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
    deleteStatus,
  } = useSelector((state) => state.salesReturns);

  const loading = status === 'loading';
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
    dispatch(fetchSalesReturns(params));
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

  useEffect(() => {
    if (error) {
      console.error('[Sales return module] Failed to fetch sales return list', error);
    }
  }, [error]);

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
        dispatch(setSort({ sortBy }));
        sortClickTimeoutRef.current = null;
      }, 200);
    }
  };

  const renderSortIcon = (columnName) => {
    if (sort.sortBy !== columnName) {
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }} />;
    }
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }} />
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }} />
    );
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

  const handleDelete = async (salesReturnId, returnLabel) => {
    const label =
      returnLabel && returnLabel !== '—' ? returnLabel : 'this sales return';
    if (!window.confirm(`Delete "${label}"? This action cannot be undone.`)) {
      return;
    }
    const result = await dispatch(deleteSalesReturn(salesReturnId));
    if (deleteSalesReturn.fulfilled.match(result)) {
      toast.success('Sales return deleted successfully.');
    } else {
      toast.error(result.payload || 'Failed to delete sales return.');
    }
    dispatch(clearDeleteStatus());
  };

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);


  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
                    <h5 className="mb-0">Sales returns</h5>
                    <AddNewButton
                      to="/sales-returns/add"
                      label="Create sales return"
                      className="flex-shrink-0"
                    />
                  </div>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      Server-side pagination and search —{' '}
                      <code className="small">
                        GET /sales_return/get-all-active?populate=customer_id
                      </code>
                    </p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
                      <span className="input-group-text text-body">
                        <SearchInputIcon />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search sales returns"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="Loading sales returns…"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="sales-returns-table-page-size"
                showPagination={!loading && !error && pagination.total > 0}
              >
                <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('sales_return_no')}
                          onDoubleClick={() => handleSort('sales_return_no', true)}
                        >
                          Return no
                          {renderSortIcon('sales_return_no')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('transaction_number')}
                          onDoubleClick={() => handleSort('transaction_number', true)}
                        >
                          Transaction number
                          {renderSortIcon('transaction_number')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('return_status')}
                          onDoubleClick={() => handleSort('return_status', true)}
                        >
                          Return status
                          {renderSortIcon('return_status')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('customer_name')}
                          onDoubleClick={() => handleSort('customer_name', true)}
                        >
                          Customer
                          {renderSortIcon('customer_name')}
                        </th>
                        <th className="text-muted small">trace_no</th>
                        <th
                          className="text-end"
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('total_amount')}
                          onDoubleClick={() => handleSort('total_amount', true)}
                        >
                          Total amount
                          {renderSortIcon('total_amount')}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('createdAt')}
                          onDoubleClick={() => handleSort('createdAt', true)}
                        >
                          Created
                          {renderSortIcon('createdAt')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center text-sm p-4 text-muted">
                            <p className="mb-3">No sales returns found. Try adjusting search.</p>
                            <AddNewButton to="/sales-returns/add" label="Create sales return" />
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const id = poTraceId(item);
                          const created = poCreated(item);
                          return (
                            <tr key={id || index}>
                              <td className="text-sm">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">{poRef(item)}</td>
                              <td className="text-sm font-weight-normal text-break" style={{ maxWidth: '140px' }}>
                                {poTransactionNumber(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                <span className="badge bg-secondary text-wrap">{String(poStatus(item))}</span>
                              </td>
                              <td className="text-sm font-weight-normal">{poCustomer(item)}</td>
                              <td className="text-sm font-weight-normal text-muted text-break" style={{ maxWidth: '120px' }}>
                                {id || '—'}
                              </td>
                              <td className="text-sm font-weight-normal text-end text-nowrap">
                                {poTotalAmount(item)}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {created ? moment(created).format('MM-DD-YYYY h:mm a') : '—'}
                              </td>
                              <td className="text-sm">
                                {id ? (
                                  <div className="d-flex flex-wrap gap-1">
                                    {canView ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-info mb-0"
                                        onClick={() =>
                                          navigate(`/sales-returns/edit/${encodeURIComponent(id)}`)
                                        }
                                      >
                                        View
                                      </button>
                                    ) : null}
                                    {canDelete ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-danger mb-0"
                                        onClick={() => handleDelete(id, poRef(item))}
                                        disabled={deleteStatus === 'loading'}
                                      >
                                        Delete
                                      </button>
                                    ) : null}
                                    {!canView && !canDelete ? (
                                      <span className="text-muted">—</span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
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

export default SalesReturns;
