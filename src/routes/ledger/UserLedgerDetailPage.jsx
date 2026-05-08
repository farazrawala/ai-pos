import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import LedgerUserProfileCard from '../../components/ledger/user-profile/LedgerUserProfileCard.jsx';
import LedgerDetailSummaryCards from '../../components/ledger/user-profile/LedgerDetailSummaryCards.jsx';
import LedgerChartsSection from '../../components/ledger/charts/LedgerChartsSection.jsx';
import LedgerDetailFilters from '../../components/ledger/filters/LedgerDetailFilters.jsx';
import LedgerTransactionsTable from '../../components/ledger/tables/LedgerTransactionsTable.jsx';
import LedgerTransactionDrawer from '../../components/ledger/drawers/LedgerTransactionDrawer.jsx';
import LedgerActivityTimeline from '../../components/ledger/timeline/LedgerActivityTimeline.jsx';
import { fetchUserByIdRequest } from '../../features/users/usersAPI.js';
import { mapApiUserToLedgerRow } from '../../components/ledger/ledgerUserMapper.js';
import { fetchTransactionsRequest } from '../../features/transactions/transactionsAPI.js';
import { mapApiTransactionToLedgerTransaction } from '../../components/ledger/ledgerTransactionMapper.js';
import { computeRunningBalances } from '../../components/ledger/ledgerUtils.js';
import { buildMonthlyDebitCreditSeries, buildLedgerTimelineEvents } from '../../components/ledger/ledgerChartData.js';
import {
  filterDetailTransactions,
  compareTransactions,
} from '../../components/ledger/ledgerDetailTransactionFilters.js';
import '../../components/ledger/ledger-module.css';

const PAGE_SIZE = 8;
const LEDGER_TX_FETCH_LIMIT = 500;
const TIMELINE_INITIAL = 10;
const TIMELINE_STEP = 10;

const initialDetailFilters = () => ({
  dateFrom: '',
  dateTo: '',
  transactionType: 'all',
  reference: '',
  paymentMethod: 'all',
  category: '',
  createdBy: '',
  searchNotes: '',
});

function exportTxnCsv(rows) {
  const headers = ['Date', 'Reference', 'Description', 'Category', 'Type', 'Debit', 'Credit', 'RunningBal', 'Payment', 'CreatedBy', 'Status'];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push(
      [
        r.date,
        r.referenceNo,
        `"${String(r.description).replace(/"/g, '""')}"`,
        r.category || '',
        r.type,
        r.debit,
        r.credit,
        r.runningBalance,
        r.paymentMethod || '',
        `"${String(r.createdBy).replace(/"/g, '""')}"`,
        r.status || '',
      ].join(',')
    );
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledger-export-${moment().format('YYYY-MM-DD-HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UserLedgerDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { canView } = usePermissions('orders');

  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setUserLoading(true);
    setUser(null);
    (async () => {
      try {
        const apiUser = await fetchUserByIdRequest(userId);
        if (cancelled) return;
        setUser(mapApiUserToLedgerRow(apiUser));
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [loading, setLoading] = useState(true);
  const [rawTx, setRawTx] = useState([]);
  const [draftFilters, setDraftFilters] = useState(initialDetailFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialDetailFilters);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_INITIAL);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchTransactionsRequest({
          referenceUserId: userId,
          populate: 'account_id,ref_id,reference_user_id,created_by',
          limit: LEDGER_TX_FETCH_LIMIT,
        });
        if (cancelled) return;
        const mapped = (Array.isArray(r.data) ? r.data : []).map((row) =>
          mapApiTransactionToLedgerTransaction(row)
        );
        mapped.sort((a, b) => new Date(a.date) - new Date(b.date));
        setRawTx(mapped);
      } catch (e) {
        if (!cancelled) {
          const msg = e?.message || 'Failed to load transactions';
          toast.error(msg);
          setRawTx([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (canView === false) navigate('/dashboard');
  }, [canView, navigate]);

  const filteredRaw = useMemo(
    () => filterDetailTransactions(rawTx, appliedFilters),
    [rawTx, appliedFilters]
  );

  useEffect(() => {
    setTimelineLimit(TIMELINE_INITIAL);
  }, [filteredRaw]);

  const monthlyDebitCredit = useMemo(
    () => buildMonthlyDebitCreditSeries(filteredRaw),
    [filteredRaw]
  );

  const sortedChrono = useMemo(() => {
    const chrono = [...filteredRaw].sort((a, b) => new Date(a.date) - new Date(b.date));
    return computeRunningBalances(chrono, user ? user.openingBalance : 0);
  }, [filteredRaw, user]);

  const displayRows = useMemo(() => {
    const sorted = [...sortedChrono].sort((a, b) => compareTransactions(a, b, sortKey, sortDir));
    return sorted;
  }, [sortedChrono, sortKey, sortDir]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
    setPage((p) => Math.min(Math.max(1, p), tp));
  }, [displayRows.length]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    filteredRaw.forEach((t) => {
      debit += Number(t.debit) || 0;
      credit += Number(t.credit) || 0;
    });
    const lastBal =
      sortedChrono.length > 0 ? sortedChrono[sortedChrono.length - 1].runningBalance : user?.openingBalance ?? 0;
    const now = moment();
    const monthStart = now.clone().startOf('month');
    const monthEnd = now.clone().endOf('month');
    let monthlyNet = 0;
    filteredRaw.forEach((t) => {
      const d = moment(t.date);
      if (d.isBetween(monthStart, monthEnd, undefined, '[]')) {
        monthlyNet += (Number(t.credit) || 0) - (Number(t.debit) || 0);
      }
    });
    let pendingAmt = 0;
    filteredRaw.forEach((t) => {
      if (t.status === 'pending') pendingAmt += Math.max(Number(t.debit) || 0, Number(t.credit) || 0);
    });
    return { debit, credit, currentBalance: lastBal, monthlyActivityNet: monthlyNet, pendingAmount: pendingAmt };
  }, [filteredRaw, sortedChrono, user]);

  const timelineEvents = useMemo(
    () => buildLedgerTimelineEvents(filteredRaw, { limit: timelineLimit }),
    [filteredRaw, timelineLimit]
  );

  const timelineHasMore = filteredRaw.length > timelineEvents.length;

  const handleTimelineAddMore = useCallback(() => {
    setTimelineLimit((n) => n + TIMELINE_STEP);
  }, []);

  const handleProfileAction = useCallback((action) => {
    const map = {
      add: 'Add entry',
      receive: 'Receive payment',
      send: 'Send payment',
      print: 'Print ledger',
      pdf: 'Export PDF',
      share: 'Share ledger',
    };
    toast.info(`${map[action] || action} (demo)`, { delay: 3500 });
  }, []);

  const handleFilterChange = useCallback((k, v) => {
    setDraftFilters((p) => ({ ...p, [k]: v }));
  }, []);

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }, [draftFilters]);

  const handleReset = useCallback(() => {
    const empty = initialDetailFilters();
    setDraftFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  }, []);

  const handleQuickRange = useCallback((label) => {
    let from = '';
    let to = '';
    const startOf = (u) => moment().startOf(u);
    const endOf = (u) => moment().endOf(u);
    if (label === 'Today') {
      from = startOf('day').format('YYYY-MM-DD');
      to = endOf('day').format('YYYY-MM-DD');
    } else if (label === 'This week') {
      from = startOf('week').format('YYYY-MM-DD');
      to = endOf('week').format('YYYY-MM-DD');
    } else if (label === 'This month') {
      from = startOf('month').format('YYYY-MM-DD');
      to = endOf('month').format('YYYY-MM-DD');
    } else if (label === 'This year') {
      from = startOf('year').format('YYYY-MM-DD');
      to = endOf('year').format('YYYY-MM-DD');
    }
    const next = { ...draftFilters, dateFrom: from, dateTo: to };
    setDraftFilters(next);
    setAppliedFilters(next);
    setPage(1);
  }, [draftFilters]);

  const handleSort = useCallback((key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const clearSelectedTxn = useCallback(() => setSelectedTxn(null), []);

  const handleTableAction = useCallback(
    (action, row) => {
      if (action === 'view') setSelectedTxn(row);
      else if (action === 'edit') toast.info(`Edit ${row.referenceNo} (demo)`, { delay: 4000 });
      else if (action === 'delete') toast.warning(`Delete ${row.referenceNo} (demo)`, { delay: 4000 });
      else if (action === 'print' || action === 'receipt') toast.info(`${action} ${row.referenceNo} (demo)`, { delay: 4000 });
    },
    []
  );

  if (!userLoading && !user) {
    return <Navigate to="/ledger" replace />;
  }

  if (userLoading || !user) {
    return (
      <div className="container-fluid py-4 ledger-module px-3 px-lg-4">
        <div className="placeholder-glow rounded">
          <span className="placeholder col-12 py-5 d-block rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="container-fluid py-4 px-0 ledger-module"
      style={{ width: '100%', maxWidth: '100%' }}
    >
      <div className="px-3 px-lg-4">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Link to="/ledger" className="btn btn-sm btn-outline-secondary mb-0">
            <i className="ni ni-bold-left me-1" />
            User ledgers
          </Link>
          <span className="text-xs text-muted">/{user.fullName}</span>
        </div>

        <LedgerUserProfileCard user={user} onAction={handleProfileAction} />

        <LedgerDetailSummaryCards
          openingBalance={user.openingBalance}
          currentBalance={totals.currentBalance}
          totalDebit={totals.debit}
          totalCredit={totals.credit}
          monthlyActivityNet={totals.monthlyActivityNet}
          pendingAmount={totals.pendingAmount}
        />
      </div>

      <section className="ledger-transactions-fullwidth w-200">
        <LedgerDetailFilters
          dateFrom={draftFilters.dateFrom}
          dateTo={draftFilters.dateTo}
          transactionType={draftFilters.transactionType}
          reference={draftFilters.reference}
          paymentMethod={draftFilters.paymentMethod}
          category={draftFilters.category}
          createdBy={draftFilters.createdBy}
          searchNotes={draftFilters.searchNotes}
          onChange={handleFilterChange}
          onApply={handleApply}
          onReset={handleReset}
          onQuickRange={handleQuickRange}
          onExportCsv={() => {
            exportTxnCsv(displayRows);
            toast.success(`Exported ${displayRows.length} rows`, { delay: 3000 });
          }}
        />

        <LedgerTransactionsTable
          rows={displayRows}
          loading={loading}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          onRowOpenDrawer={setSelectedTxn}
          onAction={handleTableAction}
        />
      </section>

      <div className="px-3 px-lg-4">
        <LedgerChartsSection monthlyDebitCredit={monthlyDebitCredit} />

        <LedgerActivityTimeline
          events={timelineEvents}
          hasMore={timelineHasMore}
          onAddMore={handleTimelineAddMore}
          totalMatching={filteredRaw.length}
        />
      </div>

      {selectedTxn ? (
        <LedgerTransactionDrawer
          row={selectedTxn}
          onClose={clearSelectedTxn}
          onPrint={(r) => toast.info(`Print ${r.referenceNo}`, { delay: 3000 })}
          onPdf={(r) => toast.info(`PDF ${r.referenceNo}`, { delay: 3000 })}
          onShare={(r) => toast.info(`Share ${r.referenceNo}`, { delay: 3000 })}
        />
      ) : null}
    </div>
  );
}
