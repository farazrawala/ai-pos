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
