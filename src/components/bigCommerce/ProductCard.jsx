import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaImage,
  FaPlus,
  FaRotateLeft,
  FaTag,
  FaTrash,
} from 'react-icons/fa6';
import { formatMoney } from '../../utils/formatMoney.js';
import { DEBUG } from '../../config/env.js';
import {
  describeProductPriceFields,
  getBigCommercePrice,
  getProductBadges,
  getProductBarcode,
  getProductBrand,
  getProductCategory,
  getProductDescription,
  getProductListingImage,
  getProductName,
  getProductPrice,
  getProductComparePrice,
  getProductSku,
  getProductStock,
  isOutOfStock,
  isAlreadyMeTooProduct,
  productIdFromRecord,
  LOW_STOCK_THRESHOLD,
} from '../../features/bigCommerce/marketplaceUtils.js';

function stockTone(stock) {
  if (stock == null) return 'unknown';
  if (isOutOfStock(stock)) return 'out';
  if (stock > 0 && stock < LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

function stockLabel(stock) {
  if (stock == null) return 'Stock —';
  if (isOutOfStock(stock)) return 'Out of stock';
  if (stock > 0 && stock < LOW_STOCK_THRESHOLD) return `Low · ${stock}`;
  return `${stock} in stock`;
}

/** Product photo, or the source company logo when the product has no image. */
export function ProductMediaImage({
  image,
  placeholderLogoUrl,
  name,
  className = 'bc-card-img',
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setLogoFailed(false);
  }, [image, placeholderLogoUrl]);

  const productSrc = image && !imageFailed ? image : '';
  const logoSrc = placeholderLogoUrl && !logoFailed ? placeholderLogoUrl : '';
  const src = productSrc || logoSrc;
  const usingLogo = Boolean(src && !productSrc);

  if (!src) {
    return (
      <div className={`${className} bc-card-img--empty`.trim()} aria-hidden="true">
        <FaImage />
        <span>No image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={usingLogo ? '' : name}
      loading="lazy"
      className={`${className}${usingLogo ? ' bc-card-img--logo' : ''}`}
      onError={() => {
        if (productSrc) setImageFailed(true);
        else setLogoFailed(true);
      }}
    />
  );
}

export default function ProductCard({
  product,
  viewMode = 'grid',
  onQuickView,
  detailsHref = '',
  onDetailsNavigate,
  onMeToo,
  onDeleteMeToo,
  onResetMeToo,
  meTooLoading = false,
  deleteMeTooLoading = false,
  resetMeTooLoading = false,
  hideMeToo = false,
  meTooLocked = false,
  alreadyMeTooIds,
  placeholderLogoUrl = '',
  selectable = false,
  selected = false,
  onToggleSelect,
  selectDisabled = false,
}) {
  const id = productIdFromRecord(product);
  const name = getProductName(product);
  const image = getProductListingImage(product);
  const price = getProductPrice(product);
  const bigCommercePrice = getBigCommercePrice(product);
  const compare = getProductComparePrice(product);
  const sku = getProductSku(product);
  const barcode = getProductBarcode(product);
  const brand = getProductBrand(product);
  const category = getProductCategory(product);
  const stock = getProductStock(product);
  const description = getProductDescription(product);
  const alreadyMeToo = isAlreadyMeTooProduct(product, alreadyMeTooIds);
  const badges = getProductBadges(product, { alreadyMeToo });
  const showMeToo = !hideMeToo && typeof onMeToo === 'function';
  const meTooBusy = Boolean(meTooLoading);
  const deleteBusy = Boolean(deleteMeTooLoading);
  const resetBusy = Boolean(resetMeTooLoading);
  const showDelete = alreadyMeToo && typeof onDeleteMeToo === 'function';
  const showReset = alreadyMeToo && typeof onResetMeToo === 'function';
  const actionBusy = meTooBusy || deleteBusy || resetBusy;
  const locked = Boolean(meTooLocked);
  const manageTitle = locked
    ? 'Connect to this store first to manage Me too products'
    : null;
  const meTooTitle = locked
    ? 'Connect to this store first to copy products'
    : alreadyMeToo
      ? 'Update your catalog selling price'
      : 'Copy this product to your catalog';

  const metaItems = [
    sku ? { key: 'sku', label: 'SKU', value: sku } : null,
    barcode ? { key: 'barcode', label: 'Barcode', value: barcode } : null,
    brand.name && brand.name !== '—' ? { key: 'brand', label: 'Brand', value: brand.name } : null,
    { key: 'category', label: 'Category', value: category.name || '—' },
  ].filter(Boolean);

  return (
    <article
      className={`bc-card bc-card--${viewMode}${selected && !alreadyMeToo ? ' is-selected' : ''}`}
    >
      <div className="bc-card-media">
        {selectable && !alreadyMeToo ? (
          <label
            className={`bc-card-select${selected ? ' is-checked' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              disabled={actionBusy || selectDisabled}
              onChange={() => onToggleSelect?.(id)}
              aria-label={selected ? `Deselect ${name}` : `Select ${name}`}
            />
          </label>
        ) : null}
        <ProductMediaImage
          image={image}
          placeholderLogoUrl={placeholderLogoUrl}
          name={name}
        />
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

      <div className="bc-card-body">
        <h3 className="bc-card-title" title={name}>
          {name}
        </h3>

        <div className="bc-card-meta">
          {metaItems.map((item) => (
            <span key={item.key} className="bc-card-meta-item">
              <span className="bc-card-meta-k">{item.label}</span>
              <span className="bc-card-meta-v">{item.value}</span>
            </span>
          ))}
        </div>

        {description && viewMode === 'list' ? (
          <p className="bc-card-desc">
            {description.slice(0, 140)}
            {description.length > 140 ? '…' : ''}
          </p>
        ) : null}

        <div className="bc-card-foot">
          <div className="bc-price-block">
            <span className="bc-price">{formatMoney(price)}</span>
            {compare != null ? <span className="bc-price-old">{formatMoney(compare)}</span> : null}
            {DEBUG ? (
              <span className="bc-price-debug" title="Price fields returned by the listing API">
                {bigCommercePrice != null
                  ? `bigcommerce_price ${bigCommercePrice}`
                  : `bigcommerce_price missing · ${
                      describeProductPriceFields(product).join(', ') || 'no price fields'
                    }`}
              </span>
            ) : null}
          </div>
          <span className={`bc-stock-pill is-${stockTone(stock)}`}>
            {stockLabel(stock)}
          </span>
        </div>

        {description && viewMode === 'grid' ? (
          <p className="bc-card-desc bc-card-desc--clamp">{description}</p>
        ) : null}

        <div className="bc-card-actions">
          {showMeToo ? (
            <div className="bc-card-cta">
              <button
                type="button"
                className={`bc-btn ${alreadyMeToo ? 'bc-btn-me-too-done' : 'bc-btn-primary'}${
                  locked ? ' is-locked' : ''
                }`}
                disabled={actionBusy && !locked}
                aria-disabled={locked || actionBusy}
                onClick={() => onMeToo?.(product)}
                title={meTooTitle}
              >
                {alreadyMeToo ? <FaTag aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                {meTooBusy ? 'Copying…' : alreadyMeToo ? 'Set price' : 'Me too'}
              </button>
              {showReset ? (
                <button
                  type="button"
                  className={`bc-icon-btn${locked ? ' is-locked' : ''}`}
                  disabled={actionBusy && !locked}
                  aria-disabled={locked || actionBusy}
                  onClick={() => onResetMeToo?.(product)}
                  title={manageTitle || 'Overwrite your copy from the origin product'}
                  aria-label={resetBusy ? 'Resetting' : 'Reset from origin'}
                >
                  <FaRotateLeft aria-hidden="true" />
                </button>
              ) : null}
              {showDelete ? (
                <button
                  type="button"
                  className={`bc-icon-btn bc-icon-btn--danger${locked ? ' is-locked' : ''}`}
                  disabled={actionBusy && !locked}
                  aria-disabled={locked || actionBusy}
                  onClick={() => onDeleteMeToo?.(product)}
                  title={manageTitle || 'Remove this product from your catalog'}
                  aria-label={deleteBusy ? 'Removing' : 'Delete from catalog'}
                >
                  <FaTrash aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}
          {onQuickView || detailsHref ? (
            <div className="bc-card-links">
              {onQuickView ? (
                <button
                  type="button"
                  className="bc-btn bc-btn-ghost bc-card-quick-view"
                  onClick={() => onQuickView(id, product)}
                >
                  Quick view
                </button>
              ) : null}
              {detailsHref ? (
                <Link
                  to={detailsHref}
                  className="bc-btn bc-btn-ghost bc-card-details"
                  onClick={() => onDetailsNavigate?.()}
                >
                  View details
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton({ viewMode = 'grid' }) {
  return (
    <div className={`bc-card bc-card--${viewMode} bc-card--skeleton`} aria-hidden="true">
      <div className="bc-card-media bc-skeleton" />
      <div className="bc-card-body">
        <div className="bc-skeleton bc-skeleton-line w-80" />
        <div className="bc-skeleton bc-skeleton-line w-50" />
        <div className="bc-skeleton bc-skeleton-line w-40" />
        <div className="bc-card-actions">
          <div className="bc-skeleton bc-skeleton-line bc-skeleton-btn" />
          <div className="bc-card-links">
            <div className="bc-skeleton bc-skeleton-line bc-skeleton-btn" />
            <div className="bc-skeleton bc-skeleton-line bc-skeleton-btn" />
          </div>
        </div>
      </div>
    </div>
  );
}
