import { useId } from 'react';
import { parseVariationAttrs } from './productVariationUtils.js';

export default function ProductVariationCard({
  variation,
  onChange,
  onImageChange,
  onRemove,
  disabled = false,
  showMetaFields = false,
  fileInputId,
}) {
  const reactId = useId();
  const inputId = fileInputId || `pv-variation-image-${variation.id}-${reactId}`;
  const attrPills = parseVariationAttrs(variation.name);

  return (
    <div className="pv-variation-card">
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
          onClick={() => onRemove(variation.id)}
          title="Remove variation"
          aria-label={`Remove ${variation.name}`}
          disabled={disabled}
        >
          <span aria-hidden="true">×</span>
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
              id={inputId}
              type="file"
              className="d-none"
              accept="image/*"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageChange(variation.id, file);
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-primary pv-image-upload-btn mb-0"
              disabled={disabled}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              <i className="fas fa-upload me-1" aria-hidden="true" />
              {variation.imagePreview ? 'Change' : 'Upload'}
            </button>
          </div>
        </div>

        <div className="pv-field-grid">
          {showMetaFields ? (
            <>
              <div className="pv-field pv-field--full">
                <div className="pv-field-label">Name</div>
                <input
                  type="text"
                  className="pv-field-input"
                  value={variation.name}
                  readOnly
                  disabled
                  aria-readonly="true"
                />
              </div>
              <div className="pv-field pv-field--full">
                <div className="pv-field-label">Slug</div>
                <input
                  type="text"
                  className="pv-field-input"
                  value={variation.slug}
                  disabled={disabled}
                  onChange={(e) => onChange(variation.id, 'slug', e.target.value)}
                />
              </div>
            </>
          ) : null}

          <div className="pv-field">
            <div className="pv-field-label">Price</div>
            <input
              type="number"
              step="0.01"
              min="0"
              className="pv-field-input"
              placeholder="0.00"
              value={variation.price}
              disabled={disabled}
              onChange={(e) => onChange(variation.id, 'price', e.target.value)}
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
              disabled={disabled}
              onChange={(e) => onChange(variation.id, 'qty', e.target.value)}
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
              disabled={disabled}
              onChange={(e) => onChange(variation.id, 'alert_qty', e.target.value)}
            />
          </div>
          <div className="pv-field">
            <div className="pv-field-label">Product code</div>
            <input
              type="text"
              className="pv-field-input"
              placeholder="Code"
              value={variation.product_code || ''}
              disabled={disabled}
              onChange={(e) => onChange(variation.id, 'product_code', e.target.value)}
            />
          </div>
          <div className="pv-field">
            <div className="pv-field-label">SKU</div>
            <input
              type="text"
              className="pv-field-input"
              placeholder="SKU"
              value={variation.sku || ''}
              disabled={disabled}
              onChange={(e) => onChange(variation.id, 'sku', e.target.value)}
            />
          </div>
          <div className="pv-field pv-field--full">
            <div className="pv-field-label">Barcode</div>
            <input
              type="text"
              className="pv-field-input"
              placeholder="Auto-generated if empty"
              value={variation.barcode || ''}
              disabled={disabled}
              onChange={(e) => onChange(variation.id, 'barcode', e.target.value)}
            />
            <div className="pv-hint">Leave empty to auto-generate on save.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
