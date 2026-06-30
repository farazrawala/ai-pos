import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import {
  fetchCompanyListCache,
  normalizeCompanyCacheEntries,
  removeCompanyCacheRequest,
} from '../../features/company/companyAPI.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';

/** Seconds left → e.g. `2 hr 5 min 30 sec` (moment duration). */
function formatTtlRemaining(seconds, { expired = false } = {}) {
  if (expired) return '0 sec';
  if (seconds == null || seconds === '') return '—';
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '—';

  const d = moment.duration(Math.floor(total), 'seconds');
  const hours = Math.floor(d.asHours());
  const mins = d.minutes();
  const secs = d.seconds();

  const parts = [];
  if (hours > 0) parts.push(`${hours} hr`);
  if (mins > 0) parts.push(`${mins} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} sec`);
  return parts.join(' ');
}

function formatValueSummary(summary) {
  if (summary == null) return '—';
  if (typeof summary !== 'object') return String(summary);
  const parts = [];
  if (summary.success != null) parts.push(`success: ${summary.success}`);
  if (summary.status != null) parts.push(`status: ${summary.status}`);
  if (summary.count != null) parts.push(`count: ${summary.count}`);
  if (summary.data_count != null) parts.push(`rows: ${summary.data_count}`);
  if (summary.fromCache != null) parts.push(`fromCache: ${summary.fromCache}`);
  return parts.length > 0 ? parts.join(', ') : JSON.stringify(summary);
}

const EMPTY_META = {
  company_id: null,
  pattern: null,
  count: 0,
  memory_count: 0,
  redis_count: 0,
  redis_enabled: false,
  redis_connected: false,
};

const CompanyCachePage = () => {
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [includeValues, setIncludeValues] = useState(false);
  const [meta, setMeta] = useState({ ...EMPTY_META });
  const [entries, setEntries] = useState([]);

  const loadCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      const data = await fetchCompanyListCache(includeValues);
      setMeta({
        company_id: data.company_id ?? null,
        pattern: data.pattern ?? null,
        count: data.count ?? 0,
        memory_count: data.memory_count ?? 0,
        redis_count: data.redis_count ?? 0,
        redis_enabled: Boolean(data.redis_enabled),
        redis_connected: Boolean(data.redis_connected),
      });
      setEntries(normalizeCompanyCacheEntries(data.entries));
      if (typeof data.message === 'string') setMessage(data.message);
    } catch (err) {
      const exactError = err?.message || String(err) || 'Failed to load cache';
      const statusSuffix = err?.status ? ` (HTTP ${err.status})` : '';
      setError(`${exactError}${statusSuffix}`);
      setEntries([]);
      setMeta({ ...EMPTY_META });
    } finally {
      setLoading(false);
    }
  }, [includeValues]);

  useEffect(() => {
    loadCache();
  }, [loadCache]);

  const handleClearCache = async () => {
    if (
      !window.confirm(
        'Clear all list-cache entries for your company? List APIs will refetch from the database on next request.'
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      const data = await removeCompanyCacheRequest();
      if (typeof data?.message === 'string') setMessage(data.message);
      await loadCache();
    } catch (err) {
      const exactError = err?.message || String(err) || 'Failed to clear cache';
      const statusSuffix = err?.status ? ` (HTTP ${err.status})` : '';
      setError(`${exactError}${statusSuffix}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Company cache</h5>
                  <p className="text-sm mb-0 text-muted">
                    List-cache keys for your company (Redis and in-memory fallback).
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="include-cache-values"
                        checked={includeValues}
                        onChange={(e) => setIncludeValues(e.target.checked)}
                        disabled={loading || clearing}
                      />
                      <label className="form-check-label text-sm" htmlFor="include-cache-values">
                        Include value summary
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm mb-0"
                      onClick={loadCache}
                      disabled={loading || clearing}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="btn btn-warning btn-sm mb-0"
                      onClick={handleClearCache}
                      disabled={loading || clearing}
                    >
                      {clearing ? 'Clearing…' : 'Clear cache'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body pt-3">
              {error ? (
                <div className="alert alert-danger text-sm py-2 mb-3" role="alert">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="alert alert-info text-sm py-2 mb-3" role="status">
                  {message}
                </div>
              ) : null}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Total entries</p>
                    <p className="h5 mb-0">{meta.count}</p>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Memory</p>
                    <p className="h5 mb-0">{meta.memory_count}</p>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Redis</p>
                    <p className="h5 mb-0">{meta.redis_count}</p>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Redis status</p>
                    <p className="text-sm mb-0">
                      {meta.redis_enabled ? (
                        meta.redis_connected ? (
                          <span className="badge bg-success">Connected</span>
                        ) : (
                          <span className="badge bg-secondary">Not connected</span>
                        )
                      ) : (
                        <span className="badge bg-secondary">Disabled</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {meta.company_id ? (
                <p className="text-xs text-muted mb-3">
                  Company: <code>{meta.company_id}</code>
                  {meta.pattern ? (
                    <>
                      {' '}
                      · Pattern: <code>{meta.pattern}</code>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              {!error || loading ? (
                <ListDataTable
                  loading={loading}
                  loadingLabel="Loading cache entries…"
                  pagination={{
                    total: entries.length,
                    page: 1,
                    limit: entries.length || 1,
                    totalPages: 1,
                  }}
                  showPagination={false}
                >
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Module</th>
                        <th>Action</th>
                        <th>Backend</th>
                        <th>Time left</th>
                        <th>Status</th>
                        <th>Cache key</th>
                        {includeValues ? <th>Value summary</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={includeValues ? 8 : 7}
                            className="text-center text-sm font-weight-normal p-4"
                          >
                            No cache entries for this company
                          </td>
                        </tr>
                      ) : (
                        entries.map((row, index) => (
                          <tr key={row.key || index}>
                            <td className="text-sm font-weight-normal">{index + 1}</td>
                            <td className="text-sm font-weight-normal">{row.module || '—'}</td>
                            <td className="text-sm font-weight-normal">{row.action || '—'}</td>
                            <td className="text-sm font-weight-normal">
                              <span
                                className={`badge ${row.backend === 'redis' ? 'bg-gradient-info' : 'bg-gradient-secondary'}`}
                              >
                                {row.backend || '—'}
                              </span>
                            </td>
                            <td
                              className="text-sm font-weight-normal"
                              title={
                                row.ttl_seconds_remaining != null
                                  ? `${row.ttl_seconds_remaining} sec`
                                  : undefined
                              }
                            >
                              {formatTtlRemaining(row.ttl_seconds_remaining, {
                                expired: row.expired,
                              })}
                            </td>
                            <td className="text-sm font-weight-normal">
                              {row.expired ? (
                                <span className="badge bg-secondary">Expired</span>
                              ) : (
                                <span className="badge bg-success">Active</span>
                              )}
                            </td>
                            <td className="text-sm font-weight-normal text-break">
                              <code className="text-xs" title={row.key}>
                                {row.key != null && row.key !== '' ? String(row.key) : '—'}
                              </code>
                            </td>
                            {includeValues ? (
                              <td className="text-sm font-weight-normal text-break">
                                {formatValueSummary(row.value_summary)}
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </ListDataTable>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyCachePage;
