import AppModal from '../AppModal.jsx';
import {
  getProductBrand,
  getProductCategory,
  getProductName,
  productIdFromRecord,
} from '../../features/bigCommerce/marketplaceUtils.js';
import ProductDetailView, { ProductDetailActions } from './ProductDetailView.jsx';

function splitProductTitle(name) {
  const text = String(name || '').trim();
  if (!text) return { main: 'Product', variant: '' };
  const parts = text.split(/\s*\|\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return { main: parts[0], variant: parts.slice(1).join(' | ') };
  }
  return { main: text, variant: '' };
}

export default function ProductDetailModal({
  open,
  onClose,
  product,
  variations,
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
  detailsHref = '',
  detailsHrefForProduct,
  onDetailsNavigate,
}) {
  const name = getProductName(product);
  const { main: titleMain, variant: titleVariant } = splitProductTitle(name);
  const brand = getProductBrand(product);
  const category = getProductCategory(product);
  const currentHref =
    detailsHref ||
    (product && detailsHrefForProduct
      ? detailsHrefForProduct(productIdFromRecord(product))
      : '');
  const subtitle = loading
    ? undefined
    : titleVariant ||
      (brand.name !== '—' ? brand.name : category.name !== '—' ? category.name : undefined);

  return (
    <AppModal
      open={open}
      onClose={onClose}
      className="bc-qv-dialog"
      title={loading ? 'Loading product…' : titleMain}
      subtitle={subtitle}
      size="xl"
      footer={
        <ProductDetailActions
          product={product}
          loading={loading}
          onMeToo={onMeToo}
          onDeleteMeToo={onDeleteMeToo}
          onResetMeToo={onResetMeToo}
          meTooLoading={meTooLoading}
          meTooProductId={meTooProductId}
          deleteMeTooLoading={deleteMeTooLoading}
          deleteMeTooProductId={deleteMeTooProductId}
          resetMeTooLoading={resetMeTooLoading}
          resetMeTooProductId={resetMeTooProductId}
          hideMeToo={hideMeToo}
          meTooLocked={meTooLocked}
          alreadyMeTooIds={alreadyMeTooIds}
          detailsHref={currentHref}
          onClose={onClose}
        />
      }
    >
      <ProductDetailView
        product={product}
        variations={variations}
        related={related}
        loading={loading}
        onOpenRelated={onOpenRelated}
        onMeToo={onMeToo}
        onDeleteMeToo={onDeleteMeToo}
        onResetMeToo={onResetMeToo}
        meTooLoading={meTooLoading}
        meTooProductId={meTooProductId}
        deleteMeTooLoading={deleteMeTooLoading}
        deleteMeTooProductId={deleteMeTooProductId}
        resetMeTooLoading={resetMeTooLoading}
        resetMeTooProductId={resetMeTooProductId}
        hideMeToo={hideMeToo}
        meTooLocked={meTooLocked}
        alreadyMeTooIds={alreadyMeTooIds}
        placeholderLogoUrl={placeholderLogoUrl}
        variant="modal"
        detailsHrefForProduct={detailsHrefForProduct}
        onDetailsNavigate={onDetailsNavigate}
      />
    </AppModal>
  );
}
