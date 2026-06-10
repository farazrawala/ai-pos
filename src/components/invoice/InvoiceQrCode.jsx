import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function InvoiceQrCode({ value, size = 96, className = '' }) {
  const [src, setSrc] = useState('');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const text = String(value ?? '').trim();
    if (!text) {
      setSrc('');
      setStatus('empty');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc('');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  const boxStyle = {
    width: size,
    height: size,
    objectFit: 'contain',
  };

  if (status === 'ready' && src) {
    return (
      <img
        src={src}
        alt="Invoice QR code"
        width={size}
        height={size}
        className={className || 'border rounded bg-white'}
        style={boxStyle}
      />
    );
  }

  return (
    <div
      className={className || 'border rounded bg-white d-flex align-items-center justify-content-center'}
      style={boxStyle}
      aria-label="Invoice QR code"
    >
      {status === 'loading' ? (
        <span className="spinner-border spinner-border-sm text-secondary" role="status">
          <span className="visually-hidden">Generating QR code…</span>
        </span>
      ) : (
        <span className="text-muted small text-center px-1">
          {status === 'empty' ? 'No URL' : 'QR unavailable'}
        </span>
      )}
    </div>
  );
}
