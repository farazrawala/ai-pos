import { Link } from 'react-router-dom';
import AppModal from '../AppModal.jsx';
import './product-variations-modal.css';

export default function ProductVariationsModal({
  open,
  onClose,
  productName,
  attributes,
  loadingAttributes,
  selectedAttributes,
  onAttributeChange,
  variations,
  onVariationChange,
  onVariationImageChange,
  onRemoveVariation,
  onApply,
  isSubmitting = false,
}) {
  const hasAttributeSelection = Object.keys(selectedAttributes).length > 0;
  const displayName = productName || 'Product';

  const footer = (
    <>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onClose}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary mb-0"
        onClick={onApply}
        disabled={isSubmitting}
      >
        {variations.length > 0 ? 'Apply variations' : 'Generate variations'}
      </button>
    </>
  );

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      title="Manage product variations"
      subtitle={
        <>
          Configure attribute combinations for{' '}
          <span className="pv-product-pill">
            <i className="fas fa-box-open" aria-hidden="true" />
            <span>{displayName}</span>
          </span>
        </>
      }
      footer={footer}
      ariaLabelledBy="productVariationsModalTitle"
    >
      <div className="pv-section">
        <div className="pv-section-title">Step 1 — Select attributes</div>

        {loadingAttributes ? (
          <div className="text-center py-4 text-muted">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Loading attributes…
          </div>
        ) : attributes.length === 0 ? (
          <div className="pv-empty">
            <div className="pv-empty-icon">
              <i className="fas fa-tags" aria-hidden="true" />
            </div>
            <p className="mb-2 fw-semibold text-dark">No attributes found</p>
            <p className="text-sm mb-3">
              Create product attributes (e.g. Size, Color) before generating variations.
            </p>
            <Link to="/attributes/add" className="btn btn-sm btn-outline-primary mb-0" onClick={onClose}>
              Create attributes
            </Link>
          </div>
        ) : (
          attributes.map((attribute) => {
            const attributeId = attribute._id || attribute.id;
            const selectedValues = selectedAttributes[attributeId] || [];
            const attributeValues = attribute.attribute_values || [];

            return (
              <div key={attributeId} className="pv-attribute-block">
                <div className="pv-attribute-name">{attribute.name}</div>
                <div className="pv-chip-row">
                  {attributeValues.map((value, idx) => {
                    const valueName = value.name || value;
                    const isSelected = selectedValues.includes(valueName);
                    return (
                      <button
                        key={`${attributeId}-${idx}`}
                        type="button"
                        className={`pv-chip${isSelected ? ' is-selected' : ''}`}
                        onClick={() => {
                          const newValues = isSelected
                            ? selectedValues.filter((v) => v !== valueName)
                            : [...selectedValues, valueName];
                          onAttributeChange(attributeId, newValues);
                        }}
                      >
                        {valueName}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasAttributeSelection && variations.length === 0 ? (
        <div className="pv-info-banner">
          <i className="fas fa-info-circle mt-1" aria-hidden="true" />
          <span>Select at least one value from each attribute to generate variation combinations.</span>
        </div>
      ) : null}

      {variations.length > 0 ? (
        <div className="pv-section mb-0">
          <div className="pv-summary-bar">
            <span className="pv-summary-count">
              {variations.length} variation{variations.length === 1 ? '' : 's'} generated
            </span>
            <span className="text-xs text-muted">Edit pricing and stock per variation below</span>
          </div>

          <div className="pv-variation-grid">
            {variations.map((variation) => (
              <div key={variation.id} className="pv-variation-card">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger pv-variation-remove mb-0"
                  onClick={() => onRemoveVariation(variation.id)}
                  title="Remove variation"
                  aria-label={`Remove ${variation.name}`}
                >
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
                <div className="pv-variation-card-title">{variation.name}</div>

                <div className="pv-field">
                  <div className="pv-field-label">Image</div>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onVariationImageChange(variation.id, file);
                    }}
                  />
                  {variation.imagePreview ? (
                    <img
                      src={variation.imagePreview}
                      alt={variation.name}
                      className="img-thumbnail mt-2 w-100"
                      style={{ maxHeight: '80px', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>

                <div className="row g-2 mt-1">
                  <div className="col-6">
                    <div className="pv-field">
                      <div className="pv-field-label">Price</div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control form-control-sm"
                        placeholder="0.00"
                        value={variation.price}
                        onChange={(e) => onVariationChange(variation.id, 'price', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="pv-field">
                      <div className="pv-field-label">Quantity</div>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        placeholder="0"
                        value={variation.qty}
                        onChange={(e) => onVariationChange(variation.id, 'qty', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="pv-field">
                      <div className="pv-field-label">Wholesale</div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control form-control-sm bg-light"
                        placeholder="0.00"
                        value={variation.wholesale_price || ''}
                        readOnly
                        disabled
                        aria-readonly="true"
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="pv-field">
                      <div className="pv-field-label">Alert qty</div>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        placeholder="0"
                        value={variation.alert_qty || ''}
                        onChange={(e) =>
                          onVariationChange(variation.id, 'alert_qty', e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="pv-field">
                      <div className="pv-field-label">Product code</div>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Code"
                        value={variation.product_code || ''}
                        onChange={(e) =>
                          onVariationChange(variation.id, 'product_code', e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="pv-field">
                      <div className="pv-field-label">SKU</div>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="SKU"
                        value={variation.sku || ''}
                        onChange={(e) => onVariationChange(variation.id, 'sku', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="pv-field">
                      <div className="pv-field-label">Barcode</div>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Auto-generated if empty"
                        value={variation.barcode || ''}
                        onChange={(e) =>
                          onVariationChange(variation.id, 'barcode', e.target.value)
                        }
                      />
                      <div className="pv-hint">Leave empty to auto-generate on save.</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AppModal>
  );
}
