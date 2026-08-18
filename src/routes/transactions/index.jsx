import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  fetchTransactions,
  fetchDeletedTransactions,
  setSearch,
  setPage,
  setLimit,
  setSort,
  setDateFilters,
  setDocumentRefFilter,
  clearDateFilters,
} from '../../features/transactions/transactionsSlice.js';
import {
  getAccountName,
  formatTransactionAmount,
  groupTransactionsIntoJournals,
  sumDebitCreditForLines,
  sortJournalLinesDebitFirst,
  enrichTransactionDescription,
  buildDocumentRefLinkMap,
} from '../../features/transactions/transactionsAPI.js';
import { fetchOrdersRequest } from '../../features/orders/ordersAPI.js';
import { fetchPurchaseOrdersListRequest } from '../../features/purchaseOrders/purchaseOrdersAPI.js';
import { FaFilter, FaPen } from 'react-icons/fa6';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import NavIcon from '../../components/NavIcon.jsx';
import TablePagination from '../../components/TablePagination.jsx';
import FetchRetryStatus from '../../components/list/FetchRetryStatus.jsx';
import { renderTransactionDescriptionLinks } from '../../components/transactions/TransactionDescriptionLinks.jsx';
import { useFetchRetryCountdown } from '../../hooks/useFetchRetryCountdown.js';
import { DEBUG } from '../../config/env.js';

const encodeDocumentFilterValue = (kind, id) => `${kind}:${id}`;

const parseDocumentFilterValue = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return { refId: '', documentKind: '' };
  const colon = value.indexOf(':');
  if (colon <= 0) return { refId: value, documentKind: '' };
  const documentKind = value.slice(0, colon);
  const refId = value.slice(colon + 1).trim();
  if (!refId) return { refId: '', documentKind: '' };
  if (documentKind !== 'order' && documentKind !== 'purchase_order') {
    return { refId: value, documentKind: '' };
  }
  return { refId, documentKind };
};

const orderOptionRef = (row) => {
  const n = row?.order_no ?? row?.orderNo ?? row?.invoice_no ?? row?.invoiceNo ?? '';
  const s = String(n).trim();
  return s || '';
};

const poOptionRef = (row) => {
  const n =
    row?.purchase_order_no ??
    row?.po_no ??
    row?.order_no ??
    row?.reference ??
    row?.invoice_no ??
    '';
  const s = String(n).trim();
  return s || '';
};

const Transactions = () => {
  const dispatch = useDispatch();
  const {
    list: data,
    status,
    error,
    pagination,
    search: searchTerm,
    sort,
    filters,
  } = useSelector((state) => state.transactions);
  const { canView, isAdmin } = usePermissions('transactions');
  useRequireModuleAccess('transactions');
  const navigate = useNavigate();

  const loading = status === 'loading';
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const [localStartDate, setLocalStartDate] = useState(filters.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(filters.endDate || '');
  const [showFilters, setShowFilters] = useState(
    Boolean(filters.startDate || filters.endDate || filters.refId)
  );
  /** 'journal' | 'lines' — layout for both active and deleted data */
  const [viewMode, setViewMode] = useState('journal');
  const [showDeleted, setShowDeleted] = useState(false);
  const [documentFilterOptions, setDocumentFilterOptions] = useState([
    { value: '', label: 'All orders / purchase orders' },
  ]);
  const [documentFilterStatus, setDocumentFilterStatus] = useState('idle');
  const searchTimeoutRef = useRef(null);
  const sortClickTimeoutRef = useRef(null);
  const isDeletedView = showDeleted;
  const isJournalView = viewMode === 'journal';
  const isLinesView = viewMode === 'lines';

  const documentFilterValue =
    filters.refId && filters.documentKind
      ? encodeDocumentFilterValue(filters.documentKind, filters.refId)
      : filters.refId || '';

  const activeFilterCount =
    (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0) + (filters.refId ? 1 : 0);

  const journals = useMemo(() => groupTransactionsIntoJournals(data), [data]);

  const buildListParams = useCallback(() => {
    const params = { page: pagination.page, limit: pagination.limit };
    if (searchTerm) params.search = searchTerm;
    if (sort.sortBy) {
      params.sortBy = sort.sortBy;
      params.sortOrder = sort.sortOrder;
    }
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.refId) {
      params.refId = filters.refId;
      if (filters.documentKind === 'order') params.orderId = filters.refId;
      if (filters.documentKind === 'purchase_order') params.purchaseOrderId = filters.refId;
    }
    return params;
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    sort.sortBy,
    sort.sortOrder,
    filters.startDate,
    filters.endDate,
    filters.refId,
    filters.documentKind,
  ]);

  const fetchList = useCallback(() => {
    if (isDeletedView) {
      dispatch(fetchDeletedTransactions(buildListParams()));
    } else {
      dispatch(fetchTransactions(buildListParams()));
    }
  }, [dispatch, buildListParams, isDeletedView]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleRetryFetch = useCallback(() => {
    fetchList();
  }, [fetchList]);

  const { countdown: retryCountdown, isRetrying } = useFetchRetryCountdown({
    isFailed: Boolean(error),
    onRetry: handleRetryFetch,
    seconds: 5,
    enabled: Boolean(error),
  });

  useEffect(() => {
    let cancelled = false;
    setDocumentFilterStatus('loading');
    (async () => {
      try {
        const [ordersResult, poResult] = await Promise.all([
          fetchOrdersRequest({ page: 1, limit: 500 }),
          fetchPurchaseOrdersListRequest({ page: 1, limit: 500 }),
        ]);
        if (cancelled) return;

        const orderRows = Array.isArray(ordersResult?.data) ? ordersResult.data : [];
        const poRows = Array.isArray(poResult?.data) ? poResult.data : [];

        const orderOptions = orderRows
          .map((row) => {
            const id = String(row?._id ?? row?.id ?? '').trim();
            if (!id) return null;
            const ref = orderOptionRef(row);
            return {
              value: encodeDocumentFilterValue('order', id),
              label: ref || `Order ${id.slice(0, 8)}…`,
              subLabel: 'Order',
            };
          })
          .filter(Boolean);

        const poOptions = poRows
          .map((row) => {
            const id = String(row?._id ?? row?.id ?? '').trim();
            if (!id) return null;
            const ref = poOptionRef(row);
            return {
              value: encodeDocumentFilterValue('purchase_order', id),
              label: ref || `PO ${id.slice(0, 8)}…`,
              subLabel: 'Purchase order',
            };
          })
          .filter(Boolean);

        setDocumentFilterOptions([
          { value: '', label: 'All orders / purchase orders' },
          ...orderOptions,
          ...poOptions,
        ]);
        setDocumentFilterStatus('succeeded');
      } catch (err) {
        console.error('[Transactions] Failed to load order/PO filter options', err);
        if (!cancelled) {
          setDocumentFilterOptions([{ value: '', label: 'All orders / purchase orders' }]);
          setDocumentFilterStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewModeChange = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
  };

  const handleDeletedToggle = () => {
    setShowDeleted((prev) => {
      const next = !prev;
      if (next) setViewMode('journal');
      return next;
    });
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

  const handleDocumentFilterChange = useCallback(
    (next) => {
      const parsed = parseDocumentFilterValue(next);
      dispatch(setDocumentRefFilter(parsed));
      if (parsed.refId) setShowFilters(true);
    },
    [dispatch]
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };

  const debitCreditCells = (row) => {
    const t = String(row.type || '')
      .toLowerCase()
      .trim();
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
    const descriptions = [
      ...new Set(
        lines
          .map((r) => enrichTransactionDescription(r))
          .filter((d) => d && !d.includes('Mode of Payment'))
      ),
    ];
    const desc = descriptions.length > 0 ? descriptions.join(' · ') : '—';
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
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card w-100" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <div className="row align-items-center gy-2">
                <div className="col-md-6">
                  <h5 className="mb-0">
                    {isDeletedView ? 'Deleted Transactions' : 'Transactions'}
                  </h5>
                  {DEBUG ? (
                    <p className="text-sm mb-0 text-muted">
                      {isDeletedView ? (
                        <>
                          Deleted transactions. API:{' '}
                          <code className="small">GET /transaction/get-deleted</code>
                        </>
                      ) : (
                        <>
                          Double-entry journals (grouped lines). API:{' '}
                          <code className="small">
                            GET /transaction/get-all-active?populate=account_id,ref_id
                          </code>
                        </>
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 flex-wrap">
                    {isAdmin ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary mb-0"
                        onClick={() => navigate('/transactions/add')}
                      >
                        <i className="fas fa-plus me-1" aria-hidden="true" />
                        Add transaction
                      </button>
                    ) : null}
                    <div
                      className="btn-group btn-group-sm"
                      role="group"
                      aria-label="Transaction view mode"
                    >
                      <button
                        type="button"
                        className={`btn mb-0 ${isJournalView ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleViewModeChange('journal')}
                      >
                        Journal view
                      </button>
                      <button
                        type="button"
                        className={`btn mb-0 ${isLinesView ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleViewModeChange('lines')}
                      >
                        All lines
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm mb-0 ${showDeleted ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={handleDeletedToggle}
                      aria-pressed={showDeleted}
                    >
                      Deleted Transactions
                    </button>
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
                        aria-label="Search transactions"
                      />
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm mb-0 position-relative ${
                        showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-outline-primary'
                      }`}
                      onClick={() => setShowFilters((prev) => !prev)}
                      aria-expanded={showFilters}
                      aria-controls="transactions-filter-panel"
                      aria-label="Filters"
                      title="Filters"
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
            <div className="card-body pt-0">
              {showFilters ? (
                <div className="list-filter-panel mb-3" id="transactions-filter-panel">
                  <div className="row g-2 align-items-end">
                    <div className="col-md-3">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="transactions-from-date"
                      >
                        From date
                      </label>
                      <input
                        id="transactions-from-date"
                        type="date"
                        className="form-control form-control-sm"
                        value={localStartDate}
                        onChange={(e) => setLocalStartDate(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="transactions-to-date"
                      >
                        To date
                      </label>
                      <input
                        id="transactions-to-date"
                        type="date"
                        className="form-control form-control-sm"
                        value={localEndDate}
                        onChange={(e) => setLocalEndDate(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label
                        className="form-label mb-1 text-xs text-uppercase fw-bold text-muted"
                        htmlFor="transactions-document-filter"
                      >
                        Order / Purchase order
                      </label>
                      <SearchableSelect
                        id="transactions-document-filter"
                        options={documentFilterOptions}
                        value={documentFilterValue}
                        placeholder="All orders / purchase orders"
                        disabled={loading || documentFilterStatus === 'loading'}
                        loading={documentFilterStatus === 'loading'}
                        onChange={handleDocumentFilterChange}
                      />
                    </div>
                    <div className="col-md-3 d-flex flex-wrap gap-2">
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
                </div>
              ) : null}

              {loading && (
                <div className="text-center p-4">
                  <p className="mb-0">
                    {isDeletedView ? 'Loading deleted transactions…' : 'Loading transactions…'}
                  </p>
                </div>
              )}
              {!loading && isRetrying && (
                <FetchRetryStatus countdown={retryCountdown} />
              )}
              {error && !isRetrying && (
                <div className="alert alert-danger m-3" role="alert">
                  {error}
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger mb-0"
                      onClick={handleRetryFetch}
                    >
                      Retry now
                    </button>
                  </div>
                </div>
              )}
              {!loading && !error && isJournalView && (
                <div className="journal-entry-list">
                  {journals.length === 0 ? (
                    <div className="journal-entry-empty">
                      <i className="fas fa-book-open" aria-hidden="true" />
                      <span>
                        {isDeletedView ? 'No deleted transactions found' : 'No transactions found'}
                      </span>
                    </div>
                  ) : (
                    journals.map((lines, jIndex) => {
                      const meta = journalMeta(lines);
                      const linkMap = buildDocumentRefLinkMap(lines);
                      const sortedLines = sortJournalLinesDebitFirst(lines);
                      const sums = sumDebitCreditForLines(lines);
                      const jKey = lines[0]?._id || lines[0]?.id || `${pagination.page}-${jIndex}`;
                      return (
                        <div
                          key={jKey}
                          className={`journal-entry-card${isDeletedView ? ' is-deleted' : ''}`}
                        >
                          <div className="journal-entry-head">
                            <div>
                              <span className="journal-entry-eyebrow">
                                {isDeletedView ? 'Deleted journal entry' : 'Journal entry'}
                              </span>
                              <div className="journal-entry-idline">
                                <span className="journal-entry-ref">
                                  <i className="fas fa-hashtag" aria-hidden="true" />
                                  {meta.ref}
                                </span>
                                <span className="journal-entry-date">
                                  <i className="far fa-clock" aria-hidden="true" />
                                  {meta.createdAt
                                    ? meta.createdAt.format('MM-DD-YYYY h:mm a')
                                    : '—'}
                                </span>
                              </div>
                            </div>
                            <div className="journal-entry-badges">
                              {meta.status ? (
                                <span
                                  className={`journal-chip ${
                                    String(meta.status).toLowerCase() === 'active'
                                      ? 'journal-chip--success'
                                      : 'journal-chip--muted'
                                  }`}
                                >
                                  {meta.status}
                                </span>
                              ) : null}
                              <span
                                className={`journal-chip ${
                                  sums.balanced
                                    ? 'journal-chip--success'
                                    : 'journal-chip--warning journal-chip--alert'
                                }`}
                                title="Debits should equal credits for a complete posting"
                              >
                                {sums.balanced ? 'Balanced' : 'Check totals'}
                              </span>
                            </div>
                          </div>
                          <div className="journal-entry-body">
                            {meta.description && meta.description !== '—' ? (
                              <div className="journal-entry-source">
                                <i className="fas fa-file-invoice-dollar" aria-hidden="true" />
                                <span>
                                  {renderTransactionDescriptionLinks(meta.description, linkMap)}
                                </span>
                              </div>
                            ) : null}
                            <table className="journal-entry-table">
                              <thead>
                                <tr>
                                  {isAdmin && !isDeletedView ? (
                                    <th style={{ width: '48px' }} />
                                  ) : null}
                                  <th>Account</th>
                                  <th className="text-end">Debit</th>
                                  <th className="text-end">Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedLines.map((item, idx) => {
                                  const { debit, credit } = debitCreditCells(item);
                                  const rowKey = item._id || item.id || idx;
                                  const isDebitLine =
                                    String(item.type || '')
                                      .toLowerCase()
                                      .trim() === 'debit';
                                  return (
                                    <tr key={rowKey}>
                                      {isAdmin && !isDeletedView ? (
                                        <td>
                                          <button
                                            type="button"
                                            className="journal-entry-edit"
                                            title="Edit transaction"
                                            aria-label="Edit transaction"
                                            onClick={() =>
                                              navigate(
                                                `/transactions/edit/${item._id || item.id}`,
                                                {
                                                  state: { transaction: item },
                                                }
                                              )
                                            }
                                          >
                                            <NavIcon icon={FaPen} size={11} />
                                          </button>
                                        </td>
                                      ) : null}
                                      <td>
                                        <span className="journal-entry-account">
                                          <span
                                            className={`journal-entry-dot journal-entry-dot--${
                                              isDebitLine ? 'debit' : 'credit'
                                            }`}
                                            aria-hidden="true"
                                          />
                                          {getAccountName(item)}
                                        </span>
                                      </td>
                                      <td
                                        className={`text-end journal-entry-amount${
                                          debit === '—' ? ' is-empty' : ''
                                        }`}
                                      >
                                        {debit}
                                      </td>
                                      <td
                                        className={`text-end journal-entry-amount${
                                          credit === '—' ? ' is-empty' : ''
                                        }`}
                                      >
                                        {credit}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr>
                                  {isAdmin && !isDeletedView ? <td /> : null}
                                  <td>Totals</td>
                                  <td className="text-end journal-entry-amount">
                                    {formatTransactionAmount(sums.debit)}
                                  </td>
                                  <td className="text-end journal-entry-amount">
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

              {!loading && !error && isLinesView && (
                <div className="list-data-table mx-3 mb-3">
                  <div className="list-data-table-scroll">
                    <table className="table align-items-center mb-0 w-100">
                      <thead>
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
                          {isAdmin && !isDeletedView ? <th className="text-end">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {data.length === 0 ? (
                          <tr>
                            <td
                              colSpan={isAdmin && !isDeletedView ? 10 : 9}
                              className="text-center text-sm font-weight-normal p-4"
                            >
                              {isDeletedView
                                ? 'No deleted transactions found'
                                : 'No transactions found'}
                            </td>
                          </tr>
                        ) : (
                          data.map((item, index) => {
                            const seriesNumber =
                              (pagination.page - 1) * pagination.limit + index + 1;
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
                                <td className="text-sm font-weight-normal">
                                  {getAccountName(item)}
                                </td>
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
                                <td className="text-sm font-weight-normal">
                                  {renderTransactionDescriptionLinks(
                                    enrichTransactionDescription(item) || '—',
                                    buildDocumentRefLinkMap([item])
                                  )}
                                </td>
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
                                {isAdmin && !isDeletedView ? (
                                  <td className="text-end">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary mb-0 py-1 px-2"
                                      title="Edit transaction"
                                      onClick={() =>
                                        navigate(`/transactions/edit/${item._id || item.id}`, {
                                          state: { transaction: item },
                                        })
                                      }
                                    >
                                      <NavIcon icon={FaPen} size={12} />
                                    </button>
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    className="list-table-toolbar--footer"
                    selectId="transactions-table-page-size"
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    hidden={pagination.total === 0}
                  />
                </div>
              )}

              {!loading && !error && isJournalView && pagination.total > 0 && (
                <div className="mx-3 mb-3">
                  <TablePagination
                    selectId="transactions-journal-page-size"
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                  />
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
