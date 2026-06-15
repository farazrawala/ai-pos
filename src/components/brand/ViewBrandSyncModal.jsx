import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { fetchIntegrationsRequest } from '../../features/integration/integrationAPI.js';
import { createBulkSyncBrandProcessRequest } from '../../features/process/processAPI.js';
import {
  fetchSyncBrandsRequest,
  updateSyncBrandRequest,
} from '../../features/syncBrand/syncBrandAPI.js';

const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

const integrationOptionLabel = (item) => {
  const name = item?.name || 'Integration';
  const storeType = item?.store_type || item?.storeType || '';
  return storeType ? `${name} (${storeType})` : name;
};

const decodeHtml = (value) => {
  if (!value) return '';
  if (typeof document === 'undefined') return String(value);
  const el = document.createElement('textarea');
  el.innerHTML = String(value);
  return el.value;
};

const recordName = (record) => {
  if (!record) return '-';
  if (typeof record === 'object') {
    return decodeHtml(record.name || record.brand_name || '-');
  }
  return String(record);
};

const integrationLabel = (integration) => {
  if (!integration || typeof integration !== 'object') return '-';
  const name = integration.name || 'Integration';
  const storeType = integration.store_type || integration.storeType || '';
  return storeType ? `${name} (${storeType})` : name;
};

const syncIdFromRecord = (item) => item?._id || item?.id || '';

const isSyncActive = (item) => String(item?.status || '').toLowerCase() === 'active';

export default function ViewBrandSyncModal({ open, brandId, brandName, onClose }) {
  const [list, setList] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [togglingSyncId, setTogglingSyncId] = useState(null);
  const [toggleError, setToggleError] = useState(null);

  const [integrations, setIntegrations] = useState([]);
  const [integrationsStatus, setIntegrationsStatus] = useState('idle');
  const [integrationsError, setIntegrationsError] = useState(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(null);

  const loadSyncRecords = useCallback(() => {
    if (!brandId) return undefined;

    let cancelled = false;
    setLoadStatus('loading');
    setError(null);
    setToggleError(null);

    fetchSyncBrandsRequest({
      brand_id: brandId,
      populate: 'brand_id,integration_id',
    })
      .then((result) => {
        if (cancelled) return;
        setList(Array.isArray(result?.data) ? result.data : []);
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        if (!cancelled) {
          setList([]);
          setLoadStatus('failed');
          setError(err?.message || 'Failed to load brand sync records');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  useEffect(() => {
    if (!open || !brandId) return undefined;
    setList([]);
    return loadSyncRecords();
  }, [open, brandId, loadSyncRecords]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setIntegrationsStatus('loading');
    setIntegrationsError(null);
    setSyncStatus('idle');
    setSyncError(null);
    setSyncSuccess(null);
    setSelectedIntegrationId('');

    fetchIntegrationsRequest()
      .then((result) => {
        if (cancelled) return;
        const integrationList = Array.isArray(result?.data) ? result.data : [];
        setIntegrations(integrationList);
        setIntegrationsStatus('succeeded');
        if (integrationList.length === 1) {
          setSelectedIntegrationId(integrationIdFromRecord(integrationList[0]));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIntegrations([]);
          setIntegrationsStatus('failed');
          setIntegrationsError(err?.message || 'Failed to load integrations');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSyncBrand = async () => {
    if (!brandId) {
      setSyncError('Brand id is missing.');
      return;
    }
    if (!selectedIntegrationId) {
      setSyncError('Please select an integration.');
      return;
    }

    setSyncStatus('loading');
    setSyncError(null);
    setSyncSuccess(null);

    try {
      await createBulkSyncBrandProcessRequest(selectedIntegrationId, [brandId]);
      setSyncStatus('succeeded');
      setSyncSuccess('Brand sync process queued successfully.');
      loadSyncRecords();
    } catch (err) {
      setSyncStatus('failed');
      setSyncError(err?.message || 'Failed to queue brand sync process');
      console.error('[Sync brand module] Failed to queue single brand sync', {
        brandId,
        integrationId: selectedIntegrationId,
        error: err,
      });
    }
  };

  const handleToggleStatus = async (syncId, isCurrentlyActive) => {
    if (!syncId) return;

    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    setTogglingSyncId(syncId);
    setToggleError(null);

    try {
      await updateSyncBrandRequest(syncId, { status: newStatus });
      setList((prev) =>
        prev.map((item) =>
          syncIdFromRecord(item) === syncId ? { ...item, status: newStatus } : item
        )
      );
    } catch (err) {
      setToggleError(err?.message || 'Failed to update sync status');
      console.error('[Sync brand module] Failed to toggle sync status', { syncId, error: err });
    } finally {
      setTogglingSyncId(null);
    }
  };

  if (!open) return null;

  const title = brandName ? decodeHtml(brandName) : 'Brand';

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="viewBrandSyncModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="viewBrandSyncModalLabel">
                Brand Sync — {title}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="card border mb-4">
                <div className="card-body py-3">
                  <h6 className="mb-2">Sync this brand</h6>
                  <p className="text-sm text-muted mb-3">
                    Push only this brand to the selected store integration.
                  </p>

                  {integrationsStatus === 'loading' && (
                    <div className="text-muted text-sm">
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Loading integrations…
                    </div>
                  )}

                  {integrationsStatus === 'failed' && (
                    <div className="alert alert-danger py-2 mb-0">{integrationsError}</div>
                  )}

                  {integrationsStatus === 'succeeded' && integrations.length === 0 && (
                    <div className="alert alert-warning py-2 mb-0">
                      No active integrations found. Add one under Integrations first.
                    </div>
                  )}

                  {integrationsStatus === 'succeeded' && integrations.length > 0 && (
                    <div className="row g-2 align-items-end">
                      <div className="col-md-8">
                        <label htmlFor="viewBrandSyncIntegration" className="form-label mb-1">
                          Integration <span className="text-danger">*</span>
                        </label>
                        <select
                          id="viewBrandSyncIntegration"
                          className="form-select"
                          value={selectedIntegrationId}
                          onChange={(e) => {
                            setSelectedIntegrationId(e.target.value);
                            if (syncError) setSyncError(null);
                            if (syncSuccess) setSyncSuccess(null);
                          }}
                          disabled={syncStatus === 'loading'}
                        >
                          <option value="">Select integration…</option>
                          {integrations.map((item) => {
                            const id = integrationIdFromRecord(item);
                            return (
                              <option key={id} value={id}>
                                {integrationOptionLabel(item)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <button
                          type="button"
                          className="btn btn-primary w-100 mb-0"
                          onClick={handleSyncBrand}
                          disabled={
                            syncStatus === 'loading' ||
                            !selectedIntegrationId ||
                            !brandId
                          }
                        >
                          {syncStatus === 'loading' ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                                aria-hidden="true"
                              />
                              Syncing…
                            </>
                          ) : (
                            'Sync'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {syncError && <div className="alert alert-danger py-2 mt-3 mb-0">{syncError}</div>}
                  {syncSuccess && (
                    <div className="alert alert-success py-2 mt-3 mb-0">{syncSuccess}</div>
                  )}
                </div>
              </div>

              {toggleError ? (
                <div className="alert alert-danger py-2 mb-3">{toggleError}</div>
              ) : null}

              {loadStatus === 'loading' && (
                <div className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading sync records…
                </div>
              )}

              {loadStatus === 'failed' && (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              )}

              {loadStatus === 'succeeded' && list.length === 0 && (
                <div className="alert alert-warning py-2 mb-0">
                  No sync records found for this brand.
                </div>
              )}

              {loadStatus === 'succeeded' && list.length > 0 && (
                <div className="table-responsive">
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th>Integration</th>
                        <th>Reference ID</th>
                        <th>Brand</th>
                        <th>Status</th>
                        <th>Synced At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item, index) => {
                        const rowId = syncIdFromRecord(item);
                        const active = isSyncActive(item);
                        return (
                          <tr key={rowId || index}>
                            <td className="text-sm">{integrationLabel(item.integration_id)}</td>
                            <td className="text-sm">
                              {item.refference_id ?? item.reference_id ?? '-'}
                            </td>
                            <td className="text-sm">{recordName(item.brand_id)}</td>
                            <td className="text-sm">
                              <div className="d-flex align-items-center gap-2">
                                <div className="form-check form-switch mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`sync-toggle-${rowId || index}`}
                                    checked={active}
                                    onChange={() => handleToggleStatus(rowId, active)}
                                    disabled={!rowId || togglingSyncId === rowId}
                                    style={{
                                      width: '2.5rem',
                                      height: '1.25rem',
                                      cursor: togglingSyncId === rowId ? 'not-allowed' : 'pointer',
                                    }}
                                  />
                                </div>
                                {togglingSyncId === rowId ? (
                                  <span
                                    className="spinner-border spinner-border-sm text-primary"
                                    role="status"
                                    style={{ width: '1rem', height: '1rem' }}
                                  >
                                    <span className="visually-hidden">Loading...</span>
                                  </span>
                                ) : (
                                  <span
                                    className={`badge ${active ? 'bg-success' : 'bg-secondary'}`}
                                  >
                                    {active ? 'Active' : 'Inactive'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-sm">
                              {item.createdAt
                                ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary mb-0" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}
