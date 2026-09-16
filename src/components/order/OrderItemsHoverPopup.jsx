import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchDeletedOrderForInvoiceRequest,
  fetchOrderForInvoiceRequest,
  getOrderLineItems,
  pickInvoiceRouteId,
} from '../../features/orders/ordersAPI.js';
import { computeOrderFinancials } from '../../features/orders/orderExportMapper.js';
import { formatMoney } from '../../utils/formatMoney.js';
import './order-items-hover-popup.css';

const CLOSE_DELAY_MS = 120;
const itemsCache = new Map();
const EMPTY_FINANCIALS = {
  subtotal: 0,
  discount: 0,
  shipping: 0,
  orderTotal: 0,
};

function cacheKey(orderId, deleted) {
  return `${deleted ? 'd' : 'a'}:${orderId}`;
}

function buildPopupPayload(order) {
  const lines = normalizeLines(order);
  const financials = computeOrderFinancials(order, lines);
  return { lines, financials };
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function lineProductName(line) {
  const product = asRecord(line?.product_id);
  const name = String(
    product?.product_name ??
      product?.productName ??
      product?.name ??
      line?.name ??
      line?.product_name ??
      line?.productName ??
      ''
  ).trim();
  return name || 'Item';
}

function lineSku(line) {
  const product = asRecord(line?.product_id);
  return String(
    product?.sku ?? product?.product_code ?? product?.productCode ?? line?.sku ?? line?.product_code ?? ''
  ).trim();
}

function lineQty(line) {
  const raw = line?.qty ?? line?.quantity ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return 0;
  return n;
}

function linePrice(line) {
  const raw = line?.price ?? line?.rate ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatQtyLabel(qty) {
  if (!Number.isFinite(qty)) return '—';
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
}

function normalizeLines(order) {
  return getOrderLineItems(order)
    .filter((line) => line && typeof line === 'object')
    .map((line, index) => {
      const qty = lineQty(line);
      const price = linePrice(line);
      return {
        key: String(line._id ?? line.id ?? `${index}-${lineProductName(line)}`),
        name: lineProductName(line),
        sku: lineSku(line),
        qty,
        price,
        total: qty * price,
      };
    });
}

function linesLookComplete(lines, expectedCount) {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  if (!Number.isFinite(expectedCount) || expectedCount <= 0) return true;
  return lines.length >= expectedCount;
}

/**
 * Hover trigger that shows a floating popup listing order line items.
 * Uses embedded `order_items` when present; otherwise fetches order detail once and caches it.
 */
export default function OrderItemsHoverPopup({
  order,
  itemsCount,
  deleted = false,
  children,
}) {
  const popupId = useId();
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const closeTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: false });
  const [lines, setLines] = useState([]);
  const [financials, setFinancials] = useState(EMPTY_FINANCIALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orderId = pickInvoiceRouteId(order);
  const expectedCount =
    typeof itemsCount === 'number' ? itemsCount : parseInt(String(itemsCount ?? ''), 10);

  const applyPayload = useCallback((payload) => {
    setLines(payload.lines);
    setFinancials(payload.financials || EMPTY_FINANCIALS);
  }, []);

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
    const popupWidth = 320;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 280 && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(8, rect.right - popupWidth),
      window.innerWidth - popupWidth - 8
    );
    setCoords({
      top: placeAbove ? rect.top - gap : rect.bottom + gap,
      left,
      placeAbove,
    });
  }, []);

  const loadLines = useCallback(async () => {
    const embedded = buildPopupPayload(order);
    if (linesLookComplete(embedded.lines, expectedCount)) {
      applyPayload(embedded);
      setError('');
      setLoading(false);
      if (orderId) itemsCache.set(cacheKey(orderId, deleted), embedded);
      return;
    }

    if (!orderId) {
      applyPayload(embedded);
      setError(embedded.lines.length ? '' : 'No items available');
      setLoading(false);
      return;
    }

    const cached = itemsCache.get(cacheKey(orderId, deleted));
    if (cached?.lines?.length) {
      applyPayload(cached);
      setError('');
      setLoading(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const full = deleted
        ? await fetchDeletedOrderForInvoiceRequest(orderId)
        : await fetchOrderForInvoiceRequest(orderId);
      if (reqId !== requestIdRef.current) return;
      const next = buildPopupPayload(full || order);
      itemsCache.set(cacheKey(orderId, deleted), next);
      applyPayload(next);
      if (!next.lines.length) setError('No items found');
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      applyPayload(embedded);
      setError(embedded.lines.length ? '' : err?.message || 'Could not load items');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [applyPayload, deleted, expectedCount, order, orderId]);

  const openPopup = useCallback(() => {
    clearCloseTimer();
    updatePosition();
    setOpen(true);
    void loadLines();
  }, [clearCloseTimer, loadLines, updatePosition]);

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
      requestIdRef.current += 1;
    },
    [clearCloseTimer]
  );

  const label =
    children ??
    `${Number.isFinite(expectedCount) ? expectedCount : itemsCount ?? '—'} items`;

  const popup =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popupRef}
            id={popupId}
            className={`oms-items-hover-popup${
              coords.placeAbove ? ' oms-items-hover-popup--above' : ''
            }`}
            style={{ top: coords.top, left: coords.left }}
            role="tooltip"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="oms-items-hover-popup__head">Order items</div>
            {loading ? (
              <div className="oms-items-hover-popup__state text-muted">Loading…</div>
            ) : error && !lines.length ? (
              <div className="oms-items-hover-popup__state text-danger">{error}</div>
            ) : lines.length ? (
              <>
                <ul className="oms-items-hover-popup__list">
                  {lines.map((line) => (
                    <li key={line.key} className="oms-items-hover-popup__row">
                      <div className="oms-items-hover-popup__main">
                        <div className="oms-items-hover-popup__name" title={line.name}>
                          {line.name}
                        </div>
                        {line.sku ? (
                          <div className="oms-items-hover-popup__sku">{line.sku}</div>
                        ) : null}
                      </div>
                      <div className="oms-items-hover-popup__meta">
                        <span className="oms-items-hover-popup__qty">
                          ×{formatQtyLabel(line.qty)}
                        </span>
                        <span className="oms-items-hover-popup__line-total">
                          {formatMoney(line.total)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="oms-items-hover-popup__summary">
                  <div className="oms-items-hover-popup__summary-row">
                    <span>Discount</span>
                    <span>{formatMoney(financials.discount)}</span>
                  </div>
                  <div className="oms-items-hover-popup__summary-row">
                    <span>Delivery</span>
                    <span>{formatMoney(financials.shipping)}</span>
                  </div>
                  <div className="oms-items-hover-popup__summary-row oms-items-hover-popup__summary-row--total">
                    <span>Total</span>
                    <span>{formatMoney(financials.orderTotal)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="oms-items-hover-popup__state text-muted">No items</div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="oms-items-hover-trigger"
        aria-describedby={open ? popupId : undefined}
        aria-expanded={open}
        onMouseEnter={openPopup}
        onMouseLeave={scheduleClose}
        onFocus={openPopup}
        onBlur={scheduleClose}
      >
        {label}
      </button>
      {popup}
    </>
  );
}
