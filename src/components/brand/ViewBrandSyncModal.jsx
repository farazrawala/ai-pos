import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import {
  fetchSyncBrandsRequest,
  updateSyncBrandRequest,
} from '../../features/syncBrand/syncBrandAPI.js';

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
                                      cursor:
                                        togglingSyncId === rowId ? 'not-allowed' : 'pointer',
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
