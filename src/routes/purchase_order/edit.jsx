import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchPurchaseOrderById,
  updatePurchaseOrder,
  clearCurrentPurchaseOrder,
  clearUpdateStatus,
} from '../../features/purchaseOrders/purchaseOrdersSlice.js';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
} from '../../features/users/usersAPI.js';
import { PO_STATUS_OPTIONS } from './poFormConstants.js';

const recordToForm = (po) => ({
  purchase_order_no:
    po?.purchase_order_no ?? po?.po_no ?? po?.order_no ?? po?.reference ?? '',
  supplier_id:
    po?.supplier_id != null
      ? String(po.supplier_id)
      : po?.supplier && typeof po.supplier === 'object' && po.supplier._id != null
        ? String(po.supplier._id)
        : '',
  order_status:
    po?.order_status ?? po?.status ?? po?.purchase_order_status ?? po?.po_status ?? 'placed',
  notes: po?.notes ?? po?.remarks ?? po?.description ?? '',
  expected_delivery_date: (() => {
    const raw = po?.expected_delivery_date ?? po?.expectedDeliveryDate ?? '';
    if (!raw) return '';
    const s = String(raw);
    return s.length >= 10 ? s.slice(0, 10) : s;
  })(),
});

const PurchaseOrderEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentPurchaseOrder, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.purchaseOrders
  );
  const [form, setForm] = useState(recordToForm(null));
  const [errors, setErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    let cancelled = false;
    setUsersStatus('loading');
    setUsersError(null);
    (async () => {
      try {
        const list = await fetchUsersListRequest({ limit: 2000, skip: 0 });
        const arr = Array.isArray(list) ? list : [];
        if (!cancelled) {
          setUsers(arr);
          setUsersStatus('succeeded');
        }
      } catch (err) {
        console.error('[Purchase order edit] Failed to load users for supplier dropdown', err);
        if (!cancelled) {
          setUsers([]);
          setUsersError(err?.message || 'Could not load users');
          setUsersStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (id) dispatch(fetchPurchaseOrderById(id));
    return () => {
      dispatch(clearCurrentPurchaseOrder());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (currentPurchaseOrder) {
      setForm(recordToForm(currentPurchaseOrder));
    }
  }, [currentPurchaseOrder]);

  const supplierOptions = [...users]
    .filter((u) => getUserOptionValue(u))
    .sort((a, b) => formatUserOptionLabel(a).localeCompare(formatUserOptionLabel(b)));

  const supplierIdInList =
    !form.supplier_id ||
    supplierOptions.some((u) => getUserOptionValue(u) === String(form.supplier_id));

  const buildPayload = () => {
    const payload = {
      purchase_order_no: form.purchase_order_no.trim(),
      supplier_id: form.supplier_id.trim() || undefined,
      order_status: form.order_status || 'placed',
      notes: form.notes.trim() || undefined,
    };
    if (form.expected_delivery_date) {
      payload.expected_delivery_date = form.expected_delivery_date;
    }
    return Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined && v !== '')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id) return;
    setErrors({});
    try {
      await dispatch(
        updatePurchaseOrder({ purchaseOrderId: id, purchaseOrderData: buildPayload() })
      ).unwrap();
      navigate('/purchase-orders');
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err?.message || String(err) || 'Failed to update purchase order',
      }));
    }
  };

  if (fetchStatus === 'loading') {
    return (
      <div className="container-fluid py-4">
        <p className="text-muted mb-0">Loading purchase order…</p>
      </div>
    );
  }
  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger" role="alert">
          {fetchError || 'Failed to load purchase order.'}
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/purchase-orders')}>
          Back to list
        </button>
      </div>
    );
  }

  const supplierSelectDisabled = isSubmitting || usersStatus === 'loading';

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit purchase order</h5>
                  <p className="text-sm text-muted mb-0">
                    <code>PATCH /purchase_order/update/{id}</code>
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/purchase-orders')}
                >
                  Back to list
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {updateError ? (
                <div className="alert alert-warning py-2" role="alert">
                  {updateError}
                </div>
              ) : null}
              <form onSubmit={handleSubmit}>
                {errors.submit ? (
                  <div className="alert alert-danger py-2" role="alert">
                    {errors.submit}
                  </div>
                ) : null}
                <div className="mb-3">
                  <label className="form-label">Reference / PO no.</label>
                  <input
                    className={`form-control ${errors.purchase_order_no ? 'is-invalid' : ''}`}
                    value={form.purchase_order_no}
                    readOnly
                    disabled={isSubmitting}
                  />
                  {errors.purchase_order_no ? (
                    <div className="invalid-feedback">{errors.purchase_order_no}</div>
                  ) : null}
                </div>
                <div className="mb-3">
                  <label className="form-label">Supplier</label>
                  {usersStatus === 'failed' && usersError ? (
                    <div className="alert alert-warning py-2 mb-2" role="alert">
                      {usersError}
                    </div>
                  ) : null}
                  <select
                    className="form-select"
                    value={form.supplier_id}
                    onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                    disabled={supplierSelectDisabled}
                  >
                    <option value="">No supplier</option>
                    {!supplierIdInList && form.supplier_id ? (
                      <option value={form.supplier_id}>Supplier id: {form.supplier_id}</option>
                    ) : null}
                    {supplierOptions.map((u) => {
                      const value = getUserOptionValue(u);
                      return (
                        <option key={value} value={value}>
                          {formatUserOptionLabel(u)}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.order_status}
                    onChange={(e) => setForm((p) => ({ ...p, order_status: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    {form.order_status && !PO_STATUS_OPTIONS.includes(form.order_status) ? (
                      <option value={form.order_status}>{form.order_status}</option>
                    ) : null}
                    {PO_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Expected delivery</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.expected_delivery_date}
                    onChange={(e) => setForm((p) => ({ ...p, expected_delivery_date: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={isSubmitting}
                    onClick={() => navigate('/purchase-orders')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderEdit;
