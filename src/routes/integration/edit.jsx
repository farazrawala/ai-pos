import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchIntegrationById,
  updateIntegration,
  clearCurrentIntegration,
  clearUpdateStatus,
} from '../../features/integration/integrationSlice.js';
import { pickIntegrationImageFromSubmit } from '../../features/integration/integrationAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import {
  EMPTY_INTEGRATION_FORM,
  STORE_TYPE_OPTIONS,
  PRODUCT_SETTING_FIELDS,
  buildIntegrationPayload,
  integrationRecordToForm,
  storeTypeLabel,
  syncIntegrationFormFromDom,
  validateIntegrationForm,
} from './integrationForm.js';
import IntegrationFormFields from './IntegrationFormFields.jsx';
import './integration-form.css';

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
  const [storeLogoFile, setStoreLogoFile] = useState(null);
  const [storeLogoPreview, setStoreLogoPreview] = useState(null);
  const storeLogoInputRef = useRef(null);
  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';

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

  const handleProductSettingToggle = (key, checked) => {
    setForm((prev) => ({
      ...prev,
      product_settings: {
        ...prev.product_settings,
        [key]: checked ? 'yes' : 'no',
      },
    }));
  };

  const handleStoreLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please choose an image file.' }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setStoreLogoFile(file);
    setStoreLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearStoreLogoSelection = () => {
    setStoreLogoFile(null);
    setStoreLogoPreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (storeLogoInputRef.current) storeLogoInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const syncedForm = syncIntegrationFormFromDom(form, e.currentTarget);
    setForm(syncedForm);
    const nextErrors = validateIntegrationForm(syncedForm, { isEdit: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const image = pickIntegrationImageFromSubmit(storeLogoFile, e.currentTarget);
      await dispatch(
        updateIntegration({
          integrationId: id,
          integrationFields: buildIntegrationPayload(syncedForm, { isEdit: true }),
          image,
        })
      ).unwrap();
      if (image) clearStoreLogoSelection();
      navigate('/integration');
    } catch (error) {
      const message =
        typeof error === 'string' ? error : error?.message || 'Failed to update integration';
      console.error('[Integration module] Edit integration form submit failed', { message, error });
      setErrors((prev) => ({ ...prev, submit: message }));
    }
  };

  if (isLoading) {
    return (
      <div className="integration-form-page">
        <div className="integration-form-card card">
          <div className="card-body text-center p-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
            <div className="text-muted">Loading integration…</div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="integration-form-page">
        <div className="integration-form-card card">
          <div className="card-body p-4">
            <div className="alert alert-danger mb-3">
              {fetchError || 'Failed to load integration.'}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/integration')}
            >
              <i className="fas fa-arrow-left me-1" aria-hidden="true" />
              Back to list
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-form-page">
      <form onSubmit={handleSubmit}>
        <div className="integration-form-card card">
          <div className="integration-form-header">
            <div>
              <span className="integration-form-eyebrow">
                <i className="fas fa-plug" aria-hidden="true" />
                Integration
              </span>
              <h5 className="integration-form-title">Edit integration</h5>
              <p className="integration-form-subtitle">
                Update connection settings for{' '}
                <strong>{form.name || 'this store'}</strong>
                {form.store_type ? (
                  <>
                    {' '}
                    <span className="integration-store-pill">{storeTypeLabel(form.store_type)}</span>
                  </>
                ) : null}
                .
              </p>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit} encType="multipart/form-data">
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
                    Store name <span className="text-danger">*</span>
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
                  <label htmlFor="store_image" className="form-label">
                    Store Image
                  </label>
                  <input
                    ref={storeLogoInputRef}
                    type="file"
                    className={`form-control ${errors.image ? 'is-invalid' : ''}`}
                    id="store_image"
                    name="image"
                    accept="image/*"
                    onChange={handleStoreLogoChange}
                    disabled={isSubmitting}
                  />
                  {errors.image && (
                    <div className="invalid-feedback d-block">{errors.image}</div>
                  )}
                  <small className="text-muted d-block">
                    Optional. Uploaded as <code className="text-xs">image</code> via multipart when
                    changed.
                  </small>
                  {(storeLogoPreview || form.storeLogoUrl) && (
                    <div className="mt-3 d-flex align-items-start gap-2">
                      <img
                        src={storeLogoPreview || form.storeLogoUrl}
                        alt="Store image"
                        className="rounded border"
                        style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }}
                      />
                      {storeLogoPreview ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={clearStoreLogoSelection}
                          disabled={isSubmitting}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  )}
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
                    Secret
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
                  <small className="text-muted">Leave blank to keep the current secret.</small>
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

                <div className="mb-4">
                  <h6 className="text-sm font-weight-bold mb-3">Product settings</h6>
                  <p className="text-sm text-muted mb-3">
                    Choose which product fields to sync with this store integration.
                  </p>
                  <div className="row g-3">
                    {PRODUCT_SETTING_FIELDS.map(({ key, label }) => {
                      const checked = form.product_settings?.[key] === 'yes';
                      return (
                        <div key={key} className="col-md-6">
                          <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2">
                            <label
                              className="form-label mb-0 text-sm"
                              htmlFor={`product-setting-${key}`}
                            >
                              {label}
                            </label>
                            <div className="form-check form-switch mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id={`product-setting-${key}`}
                                checked={checked}
                                onChange={(e) => handleProductSettingToggle(key, e.target.checked)}
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/integration')}
            >
              <i className="fas fa-arrow-left me-1" aria-hidden="true" />
              Back to list
            </button>
          </div>

          <div className="integration-form-body">
            <IntegrationFormFields
              form={form}
              errors={errors}
              onChange={handleChange}
              disabled={isSubmitting}
            />

            {errors.submit || updateError ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">{errors.submit || updateError}</div>
            ) : null}
          </div>

          <div className="integration-form-footer">
            <span className="integration-form-footer-note">
              <span className="req text-danger">*</span> Required fields
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary mb-0"
              onClick={() => navigate('/integration')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary mb-0" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                  Updating…
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2" aria-hidden="true" />
                  Update integration
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default IntegrationEdit;
