import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBoxesStacked,
  FaCheck,
  FaLayerGroup,
  FaPlus,
  FaRotate,
  FaTriangleExclamation,
  FaXmark,
} from 'react-icons/fa6';
import { formatMoney } from '../../utils/formatMoney.js';
import { parseVariationAttrs } from '../product/productVariationUtils.js';
import {
  getAlertQty,
  getProductBarcode,
  getProductBrand,
  getProductCategory,
  getProductDescription,
  getProductImages,
  getProductListingImage,
  getProductName,
  getProductPrice,
  getProductComparePrice,
  getProductSku,
  getProductStock,
  getProductVariations,
  getVariationLabel,
  formatProductDescriptionHtml,
  productIdFromRecord,
  isOutOfStock,
  isAlreadyMeTooProduct,
  LOW_STOCK_THRESHOLD,
} from '../../features/bigCommerce/marketplaceUtils.js';
import ProductCard, { ProductMediaImage } from './ProductCard.jsx';

function productUnit(product) {
  return String(product?.unit ?? product?.product_unit ?? '').trim();
}

function productTypeLabel(product) {
  return String(product?.product_type ?? product?.productType ?? '').trim();
}

function stockSnapshot(stock, item) {
  const qty = stock == null || !Number.isFinite(Number(stock)) ? null : Number(stock);
  const threshold = item ? getAlertQty(item) : LOW_STOCK_THRESHOLD;
  if (qty == null || qty <= 0) {
    return { key: 'out', label: 'Out of Stock', qty: qty == null ? 0 : qty };
  }
  if (qty > 0 && qty < threshold) {
    return { key: 'low', label: 'Low Stock', qty };
  }
  return { key: 'in', label: 'In Stock', qty };
}

function variationAttributes(variation) {
  const named = [];
  const raw =
    variation?.attributes ??
    variation?.variation_attributes ??
    variation?.variationAttributes ??
    variation?.options ??
    variation?.product_variations;

  const push = (label, value) => {
    const text = value == null ? '' : String(value).trim();
    if (!text) return;
    named.push({ label: String(label || '').trim(), value: text });
  };

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (entry == null) return;
      if (typeof entry === 'string' || typeof entry === 'number') {
        push('', entry);
        return;
      }
      if (typeof entry !== 'object') return;
      push(
        entry.name ?? entry.attribute ?? entry.key ?? entry.label,
        entry.value ?? entry.option ?? entry.attribute_value ?? entry.option_value
      );
    });
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => push(key, value));
  }

  if (named.length) return named;
  return parseVariationAttrs(variation?.product_name ?? variation?.name).map((value) => ({
    label: '',
    value,
  }));
}

function StockStatus({ snapshot, size = 'md', showQty = true }) {
  const Icon =
    snapshot.key === 'in' ? FaCheck : snapshot.key === 'low' ? FaTriangleExclamation : FaXmark;
  return (
    <span className={`bc-pdp-stock bc-pdp-stock--${snapshot.key} bc-pdp-stock--${size}`}>
      <Icon aria-hidden="true" />
      <span className="bc-pdp-stock-copy">
        <strong>{snapshot.label}</strong>
        {showQty ? (
          <em>
            {snapshot.qty} available
          </em>
        ) : null}
      </span>
    </span>
  );
}

function CatalogChip({ inCatalog }) {
  return inCatalog ? (
    <span className="bc-pdp-chip bc-pdp-chip--ok">
      <FaCheck aria-hidden="true" /> In your catalog
    </span>
  ) : (
    <span className="bc-pdp-chip">Not in catalog</span>
  );
}

export function ProductDetailActions({
  product,
  loading = false,
  onMeToo,
  onDeleteMeToo,
  onResetMeToo,
  meTooLoading = false,
  meTooProductId = '',
  deleteMeTooLoading = false,
  deleteMeTooProductId = '',
  resetMeTooLoading = false,
  resetMeTooProductId = '',
  hideMeToo = false,
  meTooLocked = false,
  alreadyMeTooIds,
  detailsHref = '',
  onClose,
  closeLabel = 'Close',
}) {
  const alreadyMeToo = isAlreadyMeTooProduct(product, alreadyMeTooIds);
  const meTooBusyForProduct =
    meTooLoading && (!meTooProductId || meTooProductId === productIdFromRecord(product));
  const deleteBusyForProduct =
    deleteMeTooLoading &&
    (!deleteMeTooProductId || deleteMeTooProductId === productIdFromRecord(product));
  const resetBusyForProduct =
    resetMeTooLoading &&
    (!resetMeTooProductId || resetMeTooProductId === productIdFromRecord(product));
  const actionBusy = meTooBusyForProduct || deleteBusyForProduct || resetBusyForProduct;
  const locked = Boolean(meTooLocked);
  const meTooTitle = locked
    ? 'Connect to this store first to copy products'
    : alreadyMeToo
      ? 'Update your catalog selling price'
      : 'Copy this product to your catalog';

  return (
    <>
      {!hideMeToo ? (
        <button
          type="button"
          className={`bc-btn ${alreadyMeToo ? 'bc-btn-me-too-done' : 'bc-btn-primary'}${
            locked ? ' is-locked' : ''
          }`}
          disabled={(loading || !product || actionBusy || !onMeToo) && !locked}
          aria-disabled={locked || loading || !product || actionBusy || !onMeToo}
          onClick={() => onMeToo?.(product)}
          title={meTooTitle}
        >
          {meTooBusyForProduct ? 'Copying…' : alreadyMeToo ? 'Set price' : 'Me too'}
        </button>
      ) : null}
      {!hideMeToo && alreadyMeToo && onResetMeToo ? (
        <button
          type="button"
          className={`bc-btn bc-btn-ghost${locked ? ' is-locked' : ''}`}
          disabled={(loading || !product || actionBusy) && !locked}
          aria-disabled={locked || loading || !product || actionBusy}
          onClick={() => onResetMeToo?.(product)}
          title={
            locked
              ? 'Connect to this store first to manage Me too products'
              : 'Overwrite your copy from the origin product'
          }
        >
          {resetBusyForProduct ? 'Resetting…' : 'Reset Me too'}
        </button>
      ) : null}
      {!hideMeToo && alreadyMeToo && onDeleteMeToo ? (
        <button
          type="button"
          className={`bc-btn bc-btn-danger-ghost${locked ? ' is-locked' : ''}`}
          disabled={(loading || !product || actionBusy) && !locked}
          aria-disabled={locked || loading || !product || actionBusy}
          onClick={() => onDeleteMeToo?.(product)}
          title={
            locked
              ? 'Connect to this store first to manage Me too products'
              : 'Remove this product from your catalog'
          }
        >
          {deleteBusyForProduct ? 'Removing…' : 'Delete'}
        </button>
      ) : null}
      {detailsHref ? (
        <Link to={detailsHref} className="bc-btn bc-btn-ghost" onClick={onClose}>
          View full details
        </Link>
      ) : null}
      {onClose ? (
        <button type="button" className="bc-btn bc-btn-ghost" onClick={onClose}>
          {closeLabel}
        </button>
      ) : null}
    </>
  );
}

function ProductPageActions({
  product,
  loading = false,
  onMeToo,
  onDeleteMeToo,
  onResetMeToo,
  meTooLoading = false,
  meTooProductId = '',
  deleteMeTooLoading = false,
  deleteMeTooProductId = '',
  resetMeTooLoading = false,
  resetMeTooProductId = '',
  hideMeToo = false,
  meTooLocked = false,
  alreadyMeTooIds,
}) {
  if (hideMeToo) return null;

  const alreadyMeToo = isAlreadyMeTooProduct(product, alreadyMeTooIds);
  const meTooBusyForProduct =
    meTooLoading && (!meTooProductId || meTooProductId === productIdFromRecord(product));
  const deleteBusyForProduct =
    deleteMeTooLoading &&
    (!deleteMeTooProductId || deleteMeTooProductId === productIdFromRecord(product));
  const resetBusyForProduct =
    resetMeTooLoading &&
    (!resetMeTooProductId || resetMeTooProductId === productIdFromRecord(product));
  const actionBusy = meTooBusyForProduct || deleteBusyForProduct || resetBusyForProduct;
  const locked = Boolean(meTooLocked);

  return (
    <div className="bc-pdp-actions">
      {alreadyMeToo ? (
        <>
          <CatalogChip inCatalog />
          <button
            type="button"
            className={`bc-btn bc-btn-primary${locked ? ' is-locked' : ''}`}
            disabled={(loading || !product || actionBusy || !onMeToo) && !locked}
            aria-disabled={locked || loading || !product || actionBusy || !onMeToo}
            onClick={() => onMeToo?.(product)}
            title={
              locked
                ? 'Connect to this store first to copy products'
                : 'Update your catalog selling price'
            }
          >
            {meTooBusyForProduct ? 'Updating…' : 'Set price'}
          </button>
          {onResetMeToo ? (
            <button
              type="button"
              className={`bc-btn bc-btn-ghost${locked ? ' is-locked' : ''}`}
              disabled={(loading || !product || actionBusy) && !locked}
              aria-disabled={locked || loading || !product || actionBusy}
              onClick={() => onResetMeToo?.(product)}
              title={
                locked
                  ? 'Connect to this store first to manage Me too products'
                  : 'Overwrite your copy from the origin product'
              }
            >
              <FaRotate aria-hidden="true" />
              {resetBusyForProduct ? 'Resetting…' : 'Reset Me too'}
            </button>
          ) : null}
          {onDeleteMeToo ? (
            <button
              type="button"
              className={`bc-pdp-delete${locked ? ' is-locked' : ''}`}
              disabled={(loading || !product || actionBusy) && !locked}
              aria-disabled={locked || loading || !product || actionBusy}
              onClick={() => onDeleteMeToo?.(product)}
              title={
                locked
                  ? 'Connect to this store first to manage Me too products'
                  : 'Remove this product from your catalog'
              }
            >
              {deleteBusyForProduct ? 'Removing…' : 'Delete from catalog'}
            </button>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className={`bc-btn bc-btn-primary bc-pdp-me-too${locked ? ' is-locked' : ''}`}
          disabled={(loading || !product || actionBusy || !onMeToo) && !locked}
          aria-disabled={locked || loading || !product || actionBusy || !onMeToo}
          onClick={() => onMeToo?.(product)}
          title={
            locked
              ? 'Connect to this store first to copy products'
              : 'Copy this product to your catalog'
          }
        >
          <span className="bc-pdp-me-too-main">
            <FaPlus aria-hidden="true" />
            {meTooBusyForProduct ? 'Adding…' : 'Me too'}
          </span>
          <small>Add this product to my catalog</small>
        </button>
      )}
    </div>
  );
}

function VariationActions({
  variation,
  hideMeToo,
  meTooLocked,
  alreadyMeToo,
  actionBusy,
  meTooBusy,
  onMeToo,
  detailsHref,
  onDetailsNavigate,
}) {
  const locked = Boolean(meTooLocked);
  return (
    <div className="bc-pdp-var-actions">
      {!hideMeToo && alreadyMeToo ? (
        <CatalogChip inCatalog />
      ) : null}
      {!hideMeToo && !alreadyMeToo ? (
        <button
          type="button"
          className={`bc-btn bc-btn-primary bc-btn-sm${locked ? ' is-locked' : ''}`}
          disabled={(actionBusy || !onMeToo) && !locked}
          aria-disabled={locked || actionBusy || !onMeToo}
          onClick={() => onMeToo?.(variation)}
          title={
            locked
              ? 'Connect to this store first to copy products'
              : 'Copy this variation to your catalog'
          }
        >
          <FaPlus aria-hidden="true" />
          {meTooBusy ? 'Adding…' : 'Me too'}
        </button>
      ) : null}
      {!hideMeToo && alreadyMeToo && onMeToo ? (
        <button
          type="button"
          className={`bc-btn bc-btn-ghost bc-btn-sm${locked ? ' is-locked' : ''}`}
          disabled={(actionBusy || !onMeToo) && !locked}
          aria-disabled={locked || actionBusy || !onMeToo}
          onClick={() => onMeToo?.(variation)}
          title={
            locked
              ? 'Connect to this store first to copy products'
              : 'Update your catalog selling price'
          }
        >
          {meTooBusy ? 'Updating…' : 'Set price'}
        </button>
      ) : null}
      {detailsHref ? (
        <Link
          to={detailsHref}
          className="bc-btn bc-btn-ghost bc-btn-sm"
          onClick={() => onDetailsNavigate?.()}
        >
          View
        </Link>
      ) : null}
    </div>
  );
}

function VariationBlock({
  variation,
  parent,
  parentName,
  placeholderLogoUrl,
  hideMeToo,
  meTooLocked,
  alreadyMeTooIds,
  meTooLoading,
  meTooProductId,
  onMeToo,
  detailsHrefForProduct,
  onDetailsNavigate,
  layout,
}) {
  const id = productIdFromRecord(variation);
  const label = getVariationLabel(variation, parentName);
  const attrs = variationAttributes(variation);
  const sku = getProductSku(variation);
  const barcode = getProductBarcode(variation);
  const price = getProductPrice(variation);
  const stock = getProductStock(variation);
  const snapshot = stockSnapshot(stock, variation);
  const alreadyMeToo = isAlreadyMeTooProduct(variation, alreadyMeTooIds);
  const meTooBusy = Boolean(meTooLoading && meTooProductId === id);
  const image = getProductListingImage(variation, { parent });
  const actionProps = {
    variation,
    hideMeToo,
    meTooLocked,
    alreadyMeToo,
    actionBusy: meTooBusy,
    meTooBusy,
    onMeToo,
    detailsHref: detailsHrefForProduct?.(id) || '',
    onDetailsNavigate,
  };

  if (layout === 'card') {
    return (
      <article className="bc-pdp-var-card">
        <div className="bc-pdp-var-card-media">
          <ProductMediaImage
            image={image}
            placeholderLogoUrl={placeholderLogoUrl}
            name={label}
            className="bc-pdp-var-img"
          />
        </div>
        <div className="bc-pdp-var-card-body">
          <h3>{label}</h3>
          {attrs.length ? (
            <div className="bc-pdp-attr-list">
              {attrs.map((attr, idx) => (
                <span key={`${attr.label}-${attr.value}-${idx}`} className="bc-pdp-attr">
                  {attr.label ? `${attr.label}: ${attr.value}` : attr.value}
                </span>
              ))}
            </div>
          ) : null}
          <div className="bc-pdp-var-card-meta">
            {sku ? (
              <span>
                SKU <strong>{sku}</strong>
              </span>
            ) : null}
            {barcode ? (
              <span>
                Barcode <strong>{barcode}</strong>
              </span>
            ) : null}
          </div>
          <div className="bc-pdp-var-card-foot">
            <span className="bc-pdp-var-price">{formatMoney(price)}</span>
            <StockStatus snapshot={snapshot} size="sm" />
          </div>
          <VariationActions {...actionProps} />
        </div>
      </article>
    );
  }

  return (
    <div className="bc-pdp-var-row" role="row">
      <div className="bc-pdp-var-product" role="cell">
        <ProductMediaImage
          image={image}
          placeholderLogoUrl={placeholderLogoUrl}
          name={label}
          className="bc-pdp-var-img"
        />
        <div>
          <strong>{label}</strong>
          {attrs.length ? (
            <div className="bc-pdp-attr-list">
              {attrs.map((attr, idx) => (
                <span key={`${attr.label}-${attr.value}-${idx}`} className="bc-pdp-attr">
                  {attr.label ? `${attr.label}: ${attr.value}` : attr.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div role="cell">
        {sku ? <div className="bc-pdp-code">{sku}</div> : <span className="bc-muted">—</span>}
        {barcode ? <div className="bc-pdp-code bc-pdp-code--sub">{barcode}</div> : null}
      </div>
      <div className="bc-pdp-var-price" role="cell">
        {formatMoney(price)}
      </div>
      <div role="cell">
        <StockStatus snapshot={snapshot} size="sm" />
      </div>
      <div role="cell">
        {!hideMeToo ? <CatalogChip inCatalog={alreadyMeToo} /> : <span className="bc-muted">—</span>}
      </div>
      <div role="cell">
        <VariationActions {...actionProps} />
      </div>
    </div>
  );
}

function ProductDetailSkeleton({ variant = 'modal' }) {
  const isPage = variant === 'page';
  return (
    <div className={isPage ? 'bc-pdp' : 'bc-detail-loading'} aria-hidden="true">
      {isPage ? (
        <>
          <div className="bc-skeleton bc-skeleton-line w-50" style={{ height: 18, marginBottom: 18 }} />
          <div className="bc-pdp-hero">
            <div className="bc-skeleton bc-pdp-skel-media" />
            <div className="bc-pdp-skel-copy">
              <div className="bc-skeleton bc-skeleton-line w-70" />
              <div className="bc-skeleton bc-skeleton-line w-40" />
              <div className="bc-skeleton bc-skeleton-line w-50" />
              <div className="bc-skeleton bc-skeleton-line w-90" />
              <div className="bc-skeleton bc-skeleton-line w-80" />
            </div>
          </div>
          <div className="bc-pdp-var-skel">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`var-sk-${idx}`} className="bc-skeleton bc-pdp-var-skel-row" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="bc-skeleton bc-detail-skel-media" />
          <div className="bc-detail-skel-copy">
            <div className="bc-skeleton bc-skeleton-line w-70" />
            <div className="bc-skeleton bc-skeleton-line w-50" />
            <div className="bc-skeleton bc-skeleton-line w-90" />
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductDetailView({
  product,
  variations: variationsProp,
  related = [],
  loading,
  onOpenRelated,
  onMeToo,
  onDeleteMeToo,
  onResetMeToo,
  meTooLoading = false,
  meTooProductId = '',
  deleteMeTooLoading = false,
  deleteMeTooProductId = '',
  resetMeTooLoading = false,
  resetMeTooProductId = '',
  hideMeToo = false,
  meTooLocked = false,
  alreadyMeTooIds,
  placeholderLogoUrl = '',
  variant = 'modal',
  detailsHrefForProduct,
  onDetailsNavigate,
  showInlineActions = false,
  storeName = '',
  storeHref = '',
}) {
  const [activeImage, setActiveImage] = useState(0);
  const isPage = variant === 'page';

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
  const description = formatProductDescriptionHtml(getProductDescription(product));
  const unit = productUnit(product);
  const productType = productTypeLabel(product);
  const isVariable = productType.toLowerCase() === 'variable';
  const productId = productIdFromRecord(product);

  const variations = useMemo(() => {
    if (Array.isArray(variationsProp) && variationsProp.length > 0) return variationsProp;
    return getProductVariations(product);
  }, [variationsProp, product]);

  const productWithVariations = useMemo(() => {
    if (!product) return product;
    if (!variations.length) return product;
    return { ...product, childproducts: variations };
  }, [product, variations]);

  const stock = getProductStock(productWithVariations);
  const alreadyMeToo = isAlreadyMeTooProduct(product, alreadyMeTooIds);

  const variationStats = useMemo(() => {
    if (!variations.length) return null;
    let total = 0;
    let hasAny = false;
    let available = 0;
    let out = 0;
    variations.forEach((item) => {
      const qty = getProductStock(item);
      if (qty != null && Number.isFinite(qty)) {
        total += qty;
        hasAny = true;
      }
      if (isOutOfStock(qty)) out += 1;
      else available += 1;
    });
    return {
      total: hasAny ? total : null,
      available,
      out,
      count: variations.length,
    };
  }, [variations]);

  const displayStock =
    (isVariable || variations.length > 0) && variationStats?.total != null
      ? variationStats.total
      : stock;
  const displaySnapshot = stockSnapshot(displayStock, productWithVariations);

  const specs = useMemo(() => {
    const rows = [];
    const push = (label, value) => {
      if (value == null || value === '') return;
      if (typeof value === 'number' && !Number.isFinite(value)) return;
      const text = String(value).trim();
      if (!text || text === '—') return;
      rows.push([label, text]);
    };
    push('Unit', unit);
    push('Product type', productType);
    push('SKU', sku);
    push('Barcode', barcode);
    push('Category', category.name);
    push('Brand', brand.name);
    const tax = product?.tax_rate ?? product?.taxRate;
    if (tax != null && Number(tax) !== 0) push('Tax rate', tax);
    if (product?.weight != null && Number(product.weight) !== 0) push('Weight', product.weight);
    push('Dimensions', product?.dimensions);
    if (product?.specifications && typeof product.specifications === 'object') {
      Object.entries(product.specifications).forEach(([key, value]) => {
        if (value == null || value === '' || Number(value) === 0) return;
        push(key, value);
      });
    }
    return rows;
  }, [product, unit, productType, sku, barcode, category.name, brand.name]);

  const priceRange = useMemo(() => {
    if (!variations.length) return null;
    let min = Infinity;
    let max = -Infinity;
    variations.forEach((item) => {
      const next = getProductPrice(item);
      if (!Number.isFinite(next)) return;
      min = Math.min(min, next);
      max = Math.max(max, next);
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min === max) return formatMoney(min);
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }, [variations]);

  const metaCards = [
    sku ? { label: 'SKU', value: sku } : null,
    barcode ? { label: 'Barcode', value: barcode } : null,
    productType ? { label: 'Type', value: productType } : null,
    unit ? { label: 'Unit', value: unit } : null,
  ].filter(Boolean);

  const actionProps = {
    product,
    loading,
    onMeToo,
    onDeleteMeToo,
    onResetMeToo,
    meTooLoading,
    meTooProductId,
    deleteMeTooLoading,
    deleteMeTooProductId,
    resetMeTooLoading,
    resetMeTooProductId,
    hideMeToo,
    meTooLocked,
    alreadyMeTooIds,
  };

  if (loading && !product) {
    return <ProductDetailSkeleton variant={variant} />;
  }

  if (!product) {
    return <p className="bc-muted">Product not found.</p>;
  }

  const variationShared = {
    parent: product,
    parentName: name,
    placeholderLogoUrl,
    hideMeToo,
    meTooLocked,
    alreadyMeTooIds,
    meTooLoading,
    meTooProductId,
    onMeToo,
    detailsHrefForProduct,
    onDetailsNavigate,
  };

  const summaryBody = (
    <>
      <div className="bc-pdp-price-row">
        <div className="bc-price-block bc-price-block--lg">
          <span className="bc-price">{priceRange || formatMoney(price)}</span>
          {compare != null && !priceRange ? (
            <span className="bc-price-old">{formatMoney(compare)}</span>
          ) : null}
        </div>
        <StockStatus snapshot={displaySnapshot} />
      </div>

      {isVariable || variations.length > 0 ? (
        <div className="bc-pdp-stock-board" aria-label="Variation stock summary">
          <div>
            <span>Total variation stock</span>
            <strong>{variationStats?.total ?? displaySnapshot.qty}</strong>
          </div>
          <div>
            <span>Available variations</span>
            <strong>{variationStats?.available ?? 0}</strong>
          </div>
          <div>
            <span>Out of stock</span>
            <strong>{variationStats?.out ?? 0}</strong>
          </div>
        </div>
      ) : (
        <p className="bc-pdp-stock-qty">
          Available stock <strong>{displaySnapshot.qty}</strong>
        </p>
      )}

      {metaCards.length > 0 ? (
        <div className="bc-pdp-info-grid">
          {metaCards.map((item) => (
            <div key={item.label} className="bc-pdp-info-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {showInlineActions && isPage ? <ProductPageActions {...actionProps} /> : null}

      {description ? (
        <div className="bc-pdp-section">
          <h3>About this product</h3>
          <div className="bc-detail-description">
            {description.split(/\n+/).map((para, idx) =>
              para.trim() ? <p key={`p-${idx}`}>{para.trim()}</p> : null
            )}
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <div className={isPage ? 'bc-pdp' : 'bc-detail'}>
      {isPage ? (
        <header className="bc-pdp-head">
          <nav className="bc-product-crumb" aria-label="Product breadcrumb">
            {storeHref ? <Link to={storeHref}>{storeName || 'Store catalog'}</Link> : null}
            {storeHref ? <span aria-hidden="true">/</span> : null}
            <span>{name}</span>
          </nav>
          <div className="bc-pdp-title-row">
            <div>
              <h1 className="bc-product-page-title">{name}</h1>
              <p className="bc-pdp-meta-line">
                <span>Marketplace product</span>
                {productId ? <span>ID {productId}</span> : null}
                {sku ? <span>SKU {sku}</span> : null}
                {category.name && category.name !== '—' ? <span>{category.name}</span> : null}
              </p>
            </div>
            <div className="bc-pdp-head-badges">
              {!hideMeToo ? <CatalogChip inCatalog={alreadyMeToo} /> : null}
              <span className={`bc-pdp-chip bc-pdp-chip--${displaySnapshot.key}`}>
                {displaySnapshot.key === 'in' ? (
                  <FaCheck aria-hidden="true" />
                ) : displaySnapshot.key === 'low' ? (
                  <FaTriangleExclamation aria-hidden="true" />
                ) : (
                  <FaXmark aria-hidden="true" />
                )}
                {displaySnapshot.label}
              </span>
            </div>
          </div>
        </header>
      ) : null}

      {isPage ? (
        <div className="bc-pdp-hero">
          <div className="bc-pdp-gallery">
            <div className="bc-detail-hero">
              <ProductMediaImage
                image={images[activeImage] || ''}
                placeholderLogoUrl={placeholderLogoUrl}
                name={name}
              />
            </div>
            {images.length > 1 ? (
              <div className="bc-thumbs">
                {images.map((src, idx) => (
                  <button
                    key={src}
                    type="button"
                    className={`bc-thumb ${idx === activeImage ? 'is-active' : ''}`}
                    onClick={() => setActiveImage(idx)}
                    aria-label={`Show image ${idx + 1}`}
                  >
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="bc-pdp-summary">{summaryBody}</div>
        </div>
      ) : (
        <>
          <div className="bc-detail-gallery">
            <div className="bc-detail-hero">
              <ProductMediaImage
                image={images[activeImage] || ''}
                placeholderLogoUrl={placeholderLogoUrl}
                name={name}
              />
            </div>
            {images.length > 1 ? (
              <div className="bc-thumbs">
                {images.map((src, idx) => (
                  <button
                    key={src}
                    type="button"
                    className={`bc-thumb ${idx === activeImage ? 'is-active' : ''}`}
                    onClick={() => setActiveImage(idx)}
                    aria-label={`Show image ${idx + 1}`}
                  >
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="bc-detail-info">{summaryBody}</div>
        </>
      )}

      {specs.length > 0 ? (
        <section className="bc-pdp-section bc-pdp-specs">
          <h3>Specifications</h3>
          <dl className="bc-pdp-spec-grid">
            {specs.map(([key, value]) => (
              <div key={key} className="bc-pdp-spec-cell">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {isVariable || variations.length > 0 ? (
        <section className="bc-pdp-section bc-pdp-variations">
          <div className="bc-pdp-section-head">
            <h3>
              <FaLayerGroup aria-hidden="true" /> Product variations
              {variations.length ? <span className="bc-pill">{variations.length}</span> : null}
            </h3>
            {isVariable ? <p>Variable product — stock is tracked on each child SKU.</p> : null}
          </div>

          {loading && variations.length === 0 ? (
            <div className="bc-pdp-var-skel">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`var-load-${idx}`} className="bc-skeleton bc-pdp-var-skel-row" />
              ))}
            </div>
          ) : variations.length > 0 ? (
            <>
              <div className="bc-pdp-var-table" role="table" aria-label="Product variations">
                <div className="bc-pdp-var-head" role="row">
                  <span role="columnheader">Product</span>
                  <span role="columnheader">SKU / Barcode</span>
                  <span role="columnheader">Price</span>
                  <span role="columnheader">Stock</span>
                  <span role="columnheader">Catalog</span>
                  <span role="columnheader">Action</span>
                </div>
                {variations.map((variation, idx) => (
                  <VariationBlock
                    key={productIdFromRecord(variation) || `var-${idx}`}
                    variation={variation}
                    layout="row"
                    {...variationShared}
                  />
                ))}
              </div>
              <div className="bc-pdp-var-cards">
                {variations.map((variation, idx) => (
                  <VariationBlock
                    key={`card-${productIdFromRecord(variation) || idx}`}
                    variation={variation}
                    layout="card"
                    {...variationShared}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="bc-pdp-empty">
              <FaBoxesStacked aria-hidden="true" />
              <strong>No variations available</strong>
              <p>This product currently has no child variations.</p>
            </div>
          )}
        </section>
      ) : null}

      {related.length > 0 ? (
        <div className="bc-related">
          <h4>You may also like</h4>
          <div className="bc-related-grid">
            {related.map((item) => {
              const relatedId = productIdFromRecord(item);
              return (
                <ProductCard
                  key={relatedId}
                  product={item}
                  viewMode="grid"
                  placeholderLogoUrl={placeholderLogoUrl}
                  onQuickView={onOpenRelated ? (id) => onOpenRelated(id) : undefined}
                  detailsHref={detailsHrefForProduct?.(relatedId) || ''}
                  onDetailsNavigate={onDetailsNavigate}
                  onMeToo={onMeToo}
                  onDeleteMeToo={onDeleteMeToo}
                  onResetMeToo={onResetMeToo}
                  meTooLoading={meTooLoading && meTooProductId === relatedId}
                  deleteMeTooLoading={deleteMeTooLoading && deleteMeTooProductId === relatedId}
                  resetMeTooLoading={resetMeTooLoading && resetMeTooProductId === relatedId}
                  hideMeToo={hideMeToo}
                  meTooLocked={meTooLocked}
                  alreadyMeTooIds={alreadyMeTooIds}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
