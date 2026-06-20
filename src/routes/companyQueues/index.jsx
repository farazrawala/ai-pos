import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearCompanyQueueModule,
  fetchCompanyQueueModule,
  fetchCompanyQueues,
} from '../../features/company/companyAPI.js';
import { executeProcessRequest } from '../../features/process/processAPI.js';
import ListDataTable from '../../components/list/ListDataTable.jsx';

const DEFAULT_MODULE = 'process';

const EMPTY_META = {
  company_id: null,
  module: DEFAULT_MODULE,
  queue_key: null,
  length: 0,
  queue_enabled: false,
  memory_fallback: false,
};

function formatScore(score) {
  if (score == null || score === '') return '—';
  const n = Number(score);
  return Number.isFinite(n) ? String(n) : String(score);
}

const CompanyQueuesPage = () => {
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [executingJobId, setExecutingJobId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [module, setModule] = useState(DEFAULT_MODULE);
  const [moduleOptions, setModuleOptions] = useState([DEFAULT_MODULE]);
  const [meta, setMeta] = useState({ ...EMPTY_META });
  const [pending, setPending] = useState([]);

  const loadQueue = useCallback(async (selectedModule = module) => {
    const mod = String(selectedModule || DEFAULT_MODULE).trim() || DEFAULT_MODULE;
    setLoading(true);
    setError(null);
    setMessage('');

    try {
      let overview = null;
      try {
        overview = await fetchCompanyQueues();
        const mods = (overview.queues || [])
          .map((q) => q.module)
          .filter(Boolean);
        const nextOptions = [...new Set([DEFAULT_MODULE, ...mods])].sort();
        setModuleOptions(nextOptions);
      } catch {
        setModuleOptions([DEFAULT_MODULE, mod]);
      }

      const data = await fetchCompanyQueueModule(mod);
      setMeta({
        company_id: data.company_id ?? overview?.company_id ?? null,
        module: data.module ?? mod,
        queue_key: data.queue_key ?? null,
        length: data.length ?? 0,
        queue_enabled: Boolean(data.queue_enabled ?? overview?.queue_enabled),
        memory_fallback: Boolean(overview?.memory_fallback),
      });
      setPending(Array.isArray(data.pending) ? data.pending : []);
      if (typeof data.message === 'string') setMessage(data.message);
      else if (typeof overview?.message === 'string') setMessage(overview.message);
    } catch (err) {
      const exactError = err?.message || String(err) || 'Failed to load queue';
      const statusSuffix = err?.status ? ` (HTTP ${err.status})` : '';
      setError(`${exactError}${statusSuffix}`);
      setPending([]);
      setMeta({ ...EMPTY_META, module: mod });
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    loadQueue(module);
  }, [loadQueue, module]);

  const handleClearQueue = async () => {
    if (
      !window.confirm(
        `Clear all pending jobs in the "${meta.module}" queue? Process rows stay in the database but will no longer run in order from Redis.`
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      const data = await clearCompanyQueueModule(meta.module || module);
      if (typeof data?.message === 'string') setMessage(data.message);
      await loadQueue(meta.module || module);
    } catch (err) {
      const exactError = err?.message || String(err) || 'Failed to clear queue';
      const statusSuffix = err?.status ? ` (HTTP ${err.status})` : '';
      setError(`${exactError}${statusSuffix}`);
    } finally {
      setClearing(false);
    }
  };

  const handleExecuteJob = async (jobId) => {
    if (!jobId) return;
    setExecutingJobId(jobId);
    setError(null);
    try {
      await executeProcessRequest(jobId);
      setMessage(`Executed process ${jobId}`);
      await loadQueue(meta.module || module);
    } catch (err) {
      setError(err?.message || 'Failed to execute process');
    } finally {
      setExecutingJobId(null);
    }
  };

  const showExecute = meta.module === 'process';

  const moduleSelect = useMemo(
    () => (
      <select
        id="company-queue-module"
        className="form-select form-select-sm"
        style={{ maxWidth: '200px' }}
        value={module}
        onChange={(e) => setModule(e.target.value)}
        disabled={loading || clearing}
      >
        {moduleOptions.map((mod) => (
          <option key={mod} value={mod}>
            {mod}
          </option>
        ))}
      </select>
    ),
    [module, moduleOptions, loading, clearing]
  );

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm" style={{ maxWidth: '100%' }}>
            <div className="card-header pb-0">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <h5 className="mb-0">Company queues</h5>
                  <p className="text-sm mb-0 text-muted">
                    Redis job queues per module (`{'{companyId}:{module}'}`). Process jobs are
                    process record ids waiting for execute-process.
                  </p>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0 flex-wrap">
                    <label className="text-sm mb-0" htmlFor="company-queue-module">
                      Module
                    </label>
                    {moduleSelect}
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm mb-0"
                      onClick={() => loadQueue(module)}
                      disabled={loading || clearing}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="btn btn-warning btn-sm mb-0"
                      onClick={handleClearQueue}
                      disabled={loading || clearing || meta.length === 0}
                    >
                      {clearing ? 'Clearing…' : 'Clear queue'}
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
                    <p className="text-xs text-muted mb-1">Pending jobs</p>
                    <p className="h5 mb-0">{meta.length}</p>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Queue enabled</p>
                    <p className="text-sm mb-0">
                      {meta.queue_enabled ?
                        <span className="badge bg-success">Yes</span>
                      : <span className="badge bg-secondary">No</span>}
                    </p>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Memory fallback</p>
                    <p className="text-sm mb-0">
                      {meta.memory_fallback ?
                        <span className="badge bg-info">Active</span>
                      : <span className="badge bg-secondary">Off</span>}
                    </p>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="border border-radius-md p-3 h-100">
                    <p className="text-xs text-muted mb-1">Module</p>
                    <p className="h6 mb-0 text-break">{meta.module || '—'}</p>
                  </div>
                </div>
              </div>
              {meta.company_id ? (
                <p className="text-xs text-muted mb-3">
                  Company: <code>{meta.company_id}</code>
                  {meta.queue_key ? (
                    <>
                      {' '}
                      · Queue key: <code>{meta.queue_key}</code>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="card-body pt-0 px-0 pb-0">
              {!error || loading ? (
                <ListDataTable
                  loading={loading}
                  loadingLabel="Loading queue…"
                  pagination={{
                    total: pending.length,
                    page: 1,
                    limit: pending.length || 1,
                    totalPages: 1,
                  }}
                  showPagination={false}
                >
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Job id</th>
                        <th>Score (priority)</th>
                        {showExecute ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {pending.length === 0 ? (
                        <tr>
                          <td
                            colSpan={showExecute ? 4 : 3}
                            className="text-center text-sm font-weight-normal p-4"
                          >
                            No pending jobs in this queue
                          </td>
                        </tr>
                      ) : (
                        pending.map((row, index) => (
                          <tr key={row.jobId || index}>
                            <td className="text-sm font-weight-normal">{row.rank ?? index + 1}</td>
                            <td className="text-sm font-weight-normal text-break">
                              {row.jobId ?
                                showExecute ?
                                  <Link to="/processes" className="text-dark" title={row.jobId}>
                                    <code className="text-xs">{row.jobId}</code>
                                  </Link>
                                : <code className="text-xs">{row.jobId}</code>
                              : '—'}
                            </td>
                            <td className="text-sm font-weight-normal">{formatScore(row.score)}</td>
                            {showExecute ? (
                              <td className="text-sm font-weight-normal">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary mb-0"
                                  onClick={() => handleExecuteJob(row.jobId)}
                                  disabled={!row.jobId || executingJobId === row.jobId}
                                >
                                  {executingJobId === row.jobId ? 'Running…' : 'Execute'}
                                </button>
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

export default CompanyQueuesPage;
