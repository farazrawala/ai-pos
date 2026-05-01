import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchTransactions,
  setSearch,
  setPage,
  setLimit,
  setSort,
  setDateFilters,
  clearDateFilters,
} from '../../features/transactions/transactionsSlice.js';
import {
  getAccountName,
  formatTransactionAmount,
  groupTransactionsIntoJournals,
  sumDebitCreditForLines,
} from '../../features/transactions/transactionsAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const Transactions = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
    filters,
  } = useSelector((state) => state.transactions);
  const { canView } = usePermissions('orders');

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');
  /** 'journal' = double-entry grouped view; 'lines' = flat ledger list */
  const [viewMode, setViewMode] = useState('journal');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);

  const journals = useMemo(() => groupTransactionsIntoJournals(data), [data]);

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

  useEffect(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    dispatch(fetchTransactions(params));
  }, [
    dispatch,
    pagination.page,
    pagination.limit,
    searchTerm,
    sort.sortBy,
    sort.sortOrder,
    filters.startDate,
    filters.endDate,
  ]);

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  useEffect(() => {
    setLocalStartDate(filters.startDate || '');
    setLocalEndDate(filters.endDate || '');
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    if (error) {
      console.error('[Transactions module] Failed to fetch transaction list', error);
    }
  }, [error]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    };
  }, []);

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
      if (sortClickTimeoutRef.current) {
        clearTimeout(sortClickTimeoutRef.current);
        sortClickTimeoutRef.current = null;
      }
      dispatch(setSort({ sortBy: null, sortOrder: null }));
      return;
    }
    if (sortClickTimeoutRef.current) clearTimeout(sortClickTimeoutRef.current);
    sortClickTimeoutRef.current = setTimeout(() => {
      dispatch(setSort({ sortBy }));
      sortClickTimeoutRef.current = null;
    }, 200);
  };

  const renderSortIcon = (columnName) => {
    if (sort.sortBy !== columnName) {
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.75rem' }}></i>;
    }
    return sort.sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    ) : (
      <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.75rem' }}></i>
    );
  };

  const applyDateFilters = () => {
    if (localStartDate && localEndDate && localStartDate > localEndDate) {
      window.alert('Start date cannot be later than end date.');
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

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  const debitCreditCells = (row) => {
    const t = String(row.type || '').toLowerCase().trim();
    const amount = formatTransactionAmount(row.amount);
    const isDebit = t === 'debit';
    const isCredit = t === 'credit';
    return {
      debit: isDebit ? amount : '—',
      credit: isCredit ? amount : '—',
    };
  };

  const journalMeta = (lines) => {
    if (!lines?.length) return { ref: '—', description: '—', createdAt: null, status: null };
    const ref =
      lines[0].transaction_number ??
      lines[0].transactionNumber ??
      lines[0]._id ??
      lines[0].id ??
      '—';
    const desc =
      lines.map((r) => (r.description && String(r.description).trim()) || '').find(Boolean) || '—';
    let earliest = null;
    for (const r of lines) {
      if (!r.createdAt) continue;
      const m = moment(r.createdAt);
      if (!m.isValid()) continue;
      if (!earliest || m.isBefore(earliest)) earliest = m;
    }
    const status = lines.find((r) => r.status)?.status ?? null;
    return { ref, description: desc, createdAt: earliest, status };
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card w-100" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <h5 className="mb-0">Transactions</h5>
                  <p className="text-sm mb-0 text-muted">
                    Double-entry journals (grouped lines). API:{' '}
                    <code className="small">GET /transaction/get-all-active?populate=account_id</code>
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 flex-wrap">
                    <div
                      className="btn-group btn-group-sm"
                      role="group"
                      aria-label="Transaction view mode"
                    >
                      <button
                        type="button"
                        className={`btn mb-0 ${viewMode === 'journal' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('journal')}
                      >
                        Journal view
                      </button>
                      <button
                        type="button"
                        className={`btn mb-0 ${viewMode === 'lines' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('lines')}
                      >
                        All lines
                      </button>
                    </div>
                    <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
                      <span className="input-group-text text-body">
                        <i className="fas fa-search" aria-hidden="true"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        aria-label="Search transactions"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-0">
              <div className="row g-2 align-items-end mb-3">
                <div className="col-md-3">
                  <label className="form-label mb-1">Start date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={localStartDate}
                    onChange={(e) => setLocalStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label mb-1">End date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={localEndDate}
                    onChange={(e) => setLocalEndDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm mb-0" onClick={applyDateFilters}>
                    Apply date filters
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm mb-0" onClick={resetDateFilters}>
                    Clear
                  </button>
                </div>
              </div>

              {!loading && !error && pagination.total > 0 && (
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center flex-wrap">
                    <span className="text-sm text-muted me-2">Show:</span>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 'auto' }}
                      value={pagination.limit}
                      onChange={(e) => dispatch(setLimit(Number(e.target.value)))}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <span className="text-sm text-muted ms-2">
                      Showing {startItem} to {endItem} of {pagination.total} entries
                    </span>
                  </div>
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary mb-0"
                      disabled={pagination.page === 1}
                      onClick={() => dispatch(setPage(pagination.page - 1))}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary mb-0"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => dispatch(setPage(pagination.page + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {loading && (
                <div className="text-center p-4">
                  <p className="mb-0">Loading transactions…</p>
                </div>
              )}
              {error && (
                <div className="alert alert-danger m-3" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && viewMode === 'journal' && (
                <div className="w-100 d-flex flex-column gap-3">
                  {journals.length === 0 ? (
                    <p className="text-center text-sm text-muted p-4 mb-0">No transactions found</p>
                  ) : (
                    journals.map((lines, jIndex) => {
                      const meta = journalMeta(lines);
                      const sums = sumDebitCreditForLines(lines);
                      const jKey =
                        lines[0]?._id ||
                        lines[0]?.id ||
                        `${pagination.page}-${jIndex}`;
                      return (
                        <div key={jKey} className="card shadow-none border mb-0 w-100">
                          <div className="card-header py-2 d-flex flex-wrap justify-content-between align-items-start gap-2 bg-gray-100">
                            <div>
                              <span className="text-xs text-uppercase text-muted d-block">
                                Journal entry
                              </span>
                              <strong className="text-sm">Ref. {meta.ref}</strong>
                              <span className="text-sm text-muted ms-2">
                                {meta.createdAt
                                  ? meta.createdAt.format('MM-DD-YYYY h:mm a')
                                  : '—'}
                              </span>
                            </div>
                            <div className="text-end">
                              {meta.status ? (
                                <span
                                  className={`badge ${
                                    String(meta.status).toLowerCase() === 'active'
                                      ? 'bg-success'
                                      : 'bg-secondary'
                                  }`}
                                >
                                  {meta.status}
                                </span>
                              ) : null}
                              <span
                                className={`badge ms-1 ${
                                  sums.balanced ? 'bg-gradient-success' : 'bg-gradient-warning'
                                }`}
                                title="Debits should equal credits for a complete posting"
                              >
                                {sums.balanced ? 'Balanced' : 'Check totals'}
                              </span>
                            </div>
                          </div>
                          <div className="card-body py-2 px-3 w-100">
                            <p className="text-sm text-muted mb-2">{meta.description}</p>
                            <table className="table table-sm table-flush mb-0 w-100">
                              <thead>
                                <tr>
                                  <th className="text-xs text-uppercase">Account</th>
                                  <th className="text-xs text-uppercase text-end">Debit</th>
                                  <th className="text-xs text-uppercase text-end">Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((item, idx) => {
                                  const { debit, credit } = debitCreditCells(item);
                                  const rowKey = item._id || item.id || idx;
                                  return (
                                    <tr key={rowKey}>
                                      <td className="text-sm">{getAccountName(item)}</td>
                                      <td className="text-sm text-end">{debit}</td>
                                      <td className="text-sm text-end">{credit}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="font-weight-bold">
                                  <td className="text-sm pt-2">Totals</td>
                                  <td className="text-sm text-end pt-2">
                                    {formatTransactionAmount(sums.debit)}
                                  </td>
                                  <td className="text-sm text-end pt-2">
                                    {formatTransactionAmount(sums.credit)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {!loading && !error && viewMode === 'lines' && (
                <div className="table-responsive w-100">
                  <table className="table table-flush w-100">
                    <thead className="thead-light">
                      <tr>
                        <th>S.No</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('transaction_number')}
                          onDoubleClick={() => handleSort('transaction_number', true)}
                        >
                          No.
                          {renderSortIcon('transaction_number')}
                        </th>
                        <th>Account</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('type')}
                          onDoubleClick={() => handleSort('type', true)}
                        >
                          Type
                          {renderSortIcon('type')}
                        </th>
                        <th className="text-end">Debit</th>
                        <th className="text-end">Credit</th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('description')}
                          onDoubleClick={() => handleSort('description', true)}
                        >
                          Description
                          {renderSortIcon('description')}
                        </th>
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
                          <td colSpan="9" className="text-center text-sm font-weight-normal p-4">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        data.map((item, index) => {
                          const seriesNumber = (pagination.page - 1) * pagination.limit + index + 1;
                          const key = item._id || item.id || index;
                          const { debit, credit } = debitCreditCells(item);
                          const typeLabel = String(item.type || '—').trim() || '—';
                          const typeLower = typeLabel.toLowerCase();
                          return (
                            <tr key={key}>
                              <td className="text-sm font-weight-normal">{seriesNumber}</td>
                              <td className="text-sm font-weight-normal">
                                {item.transaction_number ?? item.transactionNumber ?? '—'}
                              </td>
                              <td className="text-sm font-weight-normal">{getAccountName(item)}</td>
                              <td className="text-sm font-weight-normal">
                                <span
                                  className={`badge ${
                                    typeLower === 'debit'
                                      ? 'bg-danger'
                                      : typeLower === 'credit'
                                        ? 'bg-success'
                                        : 'bg-secondary'
                                  }`}
                                >
                                  {typeLabel}
                                </span>
                              </td>
                              <td className="text-sm font-weight-normal text-end">{debit}</td>
                              <td className="text-sm font-weight-normal text-end">{credit}</td>
                              <td className="text-sm font-weight-normal">{item.description || '—'}</td>
                              <td className="text-sm font-weight-normal">
                                {item.status ? (
                                  <span
                                    className={`badge ${
                                      String(item.status).toLowerCase() === 'active'
                                        ? 'bg-success'
                                        : 'bg-secondary'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="text-sm font-weight-normal">
                                {item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
