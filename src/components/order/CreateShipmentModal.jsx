import { useEffect, useState } from 'react';
import {
  createCourierShipmentRequest,
  courierTypeToProvider,
  fetchCouriersRequest,
  pickCourierId,
} from '../../features/courier/courierAPI.js';

const courierLabel = (item) => {
  const name = item?.name?.trim();
  const provider = courierTypeToProvider(item?.type);
  if (name && provider) return `${name} (${provider})`;
  if (name) return name;
  if (provider) return provider;
  return pickCourierId(item) || 'Courier';
};

/**
 * Select a saved courier integration and create a shipment for an order.
 */
export default function CreateShipmentModal({ open, orderId, orderNo, onClose, onSaved }) {
  const [couriers, setCouriers] = useState([]);
  const [couriersStatus, setCouriersStatus] = useState('idle');
  const [couriersError, setCouriersError] = useState(null);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setCouriersStatus('loading');
    setCouriersError(null);
    setSaveError(null);
    setSaveStatus('idle');
    setSelectedCourierId('');
    setCouriers([]);

    fetchCouriersRequest({ limit: 500 })
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result?.data) ? result.data : [];
        setCouriers(list);
        setCouriersStatus('succeeded');
        if (list.length === 1) {
          setSelectedCourierId(String(pickCourierId(list[0])));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCouriers([]);
          setCouriersStatus('failed');
          setCouriersError(err?.message || 'Failed to load courier integrations');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const handleSave = async () => {
    if (!orderId) {
      setSaveError('Missing order id.');
      return;
    }
    const selected = couriers.find(
      (item) => String(pickCourierId(item)) === String(selectedCourierId)
    );
    if (!selected) {
      setSaveError('Please select a courier.');
      return;
    }

    const provider = courierTypeToProvider(selected.type);
    if (!provider) {
      setSaveError('Selected courier is missing a type.');
      return;
    }

    setSaveStatus('loading');
    setSaveError(null);

    try {
      const result = await createCourierShipmentRequest(orderId, {
        provider,
        courierId: pickCourierId(selected),
      });
      if (result?.queued) {
        throw new Error(
          result.message ||
            'Shipment was queued but no tracking id was returned. Check courier credentials and try again.'
        );
      }
      if (!result?.tracking_id && !result?.tracking_number) {
        throw new Error(
          result?.message ||
            result?.error ||
            'Courier booking succeeded without a tracking id. Check the courier API response.'
        );
      }
      setSaveStatus('succeeded');
      onSaved?.({
        orderId,
        provider: result?.courier || provider,
        result,
      });
      onClose?.();
    } catch (err) {
      setSaveStatus('failed');
      setSaveError(err?.message || 'Failed to create shipment');
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === 'loading';
  const isLoadingCouriers = couriersStatus === 'loading';
  const titleOrder = orderNo && orderNo !== '—' ? orderNo : orderId || 'order';

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="createShipmentModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="createShipmentModalLabel">
                Add tracking
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
                Select a courier to create a shipment for order{' '}
                <span className="font-weight-bold text-dark">{titleOrder}</span>.
              </p>

              <div className="mb-0">
                <label htmlFor="createShipmentProvider" className="form-label">
                  Courier <span className="text-danger">*</span>
                </label>
                <select
                  id="createShipmentProvider"
                  className="form-select"
                  value={selectedCourierId}
                  onChange={(e) => {
                    setSelectedCourierId(e.target.value);
                    if (saveError) setSaveError(null);
                  }}
                  disabled={isSaving || isLoadingCouriers || couriers.length === 0}
                >
                  <option value="">
                    {isLoadingCouriers ? 'Loading couriers…' : 'Select courier…'}
                  </option>
                  {couriers.map((item) => {
                    const id = pickCourierId(item);
                    return (
                      <option key={id} value={id}>
                        {courierLabel(item)}
                      </option>
                    );
                  })}
                </select>
                {couriersStatus === 'succeeded' && couriers.length === 0 ? (
                  <p className="text-xs text-muted mb-0 mt-2">
                    No courier integrations found. Add one under Courier Integration first.
                  </p>
                ) : (
                  <p className="text-xs text-muted mb-0 mt-2">
                    Showing your saved courier integrations.
                  </p>
                )}
              </div>

              {couriersError ? (
                <div className="alert alert-danger py-2 mt-3 mb-0">{couriersError}</div>
              ) : null}
              {saveError ? <div className="alert alert-danger py-2 mt-3 mb-0">{saveError}</div> : null}
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
                disabled={isSaving || isLoadingCouriers || !selectedCourierId}
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Creating…
                  </>
                ) : (
                  'Create shipment'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={isSaving ? undefined : onClose}
        aria-hidden="true"
      />
    </>
  );
}
