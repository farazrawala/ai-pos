import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaBarcode,
  FaCameraRotate,
  FaCartShopping,
  FaChevronLeft,
  FaCircleCheck,
  FaFloppyDisk,
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
import { playPosScanBeep, unlockPosScanAudio } from '../../utils/posScanBeep.js';

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

function buildScanConfig(facing = 'environment') {
  return {
    fps: 24,
    qrbox: (viewW, viewH) => {
      const width = Math.max(240, Math.min(viewW, Math.floor(viewW * 0.96)));
      const height = Math.max(
        90,
        Math.min(viewH, Math.floor(viewH * 0.55), Math.floor(width * 0.42))
      );
      return { width, height };
    },
    disableFlip: true,
    videoConstraints: {
      facingMode: { ideal: facing },
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
    },
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
    navigator.vibrate?.([40, 30, 70]);
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
 * Keeps scanning into a local draft until the user saves as Draft, views the cart, or checks out.
 * Defaults to rear camera; Flip switches to front and back.
 */
export default function PosContinuousScanModal({
  open,
  onClose,
  onScan,
  cartLines = [],
  onConfirmDraft,
  onSaveDraft,
  onCheckout,
  checkoutBusy = false,
  draftSaving = false,
  isOnline = true,
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
  const [draftLines, setDraftLines] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAfter, setConfirmAfter] = useState('stay');

  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const continuousRef = useRef(true);
  const lastCodeRef = useRef({ code: '', at: 0 });
  const onScanRef = useRef(onScan);
  const camerasRef = useRef([]);
  const draftSeqRef = useRef(0);
  const confirmOpenRef = useRef(false);
  onScanRef.current = onScan;
  continuousRef.current = continuousOn;
  pausedRef.current = paused;
  confirmOpenRef.current = confirmOpen;

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

  const handleFlip = useCallback(() => {
    if (starting || flipping || cameraError) return;
    unlockPosScanAudio();
    setFlipping(true);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, [starting, flipping, cameraError]);

  const resumeScanning = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const handleToggleContinuous = useCallback(() => {
    unlockPosScanAudio();
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
        if (!code || busyRef.current || pausedRef.current || confirmOpenRef.current) return;

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
            playPosScanBeep('success');
            lightHaptic();
            setScanMeta((prev) => ({ ...prev, [meta.productId]: meta }));
            setDraftLines((prev) => {
              const i = prev.findIndex((line) => line.productId === meta.productId);
              if (i >= 0) {
                const next = [...prev];
                next[i] = {
                  ...next[i],
                  quantity: parseScanQty(next[i].quantity) + 1,
                  unitPrice: meta.price,
                  name: meta.name,
                  product: product || next[i].product,
                  addedSeq: ++draftSeqRef.current,
                };
                return next;
              }
              return [
                {
                  productId: meta.productId,
                  name: meta.name,
                  unitPrice: meta.price,
                  quantity: 1,
                  addedSeq: ++draftSeqRef.current,
                  product,
                },
                ...prev,
              ];
            });
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
        const config = buildScanConfig(facingMode);
        const configNoVideo = { fps: config.fps, qrbox: config.qrbox, disableFlip: true };
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          verbose: false,
          formatsToSupport: BARCODE_FORMATS,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;

        const onFrame = () => {};
        const startCamera = async (cameraConfig, scanConfig) => {
          if (scanner.isScanning) {
            try {
              await scanner.stop();
            } catch {
              /* continue */
            }
          }
          await scanner.start(cameraConfig, scanConfig, onDetected, onFrame);
        };
        try {
          await startCamera({ facingMode }, config);
        } catch {
          try {
            await startCamera({ facingMode }, configNoVideo);
          } catch {
            if (!preferred?.id) throw new Error('Could not open camera.');
            await startCamera(preferred.id, configNoVideo);
          }
        }
        try {
          if (typeof scanner.applyVideoConstraints === 'function') {
            await scanner.applyVideoConstraints({
              advanced: [{ focusMode: 'continuous' }],
            });
          }
        } catch {
          /* autofocus not supported */
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
      setDraftLines([]);
      setConfirmOpen(false);
      setConfirmAfter('stay');
      setScanMeta({});
      draftSeqRef.current = 0;
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
    const lines = Array.isArray(draftLines) ? [...draftLines] : [];
    lines.sort((a, b) => (Number(b.addedSeq) || 0) - (Number(a.addedSeq) || 0));
    return lines;
  }, [draftLines]);

  const lastLine = useMemo(
    () => scanCartLines.find((line) => line.productId === lastProductId) || null,
    [scanCartLines, lastProductId]
  );
  const lastMeta = lastProductId ? scanMeta[lastProductId] : null;

  const draftTotalQty = useMemo(
    () => scanCartLines.reduce((sum, line) => sum + parseScanQty(line.quantity), 0),
    [scanCartLines]
  );
  const draftSubtotal = useMemo(
    () =>
      scanCartLines.reduce(
        (sum, line) => sum + parseScanQty(line.quantity) * (Number(line.unitPrice) || 0),
        0
      ),
    [scanCartLines]
  );

  const bumpQty = useCallback((productId, delta) => {
    if (!productId || !delta) return;
    setDraftLines((prev) => {
      const next = [];
      for (const line of prev) {
        if (line.productId !== productId) {
          next.push(line);
          continue;
        }
        const qty = parseScanQty(line.quantity) + delta;
        if (qty <= 0) continue;
        next.push({ ...line, quantity: qty });
      }
      return next;
    });
  }, []);

  const closeScanner = useCallback(async () => {
    await stopScanner();
    onClose?.();
  }, [onClose, stopScanner]);

  const runAfterConfirm = useCallback(
    (after) => {
      if (after === 'checkout') {
        onClose?.();
        queueMicrotask(() => onCheckout?.());
        return;
      }
      if (after === 'viewCart' || after === 'close') {
        closeScanner();
      }
    },
    [onClose, onCheckout, closeScanner]
  );

  const requestConfirm = useCallback(
    (after = 'stay') => {
      setConfirmAfter(after);
      if (scanCartLines.length < 1) {
        if (after === 'stay') return;
        if (after === 'checkout') {
          runAfterConfirm('checkout');
          return;
        }
        closeScanner();
        return;
      }
      setConfirmOpen(true);
    },
    [scanCartLines.length, closeScanner, runAfterConfirm]
  );

  const handleStop = useCallback(() => {
    requestConfirm('close');
  }, [requestConfirm]);

  const handleViewCart = useCallback(() => {
    requestConfirm('viewCart');
  }, [requestConfirm]);

  const handleCheckout = useCallback(() => {
    requestConfirm('checkout');
  }, [requestConfirm]);

  const handleDraft = useCallback(() => {
    if (scanCartLines.length < 1) return;
    const added = onConfirmDraft?.(scanCartLines, { silent: true });
    if (added === false) return;
    setDraftLines([]);
    setLastProductId('');
    setLastStatus('');
    onSaveDraft?.();
    closeScanner();
  }, [scanCartLines, onConfirmDraft, onSaveDraft, closeScanner]);

  const handleConfirmYes = useCallback(() => {
    const added = onConfirmDraft?.(scanCartLines);
    setConfirmOpen(false);
    if (added === false) return;
    setDraftLines([]);
    setLastProductId('');
    setLastStatus('');
    if (confirmAfter !== 'stay') runAfterConfirm(confirmAfter);
  }, [onConfirmDraft, scanCartLines, confirmAfter, runAfterConfirm]);

  const handleConfirmNo = useCallback(() => {
    setConfirmOpen(false);
    if (confirmAfter === 'stay' || confirmAfter === 'checkout') return;
    setDraftLines([]);
    closeScanner();
  }, [confirmAfter, closeScanner]);

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
  const parentCartCount = Array.isArray(cartLines) ? cartLines.length : 0;
  const draftDisabled = uniqueCount < 1 || draftSaving || !isOnline;
  const checkoutDisabled = checkoutBusy || (uniqueCount < 1 && parentCartCount < 1);
  const defaultImg = withBase('/assets/img/default.jpg');
  const leavingWithoutAdd = confirmAfter === 'close' || confirmAfter === 'viewCart';

  let scannerHint = 'Point camera at barcode';
  if (starting) scannerHint = 'Starting camera…';
  else if (flipping) scannerHint = 'Switching camera…';
  else if (cameraError) scannerHint = 'Camera unavailable';
  else if (lookupBusy) scannerHint = 'Looking up product…';
  else if (paused) scannerHint = 'Tap to scan next product';
  else if (lastStatus === 'added') scannerHint = 'Ready for next barcode';

  return (
    <div
      className="pos-scan-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scanner"
      onPointerDown={unlockPosScanAudio}
    >
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
                Added to draft
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
                      : 'In draft'}
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

        <section className="pos-scan-cart" aria-label="Draft products">
          <div className="pos-scan-cart__head">
            <h3>Draft</h3>
            <span>{uniqueCount ? `${uniqueCount} ${uniqueCount === 1 ? 'item' : 'items'}` : 'Empty'}</span>
          </div>
          <div className="pos-scan-cart__list">
            {scanCartLines.length === 0 ? (
              <p className="pos-scan-cart__empty">Scan a barcode to add products to draft</p>
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
              {formatScanQty(draftTotalQty)} qty · {uniqueCount}{' '}
              {uniqueCount === 1 ? 'item' : 'items'}
            </span>
            <strong>{formatMoney(draftSubtotal)}</strong>
          </div>
          <div className="pos-scan-summary__actions">
            <button
              type="button"
              className="pos-scan-summary__draft"
              onClick={handleDraft}
              disabled={draftDisabled}
              title={
                !isOnline
                  ? 'Connect to the internet to save drafts'
                  : uniqueCount < 1
                    ? 'Scan items before saving a draft'
                    : 'Save scanned items as a draft'
              }
            >
              <FaFloppyDisk aria-hidden />
              {draftSaving ? 'Saving…' : 'Draft'}
            </button>
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

      {confirmOpen ? (
        <div className="pos-scan-miss pos-scan-confirm" role="dialog" aria-label="Add draft to cart">
          <div className="pos-scan-miss__sheet pos-scan-confirm__sheet">
            <span className="pos-scan-confirm__handle" aria-hidden="true" />
            <div className="pos-scan-confirm__icon" aria-hidden="true">
              <FaCircleCheck />
            </div>
            <div className="pos-scan-miss__text pos-scan-miss__text--prompt">
              <strong>Add to cart?</strong>
              <span>
                {leavingWithoutAdd
                  ? 'Add these draft items to the cart before leaving?'
                  : `Add ${formatScanQty(draftTotalQty)} qty · ${uniqueCount} ${
                      uniqueCount === 1 ? 'item' : 'items'
                    } to the cart?`}
              </span>
            </div>
            <div className="pos-scan-miss__actions">
              <button type="button" className="pos-scan-miss__ghost" onClick={handleConfirmNo}>
                {leavingWithoutAdd ? 'No, discard' : 'No'}
              </button>
              <button type="button" className="pos-scan-miss__primary pos-scan-confirm__yes" onClick={handleConfirmYes}>
                Yes, add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notFoundCode && !confirmOpen ? (
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
