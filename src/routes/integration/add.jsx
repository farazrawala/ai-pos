import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createIntegration } from '../../features/integration/integrationSlice.js';
import { pickIntegrationImageFromSubmit } from '../../features/integration/integrationAPI.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import {
  EMPTY_INTEGRATION_FORM,
  STORE_TYPE_OPTIONS,
  buildIntegrationPayload,
  syncIntegrationFormFromDom,
  validateIntegrationForm,
} from './integrationForm.js';

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
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add Integration</h5>
                  <p className="text-sm mb-0">Connect a new store or sales channel.</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/integration')}
                >
                  <i className="fas fa-arrow-left me-1"></i>
                  Back to List
                </button>
              </div>
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
                  <small className="text-muted d-block">
                    Optional. Uploaded as <code className="text-xs">image</code> via multipart on{' '}
                    <code className="text-xs">POST /integration/create</code>.
                  </small>
                  {errors.image && (
                    <div className="invalid-feedback d-block">{errors.image}</div>
                  )}
                  {storeLogoPreview && (
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
                    placeholder="https://example.com"
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

                {errors.submit && <div className="alert alert-danger py-2">{errors.submit}</div>}

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
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save me-2"></i>
                        Create Integration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

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
