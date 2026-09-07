import { useEffect, useMemo, useState } from 'react';
import AppModal from '../AppModal.jsx';
import { formatMoney } from '../../utils/formatMoney.js';
import {
  getProductName,
  getProductPrice,
} from '../../features/bigCommerce/marketplaceUtils.js';

const ME_TOO_PRICE_MULTIPLIERS = [1.5, 2, 3, 4];

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function multiplierLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value}X`;
  return `${n}X`;
}

export default function MeTooPriceModal({
  open,
  product,
  loading = false,
  onClose,
  onConfirm,
}) {
  const originPrice = roundMoney(getProductPrice(product));
  const [mode, setMode] = useState('1.5');
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode(originPrice > 0 ? '1.5' : 'custom');
    setCustomPrice(originPrice > 0 ? String(originPrice) : '');
  }, [open, originPrice, product]);

  const sellingPrice = useMemo(() => {
    if (mode === 'custom') return roundMoney(customPrice);
    return roundMoney(originPrice * Number(mode));
  }, [mode, customPrice, originPrice]);

  const canConfirm = sellingPrice > 0 && !loading && Boolean(product);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.({
      price: sellingPrice,
      multiplier: mode === 'custom' ? null : Number(mode),
    });
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Me too"
      subtitle={sellingPrice > 0 ? formatMoney(sellingPrice) : undefined}
      size="sm"
      ariaLabelledBy="me-too-price-modal-title"
      disableBackdropClose={loading}
      footer={
        <>
          <button
            type="button"
            className="bc-btn bc-btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bc-btn bc-btn-primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {loading ? 'Copying…' : 'Confirm'}
          </button>
        </>
      }
    >
      <form
        className="bc-metoo-price"
        onSubmit={(e) => {
          e.preventDefault();
          handleConfirm();
        }}
      >
        {product ? (
          <p className="bc-metoo-price-product">{getProductName(product)}</p>
        ) : null}
        <div className="bc-metoo-price-origin">
          <span className="bc-metoo-price-label">Vendor price</span>
          <strong className="bc-metoo-price-value">{formatMoney(originPrice)}</strong>
          <p className="bc-metoo-price-note">Vendor price will not be affected.</p>
        </div>

        <fieldset className="bc-metoo-price-options">
          <legend className="bc-metoo-price-label">Your selling price</legend>
          <div className="bc-metoo-price-multipliers">
            {ME_TOO_PRICE_MULTIPLIERS.map((value) => {
              const key = String(value);
              const preview = roundMoney(originPrice * value);
              return (
                <button
                  key={key}
                  type="button"
                  className={`bc-metoo-price-chip${mode === key ? ' is-active' : ''}`}
                  onClick={() => setMode(key)}
                  disabled={loading}
                >
                  <span>{multiplierLabel(value)}</span>
                  <small>{formatMoney(preview)}</small>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={`bc-metoo-price-chip bc-metoo-price-chip--custom${mode === 'custom' ? ' is-active' : ''}`}
            onClick={() => setMode('custom')}
            disabled={loading}
          >
            <span>Custom</span>
            <small>Set your price</small>
          </button>
        </fieldset>

        {mode === 'custom' ? (
          <label className="bc-metoo-price-custom">
            <span className="bc-metoo-price-label">Custom price</span>
            <input
              className="bc-input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Enter price"
              value={customPrice}
              disabled={loading}
              onChange={(e) => setCustomPrice(e.target.value)}
              autoFocus
            />
          </label>
        ) : null}

        <div className="bc-metoo-price-summary">
          <span>You will add this product at</span>
          <strong>{sellingPrice > 0 ? formatMoney(sellingPrice) : '—'}</strong>
        </div>
      </form>
    </AppModal>
  );
}
