import { Link } from 'react-router-dom';
import AppModal from '../AppModal.jsx';
import './product-variations-modal.css';

const parseVariationAttrs = (name) => {
  const match = String(name || '').match(/\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
};

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
      <span className="pv-footer-note d-none d-sm-inline">
        {variations.length > 0
          ? `${variations.length} variation${variations.length === 1 ? '' : 's'} ready`
          : 'Select attributes to generate combinations'}
      </span>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onClose}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary mb-0"
        onClick={onApply}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
            Saving…
          </>
        ) : variations.length > 0 ? (
          <>
            <i className="fas fa-check me-1" aria-hidden="true" />
            Apply variations
          </>
        ) : (
          <>
            <i className="fas fa-layer-group me-1" aria-hidden="true" />
            Generate variations
          </>
        )}
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
      <div className="pv-modal">
        <section className="pv-step">
          <div className="pv-step-head">
            <span className="pv-step-num" aria-hidden="true">
              1
            </span>
            <div>
              <h6 className="pv-step-title">Select attributes</h6>
              <p className="pv-step-hint">Choose values to build variation combinations</p>
            </div>
          </div>
          <div className="pv-step-body">
            {loadingAttributes ? (
              <div className="text-center py-4 text-muted">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
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
                <Link
                  to="/attributes/add"
                  className="btn btn-sm btn-outline-primary mb-0"
                  onClick={onClose}
                >
                  <i className="fas fa-plus me-1" aria-hidden="true" />
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
        </section>

        {hasAttributeSelection && variations.length === 0 ? (
          <div className="pv-info-banner">
            <i className="fas fa-info-circle mt-1" aria-hidden="true" />
            <span>
              Select at least one value from each attribute, then click{' '}
              <strong>Generate variations</strong> to build combinations.
            </span>
          </div>
        ) : null}

        {variations.length > 0 ? (
          <section className="pv-step">
            <div className="pv-step-head">
              <span className="pv-step-num" aria-hidden="true">
                2
              </span>
              <div>
                <h6 className="pv-step-title">Configure variations</h6>
                <p className="pv-step-hint">Set pricing, stock, and identifiers per combination</p>
              </div>
            </div>
            <div className="pv-step-body">
              <div className="pv-summary-bar">
                <span className="pv-summary-count">
                  <span className="pv-summary-badge">{variations.length}</span>
                  variation{variations.length === 1 ? '' : 's'} generated
                </span>
                <span className="text-xs text-muted">Edit details below before applying</span>
              </div>

              <div className="pv-variation-grid">
                {variations.map((variation) => {
                  const attrPills = parseVariationAttrs(variation.name);
                  const fileInputId = `pv-variation-image-${variation.id}`;

                  return (
                    <div key={variation.id} className="pv-variation-card">
                      <div className="pv-variation-card-head">
                        <div className="pv-variation-attrs">
                          {attrPills.length > 0 ? (
                            attrPills.map((attr) => (
                              <span key={attr} className="pv-variation-attr-pill">
                                {attr}
                              </span>
                            ))
                          ) : (
                            <span className="pv-variation-attr-pill">{variation.name}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="pv-variation-remove"
                          onClick={() => onRemoveVariation(variation.id)}
                          title="Remove variation"
                          aria-label={`Remove ${variation.name}`}
                        >
                          <i className="fas fa-times" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="pv-variation-card-body">
                        <div className="pv-image-upload">
                          <div className="pv-image-preview">
                            {variation.imagePreview ? (
                              <img src={variation.imagePreview} alt={variation.name} />
                            ) : (
                              <span className="pv-image-preview-empty">
                                <i className="fas fa-image" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                          <div className="pv-image-upload-text">
                            <div className="pv-image-upload-label">Image</div>
                            <input
                              id={fileInputId}
                              type="file"
                              className="d-none"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onVariationImageChange(variation.id, file);
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary pv-image-upload-btn mb-0"
                              onClick={() => document.getElementById(fileInputId)?.click()}
                            >
                              <i className="fas fa-upload me-1" aria-hidden="true" />
                              {variation.imagePreview ? 'Change' : 'Upload'}
                            </button>
                          </div>
                        </div>

                        <div className="pv-field-grid">
                          <div className="pv-field">
                            <div className="pv-field-label">Price</div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="pv-field-input"
                              placeholder="0.00"
                              value={variation.price}
                              onChange={(e) =>
                                onVariationChange(variation.id, 'price', e.target.value)
                              }
                            />
                          </div>
                          <div className="pv-field">
                            <div className="pv-field-label">Quantity</div>
                            <input
                              type="number"
                              min="0"
                              className="pv-field-input"
                              placeholder="0"
                              value={variation.qty}
                              onChange={(e) => onVariationChange(variation.id, 'qty', e.target.value)}
                            />
                          </div>
                          <div className="pv-field">
                            <div className="pv-field-label">Wholesale</div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="pv-field-input"
                              placeholder="0.00"
                              value={variation.wholesale_price || ''}
                              readOnly
                              disabled
                              aria-readonly="true"
                            />
                          </div>
                          <div className="pv-field">
                            <div className="pv-field-label">Alert qty</div>
                            <input
                              type="number"
                              min="0"
                              className="pv-field-input"
                              placeholder="0"
                              value={variation.alert_qty || ''}
                              onChange={(e) =>
                                onVariationChange(variation.id, 'alert_qty', e.target.value)
                              }
                            />
                          </div>
                          <div className="pv-field">
                            <div className="pv-field-label">Product code</div>
                            <input
                              type="text"
                              className="pv-field-input"
                              placeholder="Code"
                              value={variation.product_code || ''}
                              onChange={(e) =>
                                onVariationChange(variation.id, 'product_code', e.target.value)
                              }
                            />
                          </div>
                          <div className="pv-field">
                            <div className="pv-field-label">SKU</div>
                            <input
                              type="text"
                              className="pv-field-input"
                              placeholder="SKU"
                              value={variation.sku || ''}
                              onChange={(e) =>
                                onVariationChange(variation.id, 'sku', e.target.value)
                              }
                            />
                          </div>
                          <div className="pv-field pv-field--full">
                            <div className="pv-field-label">Barcode</div>
                            <input
                              type="text"
                              className="pv-field-input"
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
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppModal>
  );
}
