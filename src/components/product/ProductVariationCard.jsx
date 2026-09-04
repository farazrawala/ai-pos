import { useId, useRef } from 'react';
import { parseVariationAttrs, generateBarcode } from './productVariationUtils.js';
import ProductImageDropzone from './ProductImageDropzone.jsx';
import { PRODUCT_IMAGE_ACCEPT, PRODUCT_IMAGE_HINT } from '../../utils/productImageUpload.js';

const isUnsetBigCommercePrice = (value) => {
  const s = String(value ?? '').trim();
  return s === '' || s === '0' || s === '0.00';
};

export default function ProductVariationCard({
  variation,
  onChange,
  onImageChange,
  onRemove,
  disabled = false,
  showMetaFields = false,
  hideBigCommerce = false,
  fileInputId,
}) {
  const reactId = useId();
  const inputId = fileInputId || `pv-variation-image-${variation.id}-${reactId}`;
  const showOnBcId = `pv-show-on-bc-${variation.id}-${reactId}`;
  const bcPriceId = `pv-bc-price-${variation.id}-${reactId}`;
  const bcHoldId = `pv-bc-hold-${variation.id}-${reactId}`;
  const fileInputRef = useRef(null);
  const attrPills = parseVariationAttrs(variation.name);
  const showOnBigCommerce = Boolean(variation.show_on_bigcommerce);

  const handleRegenerateBarcode = () => {
    onChange(variation.id, 'barcode', generateBarcode());
  };

  const handleShowOnBigCommerce = (checked) => {
    onChange(variation.id, 'show_on_bigcommerce', checked);
    if (checked && isUnsetBigCommercePrice(variation.bigcommerce_price)) {
      onChange(variation.id, 'bigcommerce_price', String(variation.price ?? ''));
    }
  };

  const handleImageFiles = (files) => {
    const file = files?.[0];
    if (file) onImageChange(variation.id, file);
    // Reset so selecting the same file again still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
        <ProductImageDropzone
          compact
          className="pv-image-upload"
          id={inputId}
          inputRef={fileInputRef}
          accept={PRODUCT_IMAGE_ACCEPT}
          disabled={disabled}
          onFiles={handleImageFiles}
        >
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
            <p className="pv-image-upload-drop-copy">
              {variation.imagePreview ? 'Drag & drop to replace' : 'Drag & drop an image here'}
              <span className="product-image-dropzone-or">or</span>
              <span className="product-image-dropzone-browse">Browse files</span>
            </p>
            <p className="product-image-dropzone-sub">{PRODUCT_IMAGE_HINT}</p>
          </div>
        </ProductImageDropzone>

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
            <div className="pv-field-input-group">
              <input
                type="text"
                className="pv-field-input"
                placeholder="Auto-generated if empty"
                value={variation.barcode || ''}
                disabled={disabled}
                onChange={(e) => onChange(variation.id, 'barcode', e.target.value)}
              />
              <button
                type="button"
                className="pv-field-icon-btn"
                onClick={handleRegenerateBarcode}
                disabled={disabled}
                title="Regenerate barcode"
                aria-label="Regenerate barcode"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
            </div>
            <div className="pv-hint">Leave empty to auto-generate on save.</div>
          </div>

          {!hideBigCommerce ? (
            <div className="pv-bc-section">
              <div className="pv-bc-section-title">BigCommerce</div>
              <label className="pv-bc-switch" htmlFor={showOnBcId}>
                <input
                  className="pv-bc-switch-input"
                  type="checkbox"
                  role="switch"
                  id={showOnBcId}
                  checked={showOnBigCommerce}
                  disabled={disabled}
                  onChange={(e) => handleShowOnBigCommerce(e.target.checked)}
                />
                <span className="pv-bc-switch-track" aria-hidden="true">
                  <span className="pv-bc-switch-thumb" />
                </span>
                <span className="pv-bc-switch-label">Show on BigCommerce</span>
              </label>
              {showOnBigCommerce ? (
                <div className="pv-bc-fields">
                  <div className="pv-field">
                    <label className="pv-field-label" htmlFor={bcPriceId}>
                      BigCommerce Price
                    </label>
                    <input
                      id={bcPriceId}
                      type="text"
                      className="pv-field-input"
                      placeholder={variation.price || '0.00'}
                      value={variation.bigcommerce_price ?? ''}
                      disabled={disabled}
                      onChange={(e) => onChange(variation.id, 'bigcommerce_price', e.target.value)}
                    />
                  </div>
                  <div className="pv-field">
                    <label className="pv-field-label" htmlFor={bcHoldId}>
                      BigCommerce Hold Qty
                    </label>
                    <input
                      id={bcHoldId}
                      type="number"
                      min="0"
                      step="1"
                      className="pv-field-input"
                      placeholder="0"
                      value={variation.bigcommerce_hold_qty ?? ''}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(variation.id, 'bigcommerce_hold_qty', e.target.value)
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
