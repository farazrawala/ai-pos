import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './order-address-hover-popup.css';

const CLOSE_DELAY_MS = 120;

function trimField(value) {
  return String(value ?? '').trim();
}

/** Street / free-text address without city/state appended. */
export function getOrderStreetAddress(row) {
  if (!row || typeof row !== 'object') return '';
  const direct = trimField(row.address ?? row.shipping_address ?? row.shippingAddress);
  if (direct) return direct;
  return [row.address_line1, row.address_line2].map(trimField).filter(Boolean).join(', ');
}

export function getOrderAddressParts(row) {
  if (!row || typeof row !== 'object') {
    return { address: '', city: '', state: '' };
  }
  return {
    address: getOrderStreetAddress(row),
    city: trimField(row.city),
    state: trimField(row.state),
  };
}

/**
 * Hover trigger that shows address / city / state in a floating popup.
 */
export default function OrderAddressHoverPopup({ order, children }) {
  const popupId = useId();
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: false });

  const parts = getOrderAddressParts(order);
  const hasAny = Boolean(parts.address || parts.city || parts.state);
  const triggerLabel =
    children ??
    (parts.address || parts.city || parts.state || '—');

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popupWidth = 280;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 160 && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - popupWidth - 8
    );
    setCoords({
      top: placeAbove ? rect.top - gap : rect.bottom + gap,
      left,
      placeAbove,
    });
  }, []);

  const openPopup = useCallback(() => {
    if (!hasAny) return;
    clearCloseTimer();
    updatePosition();
    setOpen(true);
  }, [clearCloseTimer, hasAny, updatePosition]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return undefined;

    const onScrollOrResize = () => {
      updatePosition();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, updatePosition]);

  useEffect(
    () => () => {
      clearCloseTimer();
    },
    [clearCloseTimer]
  );

  if (!hasAny) {
    return <span className="text-muted">—</span>;
  }

  const popup =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={popupId}
            className={`oms-address-hover-popup${
              coords.placeAbove ? ' oms-address-hover-popup--above' : ''
            }`}
            style={{ top: coords.top, left: coords.left }}
            role="tooltip"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="oms-address-hover-popup__head">Address</div>
            <dl className="oms-address-hover-popup__list">
              <div className="oms-address-hover-popup__row">
                <dt>address</dt>
                <dd>{parts.address || '—'}</dd>
              </div>
              <div className="oms-address-hover-popup__row">
                <dt>city</dt>
                <dd>{parts.city || '—'}</dd>
              </div>
              <div className="oms-address-hover-popup__row">
                <dt>state</dt>
                <dd>{parts.state || '—'}</dd>
              </div>
            </dl>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="oms-address-hover-trigger"
        aria-describedby={open ? popupId : undefined}
        aria-expanded={open}
        onMouseEnter={openPopup}
        onMouseLeave={scheduleClose}
        onFocus={openPopup}
        onBlur={scheduleClose}
      >
        <span className="oms-address-hover-trigger__text">{triggerLabel}</span>
      </button>
      {popup}
    </>
  );
}
