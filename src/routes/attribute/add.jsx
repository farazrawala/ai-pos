import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { createAttribute } from '../../features/attributes/attributesSlice.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const AttributeAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    attribute_values: [],
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newValue, setNewValue] = useState('');

  // Get attribute permissions
  const { canCreate } = usePermissions('attribute');

  // Redirect if user doesn't have create permission
  useEffect(() => {
    if (canCreate === false) {
      navigate('/attributes');
    }
  }, [canCreate, navigate]);

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

    setIsSubmitting(true);
    try {
      await dispatch(createAttribute(form)).unwrap();

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
        navigate('/attributes');
      }, 1000);
    } catch (error) {
      const errorMessage =
        error?.message || error || 'An error occurred while creating the attribute.';

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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">Add New Attribute</h5>
                  <p className="text-sm mb-0">Create a new attribute with values</p>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => navigate('/attributes')}
                >
                  <i className="fas fa-arrow-left me-1"></i>
                  Back to List
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={handleSubmit}>
                {/* Name Field */}
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Attribute Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    id="name"
                    name="name"
                    placeholder="Enter attribute name (e.g., Color, Size)"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  <small className="text-muted">
                    The name will be used to identify this attribute.
                  </small>
                </div>

                {/* Attribute Values Section */}
                <div className="mb-4">
                  <label className="form-label">Attribute Values</label>
                  <div className="input-group mb-2">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter attribute value (e.g., Red, Small)"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyPress={handleValueKeyPress}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleAddValue}
                      disabled={!newValue.trim()}
                    >
                      <i className="fas fa-plus me-1"></i>
                      Add Value
                    </button>
                  </div>
                  <small className="text-muted">
                    Press Enter or click "Add Value" to add a new attribute value.
                  </small>

                  {/* Display added values */}
                  {form.attribute_values.length > 0 && (
                    <div className="mt-3">
                      <div className="d-flex flex-wrap gap-2">
                        {form.attribute_values.map((value, index) => (
                          <div
                            key={index}
                            className="badge bg-info text-dark d-flex align-items-center gap-2"
                            style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                          >
                            <span>{value.name}</span>
                            <button
                              type="button"
                              className="btn-close btn-close-white"
                              style={{ fontSize: '0.5rem' }}
                              onClick={() => handleRemoveValue(index)}
                              aria-label="Remove"
                            ></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/attributes')}
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
                        Create Attribute
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
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
          <div className="toast-body">Attribute created successfully!</div>
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
          <div className="toast-body">An error occurred while creating the attribute.</div>
        </div>
      </div>
    </div>
  );
};

export default AttributeAdd;

