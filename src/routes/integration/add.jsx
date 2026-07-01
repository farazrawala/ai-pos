import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createIntegration } from '../../features/integration/integrationSlice.js';
import { pickIntegrationImageFromSubmit } from '../../features/integration/integrationAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import {
  EMPTY_INTEGRATION_FORM,
  buildIntegrationPayload,
  syncIntegrationFormFromDom,
  validateIntegrationForm,
} from './integrationForm.js';
import IntegrationFormFields from './IntegrationFormFields.jsx';
import './integration-form.css';

const IntegrationAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canCreate } = usePermissions('integration');
  const [form, setForm] = useState({ ...EMPTY_INTEGRATION_FORM });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeLogoFile, setStoreLogoFile] = useState(null);
  const [storeLogoPreview, setStoreLogoPreview] = useState(null);
  const storeLogoInputRef = useRef(null);

  useEffect(() => {
    if (canCreate === false) navigate('/integration');
  }, [canCreate, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
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

  const showToast = (elementId, bodyText) => {
    const toastElement = document.getElementById(elementId);
    if (!toastElement) return;

    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }

    if (bodyText) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = bodyText;
    }

    if (window.bootstrap && window.bootstrap.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
    } else {
      toastElement.classList.remove('hide');
      toastElement.classList.add('show');
      setTimeout(() => {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');
      }, 5000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const syncedForm = syncIntegrationFormFromDom(form, e.currentTarget);
    setForm(syncedForm);
    const nextErrors = validateIntegrationForm(syncedForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const image = pickIntegrationImageFromSubmit(storeLogoFile, e.currentTarget);
      await dispatch(
        createIntegration({
          integrationFields: buildIntegrationPayload(syncedForm),
          image,
        })
      ).unwrap();
      clearStoreLogoSelection();
      showToast('successToast');
      setTimeout(() => navigate('/integration'), 1000);
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'An error occurred while creating the integration.';
      console.error('[Integration module] Add integration form submit failed', { message, error });
      showToast('dangerToast', message);
      setErrors((prev) => ({ ...prev, submit: message }));
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <h5 className="integration-form-title">Add integration</h5>
              <p className="integration-form-subtitle">
                Connect a new store or sales channel to your POS.
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
              {storeLogoPreview ? (
                <div className="mt-3 d-flex align-items-start gap-2">
                  <img
                    src={storeLogoPreview}
                    alt="Store image preview"
                    className="rounded border"
                    style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={clearStoreLogoSelection}
                    disabled={isSubmitting}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>

            {errors.submit ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">{errors.submit}</div>
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
                  Creating…
                </>
              ) : (
                <>
                  <i className="fas fa-plus me-2" aria-hidden="true" />
                  Create integration
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Integration created successfully!</div>
        </div>

        <div
          className="toast fade hide p-2 mt-2 bg-white"
          role="alert"
          aria-live="assertive"
          id="dangerToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-notification-70 text-danger me-2"></i>
            <span className="me-auto text-gradient text-danger font-weight-bold">Error</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
            <i
              className="fas fa-times text-md ms-3 cursor-pointer"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></i>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">An error occurred while creating the integration.</div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationAdd;
