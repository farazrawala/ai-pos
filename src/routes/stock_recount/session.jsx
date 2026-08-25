import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchStockRecountsRequest,
  formatQty,
  getProductLabel,
  getProductSku,
  getRecountSessionStatus,
  getWarehouseLabel,
  isCounted,
  postRecountSessionRequest,
  RECOUNT_SESSION_STATUS,
  roundQty,
  setRecountSessionStatus,
  shortSessionId,
  STOCK_RECOUNT_SESSION_POPULATE,
  updateStockRecountRequest,
  varianceOf,
} from '../../features/stockRecount/stockRecountAPI.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { DEBUG } from '../../config/env.js';
import { toast } from '../../utils/toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import './stock-recount.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Uncounted' },
  { id: 'variance', label: 'Variance' },
  { id: 'matched', label: 'Matched' },
];

function sanitizeQtyInput(value) {
  const s = String(value ?? '').replace(/,/g, '');
  let out = '';
  let sawDot = false;
  let sawMinus = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '-' && i === 0 && !sawMinus) {
      out += ch;
      sawMinus = true;
    } else if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch === '.' && !sawDot) {
      out += ch;
      sawDot = true;
    }
  }
  const dot = out.indexOf('.');
  if (dot !== -1 && out.length - dot - 1 > 2) {
    out = out.slice(0, dot + 3);
  }
  return out;
}

function draftFromRow(row) {
  if (!isCounted(row)) return '';
  const n = roundQty(row.counted_qty);
  return n == null ? '' : String(n);
}

function varianceClass(variance) {
  if (variance == null) return 'text-muted';
  if (variance === 0) return 'text-success';
  if (variance < 0) return 'text-danger';
  return 'text-warning';
}

const StockRecountSession = () => {
  useRequireModuleAccess('stock-recounts');
  const { canEdit, isAdmin } = usePermissions('stock-recounts');
  const canUpdate = isAdmin || canEdit;
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [lines, setLines] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState({});
  const [savingIds, setSavingIds] = useState({});
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [savingAll, setSavingAll] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postedSummary, setPostedSummary] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(() =>
    getRecountSessionStatus(sessionId)
  );

  const loadSession = useCallback(async () => {
    const id = String(sessionId || '').trim();
    if (!id) {
      setError('Missing recount session');
      setStatus('failed');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetchStockRecountsRequest({
        stock_recount_id: id,
        populate: STOCK_RECOUNT_SESSION_POPULATE,
        limit: 5000,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setLines(rows);
      const nextDrafts = {};
      rows.forEach((row) => {
        const rid = String(row._id || row.id || '');
        if (rid) nextDrafts[rid] = draftFromRow(row);
      });
      setDrafts(nextDrafts);
      setDirty({});
      setSessionStatus(getRecountSessionStatus(id));
      setStatus('succeeded');
    } catch (err) {
      setLines([]);
      setError(err?.message || 'Failed to load recount session');
      setStatus('failed');
    }
  }, [sessionId]);

  useEffect(() => {
    setSessionStatus(getRecountSessionStatus(sessionId));
  }, [sessionId]);

  const markInProgress = useCallback(() => {
    const id = String(sessionId || '').trim();
    if (!id) return;
    setRecountSessionStatus(id, RECOUNT_SESSION_STATUS.IN_PROGRESS);
    setSessionStatus(RECOUNT_SESSION_STATUS.IN_PROGRESS);
  }, [sessionId]);

  const markCompleted = useCallback(() => {
    const id = String(sessionId || '').trim();
    if (!id) return;
    setRecountSessionStatus(id, RECOUNT_SESSION_STATUS.COMPLETED);
    setSessionStatus(RECOUNT_SESSION_STATUS.COMPLETED);
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const warehouseName = useMemo(() => {
    if (!lines.length) return '—';
    return getWarehouseLabel(lines[0]);
  }, [lines]);

  const createdAt = useMemo(() => {
    if (!lines.length) return null;
    return lines.reduce((min, row) => {
      const t = row.createdAt || row.created_at;
      if (!t) return min;
      if (!min || t < min) return t;
      return min;
    }, null);
  }, [lines]);

  const stats = useMemo(() => {
    let counted = 0;
    let variance = 0;
    lines.forEach((row) => {
      if (isCounted(row)) {
        counted += 1;
        const v = varianceOf(row);
        if (v != null && v !== 0) variance += 1;
      }
    });
    return {
      total: lines.length,
      counted,
      pending: lines.length - counted,
      variance,
    };
  }, [lines]);

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((row) => {
      const counted = isCounted(row);
      const v = varianceOf(row);
      if (filter === 'pending' && counted) return false;
      if (filter === 'variance' && (v == null || v === 0)) return false;
      if (filter === 'matched' && !(counted && v === 0)) return false;
      if (!q) return true;
      const name = getProductLabel(row).toLowerCase();
      const sku = getProductSku(row).toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [lines, search, filter]);

  const dirtyIds = useMemo(() => Object.keys(dirty).filter((id) => dirty[id]), [dirty]);

  const handleDraftChange = (rowId, value) => {
    const next = sanitizeQtyInput(value);
    setDrafts((prev) => ({ ...prev, [rowId]: next }));
    setDirty((prev) => ({ ...prev, [rowId]: true }));
    markInProgress();
  };

  const saveRow = async (row) => {
    const rowId = String(row._id || row.id || '');
    if (!rowId || !canUpdate) return;
    const raw = drafts[rowId];
    const countedQty = raw === '' || raw == null || raw === '-' || raw === '.' ? null : roundQty(raw);
    if (raw && countedQty == null) {
      toast.error('Enter a valid counted quantity');
      return;
    }
    setSavingIds((prev) => ({ ...prev, [rowId]: true }));
    try {
      const updated = await updateStockRecountRequest(rowId, { counted_qty: countedQty });
      setLines((prev) =>
        prev.map((line) => {
          if (String(line._id || line.id) !== rowId) return line;
          const next = { ...line, ...(updated && typeof updated === 'object' ? updated : {}) };
          if (updated?.counted_qty === undefined) next.counted_qty = countedQty;
          if (updated?.variance_qty == null && countedQty != null) {
            next.variance_qty = roundQty(countedQty - Number(next.system_qty || 0));
          }
          if (countedQty == null) next.variance_qty = 0;
          return next;
        })
      );
      setDirty((prev) => {
        const copy = { ...prev };
        delete copy[rowId];
        return copy;
      });
    } catch (err) {
      toast.error(err?.message || 'Could not save counted qty');
    } finally {
      setSavingIds((prev) => {
        const copy = { ...prev };
        delete copy[rowId];
        return copy;
      });
    }
  };

  const saveAllDirty = async () => {
    if (!canUpdate || dirtyIds.length === 0) return;
    setSavingAll(true);
    try {
      for (const id of dirtyIds) {
        const row = lines.find((line) => String(line._id || line.id) === id);
        if (row) await saveRow(row);
      }
      toast.success('Counted quantities saved.');
    } finally {
      setSavingAll(false);
    }
  };

  const handlePost = async () => {
    if (!canUpdate || posting) return;
    if (dirtyIds.length > 0) {
      toast.warning('Save counted quantities before posting.');
      return;
    }
    const ok = window.confirm(
      stats.variance > 0
        ? `Post ${stats.variance} variance line${stats.variance === 1 ? '' : 's'} to warehouse inventory and mark this recount completed?`
        : 'No variances to post. Mark this recount as completed?'
    );
    if (!ok) return;

    setPosting(true);
    try {
      let result = { posted: 0, skipped: 0 };
      if (stats.variance > 0) {
        result = await postRecountSessionRequest(sessionId);
        setPostedSummary(result);
      }
      markCompleted();
      toast.success(
        stats.variance > 0
          ? result.posted
            ? `Posted ${result.posted} adjustment${result.posted === 1 ? '' : 's'}. Recount completed.`
            : 'Post complete. Recount marked completed.'
          : 'Recount marked completed.'
      );
      await loadSession();
    } catch (err) {
      toast.error(err?.message || 'Could not post stock recount');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0 stock-recount-page">
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <button
            type="button"
            className="stock-recount-back"
            onClick={() => navigate('/stock-recounts')}
          >
            ← Back to recounts
          </button>
          <div className="card shadow-sm">
            <div className="card-header pb-3">
              <div className="row align-items-start g-2">
                <div className="col-lg-6">
                  <h5 className="mb-1">Recount #{shortSessionId(sessionId)}</h5>
                  <p className="text-sm text-muted mb-0">
                    {warehouseName}
                    {createdAt ? ` · ${moment(createdAt).format('DD MMM YYYY h:mm a')}` : ''}
                  </p>
                  {DEBUG ? (
                    <p className="text-xs text-muted mb-0 mt-1">
                      <code>GET /stock_recount/get-all-active?stock_recount_id=…</code>
                      {' · '}
                      <code>PATCH /stock_recount/update/:id</code>
                      {' · '}
                      <code>POST /stock_recount/post</code>
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-6">
                  <div className="d-flex flex-wrap justify-content-lg-end gap-2">
                    <span
                      className={`badge mb-0 ${
                        sessionStatus === RECOUNT_SESSION_STATUS.COMPLETED
                          ? 'bg-gradient-success'
                          : 'bg-gradient-info'
                      }`}
                    >
                      {sessionStatus === RECOUNT_SESSION_STATUS.COMPLETED
                        ? 'Completed'
                        : 'In progress'}
                    </span>
                    <span className="badge bg-gradient-dark mb-0">
                      {stats.counted}/{stats.total} counted
                    </span>
                    <span className="badge bg-gradient-info mb-0">{stats.pending} pending</span>
                    <span className="badge bg-gradient-warning mb-0">{stats.variance} variance</span>
                  </div>
                </div>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                <div className="btn-group btn-group-sm" role="group" aria-label="Filter lines">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`btn mb-0 ${filter === f.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="input-group input-group-sm" style={{ maxWidth: '260px' }}>
                  <span className="input-group-text text-body">
                    <SearchInputIcon />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search product or SKU…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search recount lines"
                  />
                </div>
                {canUpdate ? (
                  <div className="d-flex flex-wrap gap-2 ms-auto">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mb-0"
                      disabled={savingAll || dirtyIds.length === 0}
                      onClick={saveAllDirty}
                    >
                      {savingAll ? 'Saving…' : `Save counts${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-success mb-0"
                      disabled={
                        posting ||
                        dirtyIds.length > 0 ||
                        sessionStatus === RECOUNT_SESSION_STATUS.COMPLETED
                      }
                      onClick={handlePost}
                    >
                      {posting
                        ? 'Posting…'
                        : sessionStatus === RECOUNT_SESSION_STATUS.COMPLETED
                          ? 'Completed'
                          : 'Post adjustments'}
                    </button>
                  </div>
                ) : null}
              </div>
              {postedSummary?.posted != null ? (
                <p className="text-xs text-success mb-0 mt-2">
                  Last post: {postedSummary.posted} applied
                  {postedSummary.skipped ? `, ${postedSummary.skipped} skipped` : ''}.
                </p>
              ) : null}
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              {status === 'loading' ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading…</span>
                  </div>
                  <p className="text-sm text-muted mt-3 mb-0">Loading recount lines…</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger mx-3 mt-3" role="alert">
                  {error}
                  <div className="mt-2">
                    <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={loadSession}>
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="list-data-table mx-3 mb-3">
                  <div className="list-data-table-scroll">
                    <table className="table align-items-center mb-0">
                      <thead>
                        <tr>
                          <th className="text-center list-col-sno">#</th>
                          <th>Product</th>
                          <th className="text-end">System qty</th>
                          <th style={{ minWidth: '140px' }}>Counted qty</th>
                          <th className="text-end">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLines.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-5 text-muted">
                              {lines.length === 0
                                ? 'No lines in this recount session.'
                                : 'No products match this filter.'}
                            </td>
                          </tr>
                        ) : (
                          visibleLines.map((row, index) => {
                            const rowId = String(row._id || row.id || index);
                            const sku = getProductSku(row);
                            const system = roundQty(row.system_qty);
                            const draft = drafts[rowId] ?? '';
                            const counted = draft === '' || draft === '-' || draft === '.' ? null : roundQty(draft);
                            const variance =
                              counted == null || system == null ? null : roundQty(counted - system);
                            const isSaving = Boolean(savingIds[rowId]);
                            return (
                              <tr key={rowId}>
                                <td className="text-center text-muted text-sm">{index + 1}</td>
                                <td className="text-sm font-weight-bold text-dark">
                                  {getProductLabel(row)}
                                  {sku ? (
                                    <div className="text-xs text-muted font-weight-normal">{sku}</div>
                                  ) : null}
                                </td>
                                <td className="text-sm text-end">{formatQty(system)}</td>
                                <td>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="form-control form-control-sm stock-recount-qty-input"
                                    value={draft}
                                    disabled={!canUpdate || isSaving || posting}
                                    placeholder="—"
                                    aria-label={`Counted qty for ${getProductLabel(row)}`}
                                    onChange={(e) => handleDraftChange(rowId, e.target.value)}
                                    onBlur={() => {
                                      if (dirty[rowId]) saveRow(row);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                      }
                                    }}
                                  />
                                </td>
                                <td className={`text-sm text-end font-weight-bold ${varianceClass(variance)}`}>
                                  {variance == null ? '—' : formatQty(variance)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockRecountSession;
