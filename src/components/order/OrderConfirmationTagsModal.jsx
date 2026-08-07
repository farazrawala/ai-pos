import { useEffect, useMemo, useState } from 'react';
import {
  FaEnvelope,
  FaCommentSms,
  FaWhatsapp,
  FaPhone,
  FaCircleCheck,
} from 'react-icons/fa6';
import { updateOrderTagsRequest } from '../../features/orders/ordersAPI.js';
import NavIcon from '../NavIcon.jsx';
import './customerOrderHistoryModal.css';

export const ORDER_CONFIRMATION_TAG_OPTIONS = [
  {
    value: 'confirmed_by_email',
    label: 'Confirmed by email',
    icon: FaEnvelope,
  },
  {
    value: 'confirmed_by_sms',
    label: 'Confirmed by SMS',
    icon: FaCommentSms,
  },
  {
    value: 'confirmed_by_whatsapp',
    label: 'Confirmed by WhatsApp',
    icon: FaWhatsapp,
  },
  {
    value: 'confirmed_by_call',
    label: 'Confirmed by call',
    icon: FaPhone,
  },
];

export const ORDER_CONFIRMATION_TAG_VALUES = ORDER_CONFIRMATION_TAG_OPTIONS.map(
  (opt) => opt.value
);

export const normalizeOrderTags = (raw) => {
  const pushTag = (out, value) => {
    if (value == null) return;
    if (typeof value === 'string') {
      const tag = value.trim();
      if (tag) out.push(tag);
      return;
    }
    if (typeof value === 'object') {
      const tag = String(value.tag ?? value.name ?? value.value ?? value.key ?? '').trim();
      if (tag) out.push(tag);
    }
  };

  if (Array.isArray(raw)) {
    const out = [];
    for (const item of raw) pushTag(out, item);
    return [...new Set(out)];
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeOrderTags(parsed);
    } catch {
      // fall through — comma-separated
    }
    return [
      ...new Set(
        raw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    ];
  }
  return [];
};

/** Keep non-confirmation tags (e.g. incomplete_address) and apply selected confirmation tags. */
const mergeConfirmationTags = (currentTags, selectedConfirmationTags) => {
  const other = normalizeOrderTags(currentTags).filter(
    (tag) => !ORDER_CONFIRMATION_TAG_VALUES.includes(tag)
  );
  const selected = ORDER_CONFIRMATION_TAG_VALUES.filter((tag) =>
    selectedConfirmationTags.includes(tag)
  );
  return [...other, ...selected];
};

/**
 * Multi-select confirmation tags → PATCH order `tags`.
 */
export default function OrderConfirmationTagsModal({
  open,
  orderId,
  orderNo,
  currentTags = [],
  onClose,
  onSaved,
}) {
  const [selected, setSelected] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);

  const initialSelected = useMemo(() => {
    const tags = normalizeOrderTags(currentTags);
    return ORDER_CONFIRMATION_TAG_VALUES.filter((tag) => tags.includes(tag));
  }, [currentTags]);

  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
    setSaveStatus('idle');
    setSaveError(null);
  }, [open, orderId, initialSelected]);

  const toggleTag = (value) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!orderId) {
      setSaveError('Missing order id.');
      return;
    }

    setSaveStatus('loading');
    setSaveError(null);

    const nextTags = mergeConfirmationTags(currentTags, selected);

    try {
      const result = await updateOrderTagsRequest(orderId, { tags: nextTags });
      const savedTags = normalizeOrderTags(
        result?.data?.order?.tags ?? result?.data?.tags ?? result?.tags ?? nextTags
      );
      setSaveStatus('succeeded');
      onSaved?.({
        orderId,
        orderNo,
        tags: savedTags.length ? savedTags : nextTags,
      });
      onClose?.();
    } catch (err) {
      setSaveStatus('failed');
      setSaveError(err?.message || 'Failed to update confirmation tags.');
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === 'loading';

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="orderConfirmationTagsModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content coh-modal">
            <div className="modal-header coh-modal__header border-0 pb-0">
              <div className="d-flex align-items-start gap-3 min-width-0">
                <div className="coh-modal__icon" aria-hidden="true">
                  <NavIcon icon={FaCircleCheck} size={16} />
                </div>
                <div className="min-width-0">
                  <p className="coh-modal__eyebrow mb-1">Confirmation</p>
                  <h5
                    className="modal-title coh-modal__title mb-1 text-truncate"
                    id="orderConfirmationTagsModalLabel"
                    title={orderNo || 'Order'}
                  >
                    {orderNo || 'Order'}
                  </h5>
                  <p className="text-xs text-secondary mb-0">
                    Select how this order was confirmed. You can choose more than one.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isSaving}
              />
            </div>

            <div className="modal-body coh-modal__body pt-3">
              {saveError ? (
                <div className="alert alert-danger py-2 mb-3">{saveError}</div>
              ) : null}

              <div className="d-flex flex-column gap-2">
                {ORDER_CONFIRMATION_TAG_OPTIONS.map((opt) => {
                  const checked = selected.includes(opt.value);
                  const inputId = `order-confirm-tag-${opt.value}`;
                  return (
                    <label
                      key={opt.value}
                      htmlFor={inputId}
                      className={`coh-confirm-option ${checked ? 'is-selected' : ''}`}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="form-check-input m-0"
                        checked={checked}
                        disabled={isSaving}
                        onChange={() => toggleTag(opt.value)}
                      />
                      <span className="coh-confirm-option__icon" aria-hidden="true">
                        <NavIcon icon={opt.icon} size={14} />
                      </span>
                      <span className="coh-confirm-option__text">
                        <span className="coh-confirm-option__label">{opt.label}</span>
                        <span className="coh-confirm-option__value">{opt.value}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer coh-modal__footer border-0 pt-0">
              <button
                type="button"
                className="btn btn-outline-secondary mb-0"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary mb-0"
                onClick={handleSave}
                disabled={isSaving || !orderId}
              >
                {isSaving ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
