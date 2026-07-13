import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchCourierById,
  updateCourier,
  clearCurrentCourier,
  clearUpdateStatus,
} from '../../features/courier/courierSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';

const COURIER_TYPES = [
  { value: 'tcs', label: 'TCS' },
  { value: 'leopard', label: 'Leopard' },
];

const CourierIntegrationEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCourier, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.courier
  );
  const { canEdit } = usePermissions('courier-integration');
  const [form, setForm] = useState({
    name: '',
    type: 'tcs',
    url: '',
    login: '',
    password: '',
    token: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    if (canEdit === false) navigate('/courier-integration');
  }, [canEdit, navigate]);

  useEffect(() => {
    if (id) dispatch(fetchCourierById(id));
    return () => {
      dispatch(clearCurrentCourier());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentCourier) return;
    setForm({
      name: currentCourier.name || '',
      type: currentCourier.type || 'tcs',
      url: currentCourier.url || '',
      login: currentCourier.login || '',
      password: '',
      token: '',
      status: currentCourier.status || 'active',
    });
  }, [currentCourier]);

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.type) nextErrors.type = 'Courier type is required';
    if (!form.url.trim()) nextErrors.url = 'API URL is required';
    if (!form.login.trim()) nextErrors.login = 'Login is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      url: form.url.trim(),
      login: form.login.trim(),
      status: form.status,
    };
    if (form.password.trim()) {
      payload.password = form.password;
    }
    if (form.token.trim()) {
      payload.token = form.token.trim();
    }
    try {
      await dispatch(updateCourier({ courierId: id, courierData: payload })).unwrap();
      toast.success('Courier integration updated.');
      navigate('/courier-integration');
    } catch (error) {
      const message = error?.message || error || 'Failed to update courier integration';
      setErrors((prev) => ({ ...prev, submit: message }));
      toast.error(message);
    }
  };

  if (fetchStatus === 'loading') {
    return <div className="container-fluid py-4">Loading courier integration…</div>;
  }
  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">
          {fetchError || 'Failed to load courier integration.'}
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Edit Courier Integration</h5>
                  <p className="text-sm mb-0">Update courier API credentials.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/courier-integration')}
                >
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-name">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-edit-name"
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    placeholder="e.g. TCS Main Account"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={isSubmitting}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-type">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select
                    id="courier-edit-type"
                    className={`form-select ${errors.type ? 'is-invalid' : ''}`}
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    {COURIER_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.type && <div className="invalid-feedback">{errors.type}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-url">
                    API URL <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-edit-url"
                    type="url"
                    className={`form-control ${errors.url ? 'is-invalid' : ''}`}
                    value={form.url}
                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                    disabled={isSubmitting}
                  />
                  {errors.url && <div className="invalid-feedback">{errors.url}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-login">
                    Login <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-edit-login"
                    className={`form-control ${errors.login ? 'is-invalid' : ''}`}
                    value={form.login}
                    onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
                    disabled={isSubmitting}
                    autoComplete="username"
                  />
                  {errors.login && <div className="invalid-feedback">{errors.login}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-password">
                    Password
                  </label>
                  <input
                    id="courier-edit-password"
                    type="password"
                    className="form-control"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current password"
                  />
                  <p className="text-xs text-muted mb-0 mt-1">
                    Leave blank to keep the existing password.
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-edit-token">
                    Token
                  </label>
                  <input
                    id="courier-edit-token"
                    type="password"
                    className="form-control"
                    value={form.token}
                    onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))}
                    disabled={isSubmitting}
                    autoComplete="off"
                    placeholder="Leave blank to keep current token"
                  />
                  <p className="text-xs text-muted mb-0 mt-1">
                    Leave blank to keep the existing token.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="form-label" htmlFor="courier-edit-status">
                    Status
                  </label>
                  <select
                    id="courier-edit-status"
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {(errors.submit || updateError) && (
                  <div className="alert alert-danger py-2">{errors.submit || updateError}</div>
                )}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/courier-integration')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating…' : 'Update'}
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

export default CourierIntegrationEdit;
