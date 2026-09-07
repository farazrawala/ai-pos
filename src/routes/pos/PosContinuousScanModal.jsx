import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaBarcode,
  FaCameraRotate,
  FaCartShopping,
  FaChevronLeft,
  FaCircleCheck,
  FaMinus,
  FaPlus,
  FaXmark,
} from 'react-icons/fa6';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import NavIcon from '../../components/NavIcon.jsx';
import { getProductListingImage } from '../../features/bigCommerce/marketplaceUtils.js';
import { sellablePosProductId } from '../../components/product/productVariationUtils.js';
import { formatMoney } from '../../utils/formatMoney.js';
import { openAppPathInNewTab, withBase } from '../../config/appBase.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const SCANNER_ELEMENT_ID = 'pos-continuous-barcode-reader';
/** Ignore the same code briefly so one barcode isn't added many times. */
const SAME_CODE_COOLDOWN_MS = 850;
/** Brief lock after any successful add so the camera can settle. */
const AFTER_ADD_PAUSE_MS = 280;

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

function pickCameraForFacing(cameras, facing) {
  const list = Array.isArray(cameras) ? cameras : [];
  if (!list.length) return null;
  if (facing === 'user') {
    return (
      list.find((c) => /front|user|face/i.test(String(c.label || ''))) || list[0]
    );
  }
  return (
    list.find((c) => /back|rear|environment/i.test(String(c.label || ''))) ||
    list[list.length - 1]
  );
}

function buildScanConfig() {
  return {
    fps: 10,
    qrbox: (viewW, viewH) => {
      const side = Math.min(Math.floor(viewW * 0.86), Math.floor(viewH * 0.42), 320);
      return { width: Math.max(180, side), height: Math.max(100, Math.floor(side * 0.55)) };
    },
    aspectRatio: 1.777,
    disableFlip: false,
  };
}

function scanStatusOf(result) {
  if (result && typeof result === 'object') return result.status;
  return result;
}

function parseScanQty(raw) {
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatScanQty(raw) {
  const n = parseScanQty(raw);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function productIdOf(product) {
  return sellablePosProductId(product) || '';
}

function productNameOf(product) {
  return product?.name || product?.product_name || 'Product';
}

function productSkuOf(product) {
  return String(product?.sku || product?.product_code || '').trim();
}

function productBarcodeOf(product, fallback = '') {
  return String(product?.barcode || fallback || '').trim();
}

function productPriceOf(product, fallback = 0) {
  const v = product?.price ?? product?.product_price ?? fallback;
  if (v == null || v === '') return Number(fallback) || 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : Number(fallback) || 0;
}

function buildScanMeta(product, code = '') {
  if (!product) return null;
  const productId = productIdOf(product);
  if (!productId) return null;
  return {
    productId,
    name: productNameOf(product),
    sku: productSkuOf(product),
    barcode: productBarcodeOf(product, code),
    image: getProductListingImage(product) || '',
    price: productPriceOf(product),
  };
}

function lightHaptic() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* unsupported */
  }
}

function ScanQtyControl({ quantity, name, onMinus, onPlus }) {
  return (
    <div className="pos-scan-qty" role="group" aria-label={`Quantity for ${name}`}>
      <button
        type="button"
        className="pos-scan-qty__btn"
        aria-label={`Decrease quantity of ${name}`}
        onClick={onMinus}
      >
        <FaMinus aria-hidden />
      </button>
      <span className="pos-scan-qty__value">{formatScanQty(quantity)}</span>
      <button
        type="button"
        className="pos-scan-qty__btn pos-scan-qty__btn--plus"
        aria-label={`Increase quantity of ${name}`}
        onClick={onPlus}
      >
        <FaPlus aria-hidden />
      </button>
    </div>
  );
}

function ScanProductThumb({ src, fallbackSrc, name }) {
  const candidates = [src, fallbackSrc]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [src, fallbackSrc]);
  const current = candidates[idx];
  return (
    <div className="pos-scan-thumb" aria-hidden="true">
      {current ? (
        <img
          src={current}
          alt=""
          className={idx > 0 ? 'pos-scan-thumb--logo' : undefined}
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <span>{String(name || '?').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

/**
 * Full-screen continuous camera barcode scanner for mobile POS.
 * Keeps scanning and calling onScan until the user presses Stop / Close.
 * Defaults to rear camera; Flip switches to front and back.
 * Cart quantity uses the parent POS cart — this is display + controls only.
 */
export default function PosContinuousScanModal({
  open,
  onClose,
  onScan,
  cartLines = [],
  cartSubtotal = 0,
  cartTotalQty = 0,
  onBumpCartQty,
  onCheckout,
  checkoutBusy = false,
  companyLogoUrl = '',
}) {
  const { canCreate: canCreateProduct } = usePermissions('products');
  const [cameraError, setCameraError] = useState('');
  const [starting, setStarting] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [canFlip, setCanFlip] = useState(false);
  const [continuousOn, setContinuousOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const [lastStatus, setLastStatus] = useState('');
  const [lastProductId, setLastProductId] = useState('');
  const [flashKey, setFlashKey] = useState(0);
  const [scanMeta, setScanMeta] = useState({});
  const [notFoundCode, setNotFoundCode] = useState('');

  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const continuousRef = useRef(true);
  const lastCodeRef = useRef({ code: '', at: 0 });
  const onScanRef = useRef(onScan);
  const camerasRef = useRef([]);
  onScanRef.current = onScan;
  continuousRef.current = continuousOn;
  pausedRef.current = paused;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      /* already stopped */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const handleStop = useCallback(async () => {
    await stopScanner();
    onClose?.();
  }, [onClose, stopScanner]);

  const handleFlip = useCallback(() => {
    if (starting || flipping || cameraError) return;
    setFlipping(true);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, [starting, flipping, cameraError]);

  const resumeScanning = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const handleToggleContinuous = useCallback(() => {
    setContinuousOn((prev) => {
      const next = !prev;
      continuousRef.current = next;
      if (next) {
        pausedRef.current = false;
        setPaused(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setFacingMode('environment');
      setCanFlip(false);
      setFlipping(false);
      return undefined;
    }

    let cancelled = false;
    setCameraError('');
    setStarting(true);
    if (!flipping) {
      setLastCode('');
      setLastStatus('');
      setLastProductId('');
      setNotFoundCode('');
      setPaused(false);
      pausedRef.current = false;
      setContinuousOn(true);
      continuousRef.current = true;
    }
    busyRef.current = false;
    lastCodeRef.current = { code: '', at: 0 };

    const start = async () => {
      await stopScanner();
      // Let the modal mount / remount the reader element.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;

      const onDetected = async (decodedText) => {
        const code = String(decodedText || '').trim();
        if (!code || busyRef.current || pausedRef.current) return;

        const now = Date.now();
        const last = lastCodeRef.current;
        if (last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS) return;

        busyRef.current = true;
        lastCodeRef.current = { code, at: now };
        setLastCode(code);
        setLookupBusy(true);
        setLastStatus('lookup');
        setNotFoundCode('');

        try {
          const result = await onScanRef.current?.(code);
          const status = scanStatusOf(result);
          const product = result && typeof result === 'object' ? result.product : null;
          const meta = buildScanMeta(product, code);

          if (status === 'added' && meta) {
            lightHaptic();
            setScanMeta((prev) => ({ ...prev, [meta.productId]: meta }));
            setLastProductId(meta.productId);
            setLastStatus('added');
            setFlashKey((k) => k + 1);
            if (!continuousRef.current) {
              pausedRef.current = true;
              setPaused(true);
            }
          } else if (status === 'blocked') {
            setLastStatus('blocked');
            if (meta) {
              setScanMeta((prev) => ({ ...prev, [meta.productId]: meta }));
              setLastProductId(meta.productId);
            }
          } else {
            setLastStatus('not_found');
            setNotFoundCode(code);
          }
        } catch {
          setLastStatus('error');
          setNotFoundCode(code);
        } finally {
          setLookupBusy(false);
          await new Promise((r) => setTimeout(r, AFTER_ADD_PAUSE_MS));
          busyRef.current = false;
        }
      };

      try {
        let cameras = camerasRef.current;
        if (!cameras.length) {
          cameras = await Html5Qrcode.getCameras();
          camerasRef.current = cameras || [];
        }
        if (cancelled) return;
        if (!cameras?.length) {
          setCameraError('No camera found on this device.');
          setStarting(false);
          setFlipping(false);
          return;
        }

        setCanFlip(cameras.length > 1);
        const preferred = pickCameraForFacing(cameras, facingMode);
        const config = buildScanConfig();
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
        });
        scannerRef.current = scanner;

        // Prefer facingMode constraint; fall back to an explicit device id.
        try {
          await scanner.start({ facingMode }, config, onDetected, () => {});
        } catch {
          if (!preferred?.id) throw new Error('Could not open camera.');
          await scanner.start(preferred.id, config, onDetected, () => {});
        }
        if (cancelled) {
          await stopScanner();
          return;
        }
        setStarting(false);
        setFlipping(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[POS] Continuous scan failed to start', err);
        setCameraError(
          err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access and try again.'
            : err?.message || 'Could not start the camera scanner.'
        );
        setStarting(false);
        setFlipping(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, facingMode, stopScanner]);

  useEffect(() => {
    if (!open) {
      camerasRef.current = [];
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const scanCartLines = useMemo(() => {
    const lines = Array.isArray(cartLines) ? [...cartLines] : [];
    lines.sort((a, b) => (Number(b.addedSeq) || 0) - (Number(a.addedSeq) || 0));
    return lines;
  }, [cartLines]);

  const lastLine = useMemo(
    () => scanCartLines.find((line) => line.productId === lastProductId) || null,
    [scanCartLines, lastProductId]
  );
  const lastMeta = lastProductId ? scanMeta[lastProductId] : null;

  const bumpQty = useCallback(
    (productId, delta) => {
      if (!productId) return;
      onBumpCartQty?.(productId, delta);
    },
    [onBumpCartQty]
  );

  const handleViewCart = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleCheckout = useCallback(() => {
    onClose?.();
    queueMicrotask(() => onCheckout?.());
  }, [onClose, onCheckout]);

  const handleAddMissingProduct = useCallback(() => {
    const code = String(notFoundCode || lastCode || '').trim();
    const path = code
      ? `/products/add?barcode=${encodeURIComponent(code)}`
      : '/products/add';
    setNotFoundCode('');
    openAppPathInNewTab(path);
  }, [notFoundCode, lastCode]);

  if (!open) return null;

  const cameraReady = !cameraError && !starting && !flipping;
  const uniqueCount = scanCartLines.length;
  const checkoutDisabled = checkoutBusy || uniqueCount < 1;
  const defaultImg = withBase('/assets/img/default.jpg');

  let scannerHint = 'Point camera at barcode';
  if (starting) scannerHint = 'Starting camera…';
  else if (flipping) scannerHint = 'Switching camera…';
  else if (cameraError) scannerHint = 'Camera unavailable';
  else if (lookupBusy) scannerHint = 'Looking up product…';
  else if (paused) scannerHint = 'Tap to scan next product';
  else if (lastStatus === 'added') scannerHint = 'Ready for next barcode';

  return (
    <div className="pos-scan-overlay" role="dialog" aria-modal="true" aria-label="Barcode scanner">
      <div className="pos-scan-overlay__panel">
        <header className="pos-scan-overlay__header">
          <button
            type="button"
            className="pos-scan-overlay__icon-btn"
            onClick={handleStop}
            aria-label="Close scanner"
          >
            <FaChevronLeft aria-hidden />
          </button>
          <div className="pos-scan-overlay__title">
            <span className="pos-scan-overlay__title-icon" aria-hidden="true">
              <NavIcon icon={FaBarcode} size={16} />
            </span>
            <div>
              <strong>Scan Products</strong>
              <button
                type="button"
                className={`pos-scan-overlay__live${continuousOn ? ' is-on' : ''}`}
                onClick={handleToggleContinuous}
                aria-pressed={continuousOn}
                title={continuousOn ? 'Turn continuous scan off' : 'Turn continuous scan on'}
              >
                <span className="pos-scan-overlay__live-dot" aria-hidden="true" />
                Continuous Scan {continuousOn ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
          <div className="pos-scan-overlay__header-actions">
            {canFlip ? (
              <button
                type="button"
                className="pos-scan-overlay__icon-btn"
                onClick={handleFlip}
                disabled={starting || flipping}
                title={`Switch to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
                aria-label={`Flip to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
              >
                <FaCameraRotate aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="pos-scan-overlay__icon-btn"
              onClick={handleStop}
              aria-label="Stop scanning"
            >
              <FaXmark aria-hidden />
            </button>
          </div>
        </header>

        <div className="pos-scan-overlay__stage">
          <div id={SCANNER_ELEMENT_ID} className="pos-scan-overlay__reader" />
          {cameraReady ? (
            <div className="pos-scan-overlay__frame" aria-hidden="true">
              <span className="pos-scan-overlay__corner pos-scan-overlay__corner--tl" />
              <span className="pos-scan-overlay__corner pos-scan-overlay__corner--tr" />
              <span className="pos-scan-overlay__corner pos-scan-overlay__corner--bl" />
              <span className="pos-scan-overlay__corner pos-scan-overlay__corner--br" />
              <span className="pos-scan-overlay__laser" />
            </div>
          ) : null}
          {starting || flipping ? (
            <div className="pos-scan-overlay__status">
              {flipping ? 'Switching camera…' : 'Starting camera…'}
            </div>
          ) : null}
          {cameraError ? <div className="pos-scan-overlay__error">{cameraError}</div> : null}
          {paused && cameraReady ? (
            <button type="button" className="pos-scan-overlay__paused" onClick={resumeScanning}>
              Tap to scan next
            </button>
          ) : null}
        </div>

        <p className="pos-scan-overlay__hint">
          <span
            className={`pos-scan-overlay__hint-dot${cameraReady && continuousOn && !paused ? ' is-live' : ''}`}
            aria-hidden="true"
          />
          {scannerHint}
        </p>

        {lastLine ? (
          <article
            key={flashKey}
            className={`pos-scan-last${lastStatus === 'added' ? ' is-added' : ''}`}
            aria-live="polite"
          >
            <div className="pos-scan-last__top">
              <span className="pos-scan-last__badge">
                <FaCircleCheck aria-hidden />
                Product added
              </span>
              <span className="pos-scan-last__price">
                {formatMoney(lastLine.unitPrice ?? lastMeta?.price ?? 0)}
              </span>
            </div>
            <div className="pos-scan-last__row">
              <ScanProductThumb
                src={lastMeta?.image || companyLogoUrl}
                fallbackSrc={companyLogoUrl || defaultImg}
                name={lastLine.name}
              />
              <div className="pos-scan-last__info">
                <strong>{lastLine.name}</strong>
                <span>
                  {lastMeta?.sku
                    ? `SKU: ${lastMeta.sku}`
                    : lastMeta?.barcode || lastCode
                      ? `Barcode: ${lastMeta?.barcode || lastCode}`
                      : 'In cart'}
                </span>
              </div>
              <ScanQtyControl
                quantity={lastLine.quantity}
                name={lastLine.name}
                onMinus={() => bumpQty(lastLine.productId, -1)}
                onPlus={() => bumpQty(lastLine.productId, 1)}
              />
            </div>
          </article>
        ) : null}

        <section className="pos-scan-cart" aria-label="Scanned products">
          <div className="pos-scan-cart__head">
            <h3>Cart</h3>
            <span>{uniqueCount ? `${uniqueCount} ${uniqueCount === 1 ? 'item' : 'items'}` : 'Empty'}</span>
          </div>
          <div className="pos-scan-cart__list">
            {scanCartLines.length === 0 ? (
              <p className="pos-scan-cart__empty">Scan a barcode to add products</p>
            ) : (
              scanCartLines.map((line) => {
                const meta = scanMeta[line.productId];
                const sku = meta?.sku;
                const barcode = meta?.barcode;
                const lineTotal = parseScanQty(line.quantity) * (Number(line.unitPrice) || 0);
                return (
                  <div key={line.productId} className="pos-scan-item">
                    <ScanProductThumb
                      src={meta?.image || companyLogoUrl}
                      fallbackSrc={companyLogoUrl || defaultImg}
                      name={line.name}
                    />
                    <div className="pos-scan-item__info">
                      <strong>{line.name}</strong>
                      <span>
                        {sku ? `SKU: ${sku}` : barcode ? `Barcode: ${barcode}` : 'Scanned item'}
                      </span>
                      <em>
                        {formatMoney(line.unitPrice)}
                        {parseScanQty(line.quantity) > 1 ? ` · ${formatMoney(lineTotal)}` : ''}
                      </em>
                    </div>
                    <ScanQtyControl
                      quantity={line.quantity}
                      name={line.name}
                      onMinus={() => bumpQty(line.productId, -1)}
                      onPlus={() => bumpQty(line.productId, 1)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </section>

        <footer className="pos-scan-summary">
          <div className="pos-scan-summary__totals">
            <span>
              {formatScanQty(cartTotalQty)} qty · {uniqueCount}{' '}
              {uniqueCount === 1 ? 'item' : 'items'}
            </span>
            <strong>{formatMoney(cartSubtotal)}</strong>
          </div>
          <div className="pos-scan-summary__actions">
            <button type="button" className="pos-scan-summary__ghost" onClick={handleViewCart}>
              <FaCartShopping aria-hidden />
              View Cart
            </button>
            <button
              type="button"
              className="pos-scan-summary__checkout"
              onClick={handleCheckout}
              disabled={checkoutDisabled}
            >
              Checkout
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </div>

      {notFoundCode ? (
        <div className="pos-scan-miss" role="status">
          <div className="pos-scan-miss__sheet">
            <div className="pos-scan-miss__text">
              <strong>Barcode not found</strong>
              <span>{notFoundCode}</span>
            </div>
            <div className={`pos-scan-miss__actions${canCreateProduct ? '' : ' pos-scan-miss__actions--single'}`}>
              {canCreateProduct ? (
                <button type="button" className="pos-scan-miss__ghost" onClick={handleAddMissingProduct}>
                  Add Product
                </button>
              ) : null}
              <button type="button" className="pos-scan-miss__primary" onClick={() => setNotFoundCode('')}>
                Scan Again
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
