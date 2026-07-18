import { useEffect, useMemo, useState } from 'react';
import AppModal from '../AppModal.jsx';
import { formatMoney } from '../../utils/formatMoney.js';
import {
  getProductBarcode,
  getProductBrand,
  getProductCategory,
  getProductDescription,
  getProductImages,
  getProductName,
  getProductPrice,
  getProductComparePrice,
  getProductSku,
  getProductStock,
  getProductBadges,
  getProductVariations,
  getVariationLabel,
  formatProductDescriptionHtml,
  productIdFromRecord,
} from '../../features/bigCommerce/marketplaceUtils.js';
import ProductCard from './ProductCard.jsx';

export default function ProductDetailModal({
  open,
  onClose,
  product,
  variations: variationsProp,
  related = [],
  loading,
  onOpenRelated,
}) {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [product]);

  const name = getProductName(product);
  const images = getProductImages(product);
  const price = getProductPrice(product);
  const compare = getProductComparePrice(product);
  const sku = getProductSku(product);
  const barcode = getProductBarcode(product);
  const brand = getProductBrand(product);
  const category = getProductCategory(product);
  const stock = getProductStock(product);
  const description = formatProductDescriptionHtml(getProductDescription(product));
  const badges = getProductBadges(product);
  const specs = buildSpecs(product);
  const productType = String(product?.product_type ?? product?.productType ?? '').trim();

  const variations = useMemo(() => {
    if (Array.isArray(variationsProp) && variationsProp.length > 0) return variationsProp;
    return getProductVariations(product);
  }, [variationsProp, product]);

  const variationStockTotal = useMemo(() => {
    if (!variations.length) return null;
    let total = 0;
    let hasAny = false;
    variations.forEach((v) => {
      const s = getProductStock(v);
      if (s != null && Number.isFinite(s)) {
        total += s;
        hasAny = true;
      }
    });
    return hasAny ? total : null;
  }, [variations]);

  const displayStock = stock != null ? stock : variationStockTotal;

  const metaItems = [
    sku ? { label: 'SKU', value: sku } : null,
    barcode ? { label: 'Barcode', value: barcode } : null,
    category.name && category.name !== '—' ? { label: 'Category', value: category.name } : null,
    brand.name && brand.name !== '—' ? { label: 'Brand', value: brand.name } : null,
    productType ? { label: 'Type', value: productType } : null,
    displayStock != null ? { label: 'Stock', value: String(displayStock) } : null,
  ].filter(Boolean);

  const priceRange = useMemo(() => {
    if (!variations.length) return null;
    let min = Infinity;
    let max = -Infinity;
    variations.forEach((v) => {
      const p = getProductPrice(v);
      if (!Number.isFinite(p)) return;
      min = Math.min(min, p);
      max = Math.max(max, p);
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min === max) return formatMoney(min);
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }, [variations]);

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={loading ? 'Loading product…' : name}
      subtitle={brand.name !== '—' ? brand.name : category.name !== '—' ? category.name : undefined}
      size="xl"
      footer={
        <button type="button" className="bc-btn bc-btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      {loading && !product ? (
        <div className="bc-detail-loading">
          <div className="bc-skeleton bc-detail-skel-media" />
          <div className="bc-detail-skel-copy">
            <div className="bc-skeleton bc-skeleton-line w-70" />
            <div className="bc-skeleton bc-skeleton-line w-50" />
            <div className="bc-skeleton bc-skeleton-line w-90" />
          </div>
        </div>
      ) : !product ? (
        <p className="bc-muted">Product not found.</p>
      ) : (
        <div className="bc-detail">
          <div className="bc-detail-gallery">
            <div className="bc-detail-hero">
              {images[activeImage] ? (
                <img src={images[activeImage]} alt={name} />
              ) : (
                <div className="bc-card-img bc-card-img--empty">No image</div>
              )}
              {badges.length > 0 ? (
                <div className="bc-badges">
                  {badges.map((b) => (
                    <span key={b.key} className={`bc-badge bc-badge--${b.tone}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="bc-thumbs">
                {images.map((src, idx) => (
                  <button
                    key={src}
                    type="button"
                    className={`bc-thumb ${idx === activeImage ? 'is-active' : ''}`}
                    onClick={() => setActiveImage(idx)}
                  >
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="bc-detail-info">
            <div className="bc-detail-price-row">
              <div className="bc-price-block bc-price-block--lg">
                <span className="bc-price">{priceRange || formatMoney(price)}</span>
                {compare != null && !priceRange ? (
                  <span className="bc-price-old">{formatMoney(compare)}</span>
                ) : null}
              </div>
              {displayStock != null ? (
                <span
                  className={`bc-stock-pill ${displayStock === 0 ? 'is-out' : displayStock <= 5 ? 'is-low' : 'is-in'}`}
                >
                  {displayStock === 0
                    ? 'Out of stock'
                    : `${displayStock} in stock${variations.length ? ' (all variants)' : ''}`}
                </span>
              ) : null}
            </div>

            {metaItems.length > 0 ? (
              <div className="bc-detail-meta">
                {metaItems.map((item) => (
                  <div key={item.label} className="bc-detail-meta-item">
                    <span className="bc-meta-label">{item.label}</span>
                    <span className="bc-detail-meta-value">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {description ? (
              <div className="bc-detail-section">
                <h4>About this product</h4>
                <div className="bc-detail-description">
                  {description.split(/\n+/).map((para, idx) =>
                    para.trim() ? (
                      <p key={`p-${idx}`}>{para.trim()}</p>
                    ) : null
                  )}
                </div>
              </div>
            ) : null}

            {specs.length > 0 ? (
              <div className="bc-detail-section">
                <h4>Specifications</h4>
                <dl className="bc-spec-list">
                  {specs.map(([k, v]) => (
                    <div key={k} className="bc-spec-row">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {variations.length > 0 ? (
              <div className="bc-detail-section">
                <div className="bc-detail-section-head">
                  <h4>Available variations</h4>
                  <span className="bc-pill">{variations.length}</span>
                </div>
                <div className="bc-variations-wrap">
                  <table className="bc-variations-table">
                    <thead>
                      <tr>
                        <th>Option</th>
                        <th>SKU</th>
                        <th>Barcode</th>
                        <th>Price</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variations.map((variation, idx) => {
                        const vStock = getProductStock(variation);
                        const vPrice = getProductPrice(variation);
                        const vSku = getProductSku(variation);
                        const vBarcode = getProductBarcode(variation);
                        return (
                          <tr key={productIdFromRecord(variation) || `var-${idx}`}>
                            <td>
                              <span className="bc-variation-name">
                                {getVariationLabel(variation, name)}
                              </span>
                            </td>
                            <td>
                              <span className="bc-code">{vSku || '—'}</span>
                            </td>
                            <td>
                              <span className="bc-code">{vBarcode || '—'}</span>
                            </td>
                            <td className="bc-variation-price">{formatMoney(vPrice)}</td>
                            <td>
                              <span
                                className={`bc-stock-pill bc-stock-pill--sm ${
                                  vStock === 0
                                    ? 'is-out'
                                    : vStock == null
                                      ? 'is-unknown'
                                      : vStock <= 5
                                        ? 'is-low'
                                        : 'is-in'
                                }`}
                              >
                                {vStock == null ? '—' : vStock === 0 ? 'Out' : vStock}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          {related.length > 0 ? (
            <div className="bc-related">
              <h4>You may also like</h4>
              <div className="bc-related-grid">
                {related.map((item) => (
                  <ProductCard
                    key={productIdFromRecord(item)}
                    product={item}
                    viewMode="grid"
                    onViewDetails={(id) => onOpenRelated?.(id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </AppModal>
  );
}

function buildSpecs(product) {
  if (!product || typeof product !== 'object') return [];
  const rows = [];
  const push = (label, value) => {
    if (value == null || value === '') return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    const text = String(value).trim();
    if (!text) return;
    rows.push([label, text]);
  };

  push('Unit', product.unit ?? product.product_unit);
  const tax = product.tax_rate ?? product.taxRate;
  if (tax != null && Number(tax) !== 0) push('Tax rate', tax);
  if (product.weight != null && Number(product.weight) !== 0) push('Weight', product.weight);
  push('Dimensions', product.dimensions);

  if (product.specifications && typeof product.specifications === 'object') {
    Object.entries(product.specifications).forEach(([k, v]) => {
      if (v == null || v === '' || Number(v) === 0) return;
      push(k, v);
    });
  }

  return rows;
}
