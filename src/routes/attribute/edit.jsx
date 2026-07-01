import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import {
  fetchAttributeById,
  updateAttribute,
  clearUpdateStatus,
  clearCurrentAttribute,
} from '../../features/attributes/attributesSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import AttributeValuesEditor from './AttributeValuesEditor.jsx';
import './attribute-form.css';

const AttributeEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentAttribute, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.attributes
  );

  const [form, setForm] = useState({
    name: '',
    attribute_values: [],
  });
  const [errors, setErrors] = useState({});
  const [newValue, setNewValue] = useState('');
  const isSubmitting = updateStatus === 'loading';
  const isLoading = fetchStatus === 'loading';

  // Get attribute permissions
  const { canEdit } = usePermissions('attributes');

  // Redirect if user doesn't have edit permission
  useEffect(() => {
    if (canEdit === false) {
      navigate('/attributes');
    }
  }, [canEdit, navigate]);

  // Fetch attribute data on mount
  useEffect(() => {
    if (id) {
      dispatch(fetchAttributeById(id));
    }
    return () => {
      dispatch(clearCurrentAttribute());
    };
  }, [dispatch, id]);

  // Populate form when attribute data is loaded
  useEffect(() => {
    if (currentAttribute && fetchStatus === 'succeeded') {
      setForm({
        name: currentAttribute.name || '',
        attribute_values: currentAttribute.attribute_values || [],
      });
    }
  }, [currentAttribute, fetchStatus]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddValue = () => {
    if (newValue.trim()) {
      setForm((prev) => ({
        ...prev,
        attribute_values: [
          ...prev.attribute_values,
          {
            name: newValue.trim(),
            last_updated: new Date().toISOString(),
          },
        ],
      }));
      setNewValue('');
      if (errors.attribute_values) {
        setErrors((prev) => ({ ...prev, attribute_values: '' }));
      }
    }
  };

  const handleRemoveValue = (index) => {
    setForm((prev) => ({
      ...prev,
      attribute_values: prev.attribute_values.filter((_, i) => i !== index),
    }));
  };

  const handleValueKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddValue();
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(updateAttribute({ attributeId: id, attributeData: form })).unwrap();

      const toastElement = document.getElementById('successToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }

      setTimeout(() => {
        dispatch(clearUpdateStatus());
      }, 5500);

      setTimeout(() => {
        navigate('/attributes');
      }, 1000);
    } catch (error) {
      const errorMessage =
        error?.message || error || 'An error occurred while updating the attribute.';

      const toastElement = document.getElementById('dangerToast');
      if (toastElement) {
        const timeElement = toastElement.querySelector('.toast-time');
        if (timeElement) {
          timeElement.textContent = moment().format('h:mm A');
        }

        const toastBody = toastElement.querySelector('.toast-body');
        if (toastBody) {
          toastBody.textContent = errorMessage;
        }

        if (window.bootstrap && window.bootstrap.Toast) {
          const toast = new window.bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000,
          });
          toast.show();
        } else {
          toastElement.classList.remove('hide');
          toastElement.classList.add('show');
          setTimeout(() => {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
          }, 5000);
        }
      }
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="attr-form-page">
        <div className="attr-form-card card">
          <div className="card-body text-center p-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
            <div className="text-muted">Loading attribute…</div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="attr-form-page">
        <div className="attr-form-card card">
          <div className="card-body p-4">
            <div className="alert alert-danger mb-3">
              {fetchError || 'Failed to load attribute data.'}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/attributes')}
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
    <div className="attr-form-page">
      <div className="attr-form-card card">
        <form onSubmit={handleSubmit}>
          <div className="attr-form-header">
            <div>
              <span className="attr-form-eyebrow">
                <i className="fas fa-sliders" aria-hidden="true" />
                Attributes
              </span>
              <h5 className="attr-form-title">Edit attribute</h5>
              <p className="attr-form-subtitle">
                Update <strong>{form.name || 'this attribute'}</strong> and its values.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary mb-0"
              onClick={() => navigate('/attributes')}
            >
              <i className="fas fa-arrow-left me-1" aria-hidden="true" />
              Back to list
            </button>
          </div>

          <div className="attr-form-body">
            <div className="attr-form-section">
              <div className="attr-form-section-title">
                <i className="fas fa-tag text-primary" aria-hidden="true" />
                Basic details
              </div>
              <p className="attr-form-section-hint">
                The attribute name appears when building product variations.
              </p>

              <label className="attr-form-label d-block" htmlFor="name">
                Attribute name <span className="req">*</span>
              </label>
              <input
                type="text"
                className={`form-control attr-form-control ${errors.name ? 'is-invalid' : ''}`}
                id="name"
                name="name"
                placeholder="e.g. Color, Size, Material"
                value={form.name}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
              {errors.name ? <div className="invalid-feedback">{errors.name}</div> : null}
            </div>

            <AttributeValuesEditor
              values={form.attribute_values}
              newValue={newValue}
              onNewValueChange={setNewValue}
              onAddValue={handleAddValue}
              onRemoveValue={handleRemoveValue}
              onKeyDown={handleValueKeyPress}
              disabled={isSubmitting}
              error={errors.attribute_values}
            />

            {updateError ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">{updateError}</div>
            ) : null}
          </div>

          <div className="attr-form-footer">
            <span className="attr-form-footer-note">
              <span className="req text-danger">*</span> Required fields
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary mb-0"
              onClick={() => navigate('/attributes')}
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
                  Update attribute
                </>
              )}
            </button>
          </div>
        </form>
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
          <div className="toast-body">Attribute updated successfully!</div>
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
          <div className="toast-body">
            {updateError || 'An error occurred while updating the attribute.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttributeEdit;
