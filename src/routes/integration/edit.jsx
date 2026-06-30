import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchIntegrationById,
  updateIntegration,
  clearCurrentIntegration,
  clearUpdateStatus,
} from '../../features/integration/integrationSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import {
  EMPTY_INTEGRATION_FORM,
  STORE_TYPE_OPTIONS,
  buildIntegrationPayload,
  integrationRecordToForm,
  syncIntegrationFormFromDom,
  validateIntegrationForm,
} from './integrationForm.js';

const IntegrationEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentIntegration, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.integration
  );
  const { canEdit } = usePermissions('integration');
  const [form, setForm] = useState({ ...EMPTY_INTEGRATION_FORM });
  const [errors, setErrors] = useState({});
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    if (canEdit === false) navigate('/integration');
  }, [canEdit, navigate]);

  useEffect(() => {
    if (id) dispatch(fetchIntegrationById(id));
    return () => {
      dispatch(clearCurrentIntegration());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (!currentIntegration) return;
    setForm(integrationRecordToForm(currentIntegration));
  }, [currentIntegration]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const syncedForm = syncIntegrationFormFromDom(form, e.currentTarget);
    setForm(syncedForm);
    const nextErrors = validateIntegrationForm(syncedForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await dispatch(
        updateIntegration({
          integrationId: id,
          integrationData: buildIntegrationPayload(syncedForm),
        })
      ).unwrap();
      navigate('/integration');
    } catch (error) {
      const message =
        typeof error === 'string' ? error : error?.message || 'Failed to update integration';
      console.error('[Integration module] Edit integration form submit failed', { message, error });
      setErrors((prev) => ({ ...prev, submit: message }));
    }
  };

  if (fetchStatus === 'loading') {
    return <div className="container-fluid py-4">Loading integration...</div>;
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">{fetchError || 'Failed to load integration.'}</div>
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
                  <h5 className="mb-0">Edit Integration</h5>
                  <p className="text-sm mb-0">Update store connection settings.</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/integration')}
                >
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="store_type" className="form-label">
                    Store type <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.store_type ? 'is-invalid' : ''}`}
                    id="store_type"
                    name="store_type"
                    value={form.store_type}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  >
                    {STORE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.store_type && <div className="invalid-feedback">{errors.store_type}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="address" className="form-label">
                    Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.address ? 'is-invalid' : ''}`}
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  {errors.address && <div className="invalid-feedback">{errors.address}</div>}
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="city" className="form-label">
                      City <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.city ? 'is-invalid' : ''}`}
                      id="city"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    {errors.city && <div className="invalid-feedback">{errors.city}</div>}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="state" className="form-label">
                      State <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.state ? 'is-invalid' : ''}`}
                      id="state"
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    {errors.state && <div className="invalid-feedback">{errors.state}</div>}
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="email" className="form-label">
                      Email
                    </label>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      id="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="phone" className="form-label">
                      Phone
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="url" className="form-label">
                    URL <span className="text-danger">*</span>
                  </label>
                  <input
                    type="url"
                    className={`form-control ${errors.url ? 'is-invalid' : ''}`}
                    id="url"
                    name="url"
                    value={form.url}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  {errors.url && <div className="invalid-feedback">{errors.url}</div>}
                </div>

                <div className="mb-3">
                  <label htmlFor="description" className="form-label">
                    Description <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className={`form-control ${errors.description ? 'is-invalid' : ''}`}
                    id="description"
                    name="description"
                    rows={3}
                    value={form.description}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  {errors.description && (
                    <div className="invalid-feedback">{errors.description}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="integration_key" className="form-label">
                    Key <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.integrationKey ? 'is-invalid' : ''}`}
                    id="integration_key"
                    name="integrationKey"
                    value={form.integrationKey}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                  {errors.integrationKey && (
                    <div className="invalid-feedback">{errors.integrationKey}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="integration_secret" className="form-label">
                    Secret <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    className={`form-control ${errors.integrationSecret ? 'is-invalid' : ''}`}
                    id="integration_secret"
                    name="integrationSecret"
                    value={form.integrationSecret}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  {errors.integrationSecret && (
                    <div className="invalid-feedback">{errors.integrationSecret}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label htmlFor="token" className="form-label">
                    Token
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="token"
                    name="token"
                    value={form.token}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </div>

                {(errors.submit || updateError) && (
                  <div className="alert alert-danger py-2">{errors.submit || updateError}</div>
                )}

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/integration')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Integration'}
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

export default IntegrationEdit;
