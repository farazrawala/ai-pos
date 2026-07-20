import { formatMoney } from '../../utils/formatMoney.js';
import {
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
  productIdFromRecord,
} from '../../features/bigCommerce/marketplaceUtils.js';

export default function ProductCard({ product, viewMode = 'grid', onViewDetails }) {
  const id = productIdFromRecord(product);
  const name = getProductName(product);
  const image = getProductListingImage(product);
  const price = getProductPrice(product);
  const compare = getProductComparePrice(product);
  const sku = getProductSku(product);
  const barcode = getProductBarcode(product);
  const brand = getProductBrand(product);
  const category = getProductCategory(product);
  const stock = getProductStock(product);
  const description = getProductDescription(product);
  const badges = getProductBadges(product);

  return (
    <article className={`bc-card bc-card--${viewMode}`}>
      <div className="bc-card-media">
        {image ? (
          <img src={image} alt={name} loading="lazy" className="bc-card-img" />
        ) : (
          <div className="bc-card-img bc-card-img--empty" aria-hidden="true">
            No image
          </div>
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

      <div className="bc-card-body">
        <h3 className="bc-card-title" title={name}>
          {name}
        </h3>

        <div className="bc-card-meta">
          {sku ? <span>SKU: {sku}</span> : null}
          {barcode ? <span>Barcode: {barcode}</span> : null}
          <span>Brand: {brand.name}</span>
          <span>Category: {category.name}</span>
        </div>

        {description && viewMode === 'list' ? (
          <p className="bc-card-desc">{description.slice(0, 140)}{description.length > 140 ? '…' : ''}</p>
        ) : null}

        <div className="bc-card- bid">
          <div className="bc-price-block">
            <span className="bc-price">{formatMoney(price)}</span>
            {compare != null ? <span className="bc-price-old">{formatMoney(compare)}</span> : null}
          </div>
          <div className="bc-stock-rating">
            <span className={`bc-stock ${stock === 0 ? 'is-out' : ''}`}>
              Stock: {stock == null ? '—' : stock}
            </span>
          </div>
        </div>

        {description && viewMode === 'grid' ? (
          <p className="bc-card-desc bc-card-desc--clamp">{description}</p>
        ) : null}

        <div className="bc-card-actions">
          <button type="button" className="bc-btn bc-btn-primary" onClick={() => onViewDetails?.(id, product)}>
            View Details
          </button>
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
      </div>
    </div>
  );
}
