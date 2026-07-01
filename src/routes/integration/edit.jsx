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
      <form onSubmit={handleSubmit} encType="multipart/form-data">
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
              isEdit
            />

            <div className="integration-form-section mt-3">
              <div className="integration-form-section-title">
                <i className="fas fa-image text-primary" aria-hidden="true" />
                Store image
              </div>
              <p className="integration-form-section-hint">
                Optional logo or image for this store connection.
              </p>
              <label className="integration-form-label d-block" htmlFor="store_image">
                Image file
              </label>
              <input
                ref={storeLogoInputRef}
                type="file"
                className={`form-control integration-form-control ${errors.image ? 'is-invalid' : ''}`}
                id="store_image"
                name="image"
                accept="image/*"
                onChange={handleStoreLogoChange}
                disabled={isSubmitting}
              />
              {errors.image ? (
                <div className="invalid-feedback d-block">{errors.image}</div>
              ) : null}
              {storeLogoPreview || form.storeLogoUrl ? (
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
              ) : null}
            </div>

            <div className="integration-form-section mt-3">
              <div className="integration-form-section-title">
                <i className="fas fa-sliders text-primary" aria-hidden="true" />
                Product settings
              </div>
              <p className="integration-form-section-hint">
                Choose which product fields to sync with this store integration.
              </p>
              <div className="row g-3">
                {PRODUCT_SETTING_FIELDS.map(({ key, label }) => {
                  const checked = form.product_settings?.[key] === 'yes';
                  return (
                    <div key={key} className="col-md-6">
                      <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2">
                        <label
                          className="integration-form-label mb-0"
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
