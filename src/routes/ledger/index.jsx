import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import { fetchUsersRequest } from '../../features/users/usersAPI.js';
import LedgerListingSummaryCards from '../../components/ledger/users-list/LedgerListingSummaryCards.jsx';
import LedgerUsersFilters from '../../components/ledger/filters/LedgerUsersFilters.jsx';
import LedgerUsersTable from '../../components/ledger/tables/LedgerUsersTable.jsx';
import { getLedgerListingAggregates } from '../../components/ledger/mock/ledgerUsers.mock.js';
import { filterLedgerUsers } from '../../components/ledger/ledgerListingFilters.js';
import {
  mapApiUserToLedgerRow,
  LEDGER_LIST_SORT_API,
} from '../../components/ledger/ledgerUserMapper.js';
import '../../components/ledger/ledger-module.css';

const initialFilters = () => ({
  search: '',
  contactSearch: '',
  status: 'all',
  balanceType: 'all',
  dateFrom: '',
  dateTo: '',
});

const LIST_PAGE_SIZE = 10;

/** When status/balance/date filters are used, load up to this many users for client-side filtering. */
const CLIENT_FILTER_CAP = 500;

function needsClientSideLedgerFilters(f) {
  if (!f) return false;
  if (f.status && f.status !== 'all') return true;
  if (f.balanceType && f.balanceType !== 'all') return true;
  if (f.dateFrom && f.dateTo) return true;
  return false;
}

export default function LedgerListingPage() {
  const navigate = useNavigate();
  const { canView } = usePermissions('ledger');
  useRequireModuleAccess('ledger');

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [sortKey, setSortKey] = useState('fullName');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIST_PAGE_SIZE);
  const [localSearch, setLocalSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  /** Sample for summary cards (capped); `totalUsers` comes from API total when available. */
  const [aggregateSample, setAggregateSample] = useState([]);
  const [aggregateTotalUsers, setAggregateTotalUsers] = useState(0);

  useEffect(() => {
    setLocalSearch(appliedFilters.search || '');
  }, [appliedFilters.search]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchUsersRequest({ skip: 0, limit: 500 });
        if (cancelled) return;
        setAggregateSample(r.data.map(mapApiUserToLedgerRow));
        setAggregateTotalUsers(typeof r.total === 'number' ? r.total : r.data.length);
      } catch {
        if (!cancelled) {
          setAggregateSample([]);
          setAggregateTotalUsers(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const search = [appliedFilters.search, appliedFilters.contactSearch]
          .filter(Boolean)
          .join(' ')
          .trim();
        const sortBy = LEDGER_LIST_SORT_API[sortKey] || 'name';

        if (!needsClientSideLedgerFilters(appliedFilters)) {
          const r = await fetchUsersRequest({
            page,
            limit: pageSize,
            search: search || undefined,
            sortBy,
            sortOrder: sortDir,
          });
          if (cancelled) return;
          setUsers(r.data.map(mapApiUserToLedgerRow));
          setTotalRowCount(typeof r.total === 'number' ? r.total : r.data.length);
          return;
        }

        const meta = await fetchUsersRequest({ page: 1, limit: 1, search: search || undefined });
        const total = typeof meta.total === 'number' ? meta.total : 0;
        const cap = Math.min(total, CLIENT_FILTER_CAP);
        if (cap === 0) {
          if (!cancelled) {
            setUsers([]);
            setTotalRowCount(0);
          }
          return;
        }

        const bulk = await fetchUsersRequest({
          skip: 0,
          limit: cap,
          search: search || undefined,
          sortBy,
          sortOrder: sortDir,
        });
        if (cancelled) return;

        let mapped = bulk.data.map(mapApiUserToLedgerRow);
        mapped = filterLedgerUsers(mapped, {
          ...appliedFilters,
          sortBy: sortKey,
          sortDir,
        });
        setTotalRowCount(mapped.length);
        const start = (page - 1) * pageSize;
        setUsers(mapped.slice(start, start + pageSize));
      } catch (e) {
        if (!cancelled) {
          const msg = e?.message || 'Failed to load ledger users';
          toast.error(msg);
          setUsers([]);
          setTotalRowCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, appliedFilters, sortKey, sortDir]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(totalRowCount / pageSize) || 1);
    setPage((p) => Math.min(Math.max(1, p), tp));
  }, [totalRowCount, pageSize]);

  const aggregates = useMemo(() => {
    const base = getLedgerListingAggregates(aggregateSample, 0);
    return {
      ...base,
      totalUsers: aggregateTotalUsers || base.totalUsers,
    };
  }, [aggregateSample, aggregateTotalUsers]);

  const handleFilterChange = useCallback((key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDraftFilters((prev) => ({ ...prev, search: value, contactSearch: '' }));
      setAppliedFilters((prev) => ({ ...prev, search: value, contactSearch: '' }));
      setPage(1);
    }, 500);
  }, []);

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }, [draftFilters]);

  const handleReset = useCallback(() => {
    const empty = initialFilters();
    setDraftFilters(empty);
    setAppliedFilters(empty);
    setLocalSearch('');
    setSortKey('fullName');
    setSortDir('asc');
    setPage(1);
  }, []);

  const handleQuickFilter = useCallback(
    (label) => {
      let next = { ...draftFilters };
      if (label === 'Active') next = { ...next, status: 'active', balanceType: 'all' };
      else if (label === 'Receivable') next = { ...next, balanceType: 'positive', status: 'all' };
      else if (label === 'Payable') next = { ...next, balanceType: 'negative', status: 'all' };
      else if (label === 'Recent activity') {
        next = { ...next };
        setSortKey('lastTransactionAt');
        setSortDir('desc');
      }
      setDraftFilters(next);
      setAppliedFilters(next);
      setPage(1);
      toast.info(`Quick filter: ${label}`, { delay: 2500 });
    },
    [draftFilters]
  );

  const handleSort = useCallback((key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  }, []);

  const handleRowNavigate = useCallback(
    (userId) => {
      navigate(`/ledger/${encodeURIComponent(userId)}`);
    },
    [navigate]
  );

  const handleAction = useCallback(
    (action, u) => {
      const map = {
        view: () => navigate(`/ledger/${encodeURIComponent(u.id)}`),
        tx: () => toast.info(`Add transaction — ${u.fullName} (demo)`, { delay: 4000 }),
        remind: () => toast.info(`Reminder sent — ${u.fullName} (demo)`, { delay: 4000 }),
        pdf: () => toast.info(`Export PDF — ${u.fullName} (demo)`, { delay: 4000 }),
        edit: () => toast.info(`Edit — ${u.fullName} (demo)`, { delay: 4000 }),
        delete: () => toast.warning(`Delete — ${u.fullName} (demo)`, { delay: 4000 }),
      };
      if (map[action]) map[action]();
    },
    [navigate]
  );

  const headerActions = useCallback((kind) => {
    const labels = {
      add: 'Add ledger (demo)',
      export: 'Export (demo)',
      import: 'Import (demo)',
      filter: 'Focus filters (demo)',
    };
    toast.info(labels[kind] || kind, { delay: 3500 });
  }, []);

  return (
    <div className="container-fluid py-4 ledger-module">
      
      <LedgerUsersTable
        rows={users}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalRowCount={totalRowCount}
        search={localSearch}
        onSearchChange={handleSearchChange}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onRowNavigate={handleRowNavigate}
        onAction={handleAction}
      />
    </div>
  );
}
