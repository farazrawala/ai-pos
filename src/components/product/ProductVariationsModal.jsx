import { Link } from 'react-router-dom';
import AppModal from '../AppModal.jsx';
import ProductVariationCard from './ProductVariationCard.jsx';
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
                {variations.map((variation) => (
                  <ProductVariationCard
                    key={variation.id}
                    variation={variation}
                    disabled={isSubmitting}
                    fileInputId={`pv-modal-variation-image-${variation.id}`}
                    onChange={onVariationChange}
                    onImageChange={onVariationImageChange}
                    onRemove={onRemoveVariation}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppModal>
  );
}
