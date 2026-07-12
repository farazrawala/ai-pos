import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createCourier } from '../../features/courier/courierSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';

const COURIER_TYPES = [
  { value: 'tcs', label: 'TCS' },
  { value: 'leopard', label: 'Leopard' },
];

const CourierIntegrationAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canCreate } = usePermissions('courier-integration');
  const [form, setForm] = useState({
    type: 'tcs',
    url: '',
    login: '',
    password: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (canCreate === false) navigate('/courier-integration');
  }, [canCreate, navigate]);

  const validateForm = () => {
    const nextErrors = {};
    if (!form.type) nextErrors.type = 'Courier type is required';
    if (!form.url.trim()) nextErrors.url = 'API URL is required';
    if (!form.login.trim()) nextErrors.login = 'Login is required';
    if (!form.password.trim()) nextErrors.password = 'Password is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await dispatch(
        createCourier({
          type: form.type,
          url: form.url.trim(),
          login: form.login.trim(),
          password: form.password,
          status: form.status,
        })
      ).unwrap();
      toast.success('Courier integration created.');
      navigate('/courier-integration');
    } catch (error) {
      const message = error?.message || error || 'Failed to create courier integration';
      setErrors((prev) => ({ ...prev, submit: message }));
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add Courier Integration</h5>
                  <p className="text-sm mb-0">Connect TCS or Leopard courier API credentials.</p>
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
                  <label className="form-label" htmlFor="courier-type">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select
                    id="courier-type"
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
                  <label className="form-label" htmlFor="courier-url">
                    API URL <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-url"
                    type="url"
                    className={`form-control ${errors.url ? 'is-invalid' : ''}`}
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                    disabled={isSubmitting}
                  />
                  {errors.url && <div className="invalid-feedback">{errors.url}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-login">
                    Login <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-login"
                    className={`form-control ${errors.login ? 'is-invalid' : ''}`}
                    value={form.login}
                    onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
                    disabled={isSubmitting}
                    autoComplete="username"
                  />
                  {errors.login && <div className="invalid-feedback">{errors.login}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="courier-password">
                    Password <span className="text-danger">*</span>
                  </label>
                  <input
                    id="courier-password"
                    type="password"
                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                </div>
                <div className="mb-4">
                  <label className="form-label" htmlFor="courier-status">
                    Status
                  </label>
                  <select
                    id="courier-status"
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {errors.submit && <div className="alert alert-danger py-2">{errors.submit}</div>}
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
                    {isSubmitting ? 'Saving…' : 'Create'}
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

export default CourierIntegrationAdd;
