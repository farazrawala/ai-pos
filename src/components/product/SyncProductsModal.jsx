import { useEffect, useState } from 'react';
import { fetchIntegrationsRequest } from '../../features/integration/integrationAPI.js';
import { fetchProductsRequest } from '../../features/products/productsAPI.js';
import { createBulkSyncProductProcessRequest } from '../../features/process/processAPI.js';

const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

const productIdFromRecord = (item) => item?._id || item?.id || item?.product_id || '';

const integrationLabel = (item) => {
  const name = item?.name || 'Integration';
  const storeType = item?.store_type || item?.storeType || '';
  return storeType ? `${name} (${storeType})` : name;
};

export default function SyncProductsModal({ open, onClose, onSaved }) {
  const [integrations, setIntegrations] = useState([]);
  const [integrationsStatus, setIntegrationsStatus] = useState('idle');
  const [integrationsError, setIntegrationsError] = useState(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setIntegrationsStatus('loading');
    setIntegrationsError(null);
    setSaveError(null);
    setSaveStatus('idle');
    setSelectedIntegrationId('');

    fetchIntegrationsRequest()
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result?.data) ? result.data : [];
        setIntegrations(list);
        setIntegrationsStatus('succeeded');
        if (list.length === 1) {
          setSelectedIntegrationId(integrationIdFromRecord(list[0]));
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

  const handleSave = async () => {
    if (!selectedIntegrationId) {
      setSaveError('Please select an integration.');
      return;
    }

    setSaveStatus('loading');
    setSaveError(null);

    try {
      const productsResult = await fetchProductsRequest({ page: 1, limit: 5000 });
      const productIds = (productsResult?.data || []).map(productIdFromRecord).filter(Boolean);

      if (productIds.length === 0) {
        setSaveStatus('failed');
        setSaveError('No products found to sync.');
        return;
      }

      await createBulkSyncProductProcessRequest(selectedIntegrationId, productIds);
      setSaveStatus('succeeded');
      onSaved?.();
      onClose?.();
    } catch (err) {
      setSaveStatus('failed');
      setSaveError(err?.message || 'Failed to queue product sync processes');
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === 'loading';

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="syncProductsModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="syncProductsModalLabel">
                Sync Products
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isSaving}
              />
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted mb-3">
                Select a store integration to push your POS products to WooCommerce or another
                connected platform.
              </p>

              {integrationsStatus === 'loading' && (
                <div className="text-center py-3 text-muted">
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
                <div className="mb-0">
                  <label htmlFor="syncProductsIntegration" className="form-label">
                    Integration <span className="text-danger">*</span>
                  </label>
                  <select
                    id="syncProductsIntegration"
                    className="form-select"
                    value={selectedIntegrationId}
                    onChange={(e) => {
                      setSelectedIntegrationId(e.target.value);
                      if (saveError) setSaveError(null);
                    }}
                    disabled={isSaving}
                  >
                    <option value="">Select integration…</option>
                    {integrations.map((item) => {
                      const id = integrationIdFromRecord(item);
                      return (
                        <option key={id} value={id}>
                          {integrationLabel(item)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {saveError && <div className="alert alert-danger py-2 mt-3 mb-0">{saveError}</div>}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary mb-0"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary mb-0"
                onClick={handleSave}
                disabled={
                  isSaving || integrationsStatus !== 'succeeded' || integrations.length === 0
                }
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={isSaving ? undefined : onClose} aria-hidden="true" />
    </>
  );
}
