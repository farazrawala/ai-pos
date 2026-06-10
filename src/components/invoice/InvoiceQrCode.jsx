import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function InvoiceQrCode({ value, size = 96, className = '' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const text = String(value ?? '').trim();
    if (!text) {
      setSrc('');
      return undefined;
    }

    let cancelled = false;
    QRCode.toDataURL(text, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt="Invoice QR code"
      width={size}
      height={size}
      className={className || 'border rounded bg-white'}
      style={{ objectFit: 'contain' }}
    />
  );
}
