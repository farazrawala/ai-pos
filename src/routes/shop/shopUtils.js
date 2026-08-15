import { buildApiUrl } from '../../config/apiConfig.js';

export const formatShopPrice = (value) =>
  `Rs. ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)}`;

export async function shopRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || body?.error || 'Request failed.');
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const shopCartKey = (companyId) => `shop_cart_${companyId}`;

export function loadShopCart(companyId) {
  if (!companyId) return {};
  try {
    const raw = window.localStorage.getItem(shopCartKey(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveShopCart(companyId, cart) {
  if (!companyId) return;
  try {
    window.localStorage.setItem(shopCartKey(companyId), JSON.stringify(cart));
  } catch {
    /* localStorage unavailable */
  }
}

export function cartLines(cart) {
  return Object.values(cart || {}).filter((line) => line?.product_id && Number(line.qty) > 0);
}

export function cartSubtotal(cart) {
  return cartLines(cart).reduce(
    (sum, line) => sum + (Number(line.price) || 0) * (Number(line.qty) || 0),
    0
  );
}

export function createClientOrderId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Plain text from HTML product descriptions (safe for storefront display). */
export function stripShopHtml(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  return text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Digits-only WhatsApp number for `wa.me` links. */
export function toShopWhatsAppDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = `92${digits.slice(1)}`;
  }
  return digits.length >= 7 ? digits : '';
}

export function buildShopWhatsAppUrl(phone) {
  const digits = toShopWhatsAppDigits(phone);
  return digits ? `https://wa.me/${digits}` : '';
}
