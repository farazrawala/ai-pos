import { useCallback, useEffect, useRef, useState } from 'react';
import { FaBarcode, FaCameraRotate, FaCircleStop, FaXmark } from 'react-icons/fa6';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import NavIcon from '../../components/NavIcon.jsx';

const SCANNER_ELEMENT_ID = 'pos-continuous-barcode-reader';
/** Ignore the same code briefly so one barcode isn't added many times. */
const SAME_CODE_COOLDOWN_MS = 1600;
/** Brief lock after any successful add so the camera can settle. */
const AFTER_ADD_PAUSE_MS = 450;

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

/**
 * Full-screen continuous camera barcode scanner for mobile POS.
 * Keeps scanning and calling onScan until the user presses Stop.
 * Defaults to rear camera; Flip switches to front and back.
 */
export default function PosContinuousScanModal({ open, onClose, onScan }) {
  const [cameraError, setCameraError] = useState('');
  const [starting, setStarting] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [canFlip, setCanFlip] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const [lastResult, setLastResult] = useState('');
  const [addedCount, setAddedCount] = useState(0);

  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef({ code: '', at: 0 });
  const onScanRef = useRef(onScan);
  const camerasRef = useRef([]);
  onScanRef.current = onScan;

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
      setLastResult('');
      setAddedCount(0);
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
        if (!code || busyRef.current) return;

        const now = Date.now();
        const last = lastCodeRef.current;
        if (last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS) return;

        busyRef.current = true;
        lastCodeRef.current = { code, at: now };
        setLastCode(code);
        setLastResult('Looking up…');

        try {
          const result = await onScanRef.current?.(code);
          if (result === 'added') {
            setAddedCount((n) => n + 1);
            setLastResult('Added to cart');
          } else if (result === 'blocked') {
            setLastResult('Skipped');
          } else {
            setLastResult('No product match');
          }
        } catch (err) {
          setLastResult(err?.message || 'Lookup failed');
        } finally {
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

  if (!open) return null;

  const facingLabel = facingMode === 'environment' ? 'Back camera' : 'Front camera';

  return (
    <div className="pos-scan-overlay" role="dialog" aria-modal="true" aria-label="Continuous barcode scan">
      <div className="pos-scan-overlay__panel">
        <div className="pos-scan-overlay__header">
          <div className="pos-scan-overlay__title">
            <NavIcon icon={FaBarcode} size={16} />
            <div>
              <strong>Continuous scan</strong>
              <span>Point at barcodes — products add automatically</span>
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
              aria-label="Close scanner"
            >
              <FaXmark aria-hidden />
            </button>
          </div>
        </div>

        <div className="pos-scan-overlay__stage">
          <div id={SCANNER_ELEMENT_ID} className="pos-scan-overlay__reader" />
          {starting || flipping ? (
            <div className="pos-scan-overlay__status">
              {flipping ? 'Switching camera…' : 'Starting camera…'}
            </div>
          ) : null}
          {cameraError ? <div className="pos-scan-overlay__error">{cameraError}</div> : null}
          {!cameraError && !starting && !flipping ? (
            <div className="pos-scan-overlay__facing">{facingLabel}</div>
          ) : null}
        </div>

        <div className="pos-scan-overlay__meta">
          <div className="pos-scan-overlay__stat">
            <span className="label">Added</span>
            <strong>{addedCount}</strong>
          </div>
          <div className="pos-scan-overlay__stat pos-scan-overlay__stat--grow">
            <span className="label">Last scan</span>
            <strong className="pos-scan-overlay__code">{lastCode || '—'}</strong>
            {lastResult ? <em>{lastResult}</em> : null}
          </div>
          {canFlip ? (
            <button
              type="button"
              className="pos-scan-overlay__flip"
              onClick={handleFlip}
              disabled={starting || flipping}
            >
              <FaCameraRotate aria-hidden />
              Flip
            </button>
          ) : null}
        </div>

        <button type="button" className="pos-scan-overlay__stop" onClick={handleStop}>
          <FaCircleStop aria-hidden />
          Stop scanning
        </button>
      </div>
    </div>
  );
}
