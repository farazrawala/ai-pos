import { withBase } from '../config/appBase.js';

/** Resolve the token used in `/invoice/view/:token` from an order document. */
export function pickPublicInvoiceToken(order) {
  if (!order || typeof order !== 'object') return '';
  const candidates = [
    order.public_invoice_token,
    order.publicInvoiceToken,
    order.invoice_public_token,
    order.invoicePublicToken,
    order.public_token,
    order.publicToken,
    order.share_token,
    order.shareToken,
    order._id,
    order.id,
  ];
  for (const value of candidates) {
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

/**
 * Build the shareable public invoice URL for QR codes and copy fields.
 * Includes app base (e.g. `/pos`) so deploy-at-subdir installs open correctly.
 */
export function buildPublicInvoiceUrl(token, origin) {
  const t = String(token ?? '').trim();
  if (!t) return '';

  const path = withBase(`/invoice/view/${encodeURIComponent(t)}`);
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    '';

  if (!base) return path;
  return `${String(base).replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
