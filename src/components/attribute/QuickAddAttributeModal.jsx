import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import AppModal from '../AppModal.jsx';
import { createAttribute } from '../../features/attributes/attributesSlice.js';
import { toast } from '../../utils/toast.js';
import './quick-add-attribute-modal.css';

const pickCreatedAttribute = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data != null && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.attribute != null && typeof result.attribute === 'object') {
    return result.attribute;
  }
  if (result._id || result.id || result.attribute_id) return result;
  return null;
};

/**
 * Create an attribute (+ values) without leaving the product variations flow.
 * Calls onCreated(attribute) with the created record (or a best-effort stub).
 */
export default function QuickAddAttributeModal({ open, onClose, onCreated }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [values, setValues] = useState([]);
  const [newValue, setNewValue] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setValues([]);
    setNewValue('');
    setErrors({});
    setFormError('');
    setSubmitting(false);
  }, [open]);

  const handleAddValue = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    const exists = values.some(
      (v) => String(v.name || v).trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setErrors((prev) => ({ ...prev, attribute_values: 'That value is already added' }));
      return;
    }
    setValues((prev) => [
      ...prev,
      { name: trimmed, last_updated: new Date().toISOString() },
    ]);
    setNewValue('');
    if (errors.attribute_values) {
      setErrors((prev) => ({ ...prev, attribute_values: '' }));
    }
  };

  const handleRemoveValue = (index) => {
    setValues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValueKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddValue();
    }
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Name is required';
    if (values.length === 0) next.attribute_values = 'Add at least one value';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        attribute_values: values.map((v) => ({
          name: String(v.name || v).trim(),
          last_updated: v.last_updated || new Date().toISOString(),
        })),
      };

      const result = await dispatch(createAttribute(payload)).unwrap();
      const created = pickCreatedAttribute(result);
      const id = String(created?._id ?? created?.id ?? created?.attribute_id ?? '').trim();
      const record = created || {
        _id: id,
        name: payload.name,
        attribute_values: payload.attribute_values,
      };

      if (
        record &&
        (!Array.isArray(record.attribute_values) || record.attribute_values.length === 0)
      ) {
        record.attribute_values = payload.attribute_values;
      }
      if (record && !record.name) record.name = payload.name;

      toast.success('Attribute created successfully.');
      onCreated?.(record);
      onClose?.();
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || 'Failed to create attribute';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Add new attribute"
      subtitle="Define a name and values (e.g. Color → Red, Blue) for product variations."
      size="md"
      disableBackdropClose={submitting}
      footer={
        <>
          <span className="qa-attr-footer-note d-none d-sm-inline">
            <span className="text-danger">*</span> Required fields
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary mb-0"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="quick-add-attribute-form"
            className="btn btn-primary mb-0"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                />
                Creating…
              </>
            ) : (
              <>
                <i className="fas fa-check me-1" aria-hidden="true" />
                Create attribute
              </>
            )}
          </button>
        </>
      }
    >
      <form id="quick-add-attribute-form" className="qa-attr" onSubmit={handleSubmit}>
        {formError ? (
          <div className="alert alert-danger qa-attr-alert" role="alert">
            {formError}
          </div>
        ) : null}

        <section className="qa-attr-section">
          <div className="qa-attr-section-head">
            <div>
              <h6 className="qa-attr-section-title">
                <i className="fas fa-tag" aria-hidden="true" />
                Basic details
              </h6>
              <p className="qa-attr-section-hint">
                This name appears when building variation combinations.
              </p>
            </div>
          </div>

          <label htmlFor="quick_attribute_name" className="qa-attr-label">
            Attribute name <span className="req">*</span>
          </label>
          <input
            id="quick_attribute_name"
            type="text"
            className={`form-control qa-attr-control ${errors.name ? 'is-invalid' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              if (formError) setFormError('');
            }}
            placeholder="e.g. Color, Size, Material"
            autoFocus
            disabled={submitting}
          />
          {errors.name ? (
            <div className="invalid-feedback d-block">{errors.name}</div>
          ) : (
            <span className="qa-attr-help">Used across products that share this attribute.</span>
          )}
        </section>

        <section className="qa-attr-section">
          <div className="qa-attr-section-head">
            <div>
              <h6 className="qa-attr-section-title">
                <i className="fas fa-tags" aria-hidden="true" />
                Attribute values
              </h6>
              <p className="qa-attr-section-hint">
                Add options like Red, Blue, Small, or Large. Press Enter to add quickly.
              </p>
            </div>
            {values.length > 0 ? (
              <span className="qa-attr-count" aria-label={`${values.length} values`}>
                {values.length}
              </span>
            ) : null}
          </div>

          <label className="qa-attr-label" htmlFor="quick_attribute_value">
            Add a value <span className="req">*</span>
          </label>
          <div className="qa-attr-add-row">
            <input
              id="quick_attribute_value"
              type="text"
              className="form-control qa-attr-control"
              value={newValue}
              onChange={(e) => {
                setNewValue(e.target.value);
                if (errors.attribute_values) {
                  setErrors((prev) => ({ ...prev, attribute_values: '' }));
                }
              }}
              onKeyDown={handleValueKeyDown}
              placeholder="Enter value (e.g. Red, Small)"
              disabled={submitting}
            />
            <button
              type="button"
              className="btn btn-outline-primary qa-attr-add-btn mb-0"
              onClick={handleAddValue}
              disabled={submitting || !newValue.trim()}
            >
              <i className="fas fa-plus" aria-hidden="true" />
              Add value
            </button>
          </div>
          {errors.attribute_values ? (
            <div className="qa-attr-error">{errors.attribute_values}</div>
          ) : null}

          <div
            className={`qa-attr-chips${values.length === 0 ? ' qa-attr-chips--empty' : ''}`}
            aria-live="polite"
          >
            {values.length === 0 ? (
              <>
                <i className="fas fa-inbox" aria-hidden="true" />
                <span>No values added yet</span>
              </>
            ) : (
              values.map((value, index) => (
                <span key={`${value.name}-${index}`} className="qa-attr-chip">
                  {value.name}
                  <button
                    type="button"
                    className="qa-attr-chip-remove"
                    aria-label={`Remove ${value.name}`}
                    onClick={() => handleRemoveValue(index)}
                    disabled={submitting}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </section>
      </form>
    </AppModal>
  );
}
