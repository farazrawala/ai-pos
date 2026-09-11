import AppModal from '../AppModal.jsx';
import {
  getProductBrand,
  getProductCategory,
  getProductName,
  productIdFromRecord,
} from '../../features/bigCommerce/marketplaceUtils.js';
import ProductDetailView, { ProductDetailActions } from './ProductDetailView.jsx';

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
  const brand = getProductBrand(product);
  const category = getProductCategory(product);
  const currentHref =
    detailsHref ||
    (product && detailsHrefForProduct
      ? detailsHrefForProduct(productIdFromRecord(product))
      : '');

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={loading ? 'Loading product…' : name}
      subtitle={brand.name !== '—' ? brand.name : category.name !== '—' ? category.name : undefined}
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
