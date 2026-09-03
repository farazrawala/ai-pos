import { Link } from 'react-router-dom';
import { posInvoiceRoutePath } from '../../config/appBase.js';

/** Document refs embedded in transaction descriptions, e.g. ORD-0081, PO-0042, PR-0003, SR-0010. */
const DOCUMENT_REF_RE = /(?:POR|ORD|PO|PR|SR)-[A-Z0-9-]+/gi;

const normalizeReferenceType = (referenceType) =>
  String(referenceType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/**
 * Route for a linked document by inventory/GL `reference_type` + Mongo id.
 * Used by stock movements and transaction description links.
 */
export const routeForReferenceType = (referenceType, referenceId) => {
  const routeId = String(referenceId || '').trim();
  if (!routeId) return null;
  const type = normalizeReferenceType(referenceType);

  if (
    type === 'order' ||
    type === 'sales' ||
    type === 'sale' ||
    type === 'sale_order' ||
    type === 'sales_order'
  ) {
    return { to: posInvoiceRoutePath(routeId), title: 'View order' };
  }
  if (type === 'purchase_order' || type === 'purchase') {
    return {
      to: `/purchase-orders/edit/${encodeURIComponent(routeId)}`,
      title: 'View purchase order',
    };
  }
  if (type === 'purchase_return' || type === 'purchase_order_return') {
    return {
      to: `/purchase-order-returns/edit/${encodeURIComponent(routeId)}`,
      title: 'View purchase return',
    };
  }
  if (type === 'sales_return' || type === 'sale_return') {
    return {
      to: `/sales-returns/edit/${encodeURIComponent(routeId)}`,
      title: 'View sales return',
    };
  }
  return null;
};

const routeForDocumentRef = (ref, linkMap) => {
  const code = String(ref || '').trim();
  if (!code) return null;
  const upper = code.toUpperCase();
  const linked = linkMap?.get?.(upper);
  const routeId = linked?.routeId;
  if (!routeId) return null;

  if (upper.startsWith('ORD-')) {
    return routeForReferenceType('order', routeId);
  }
  if (upper.startsWith('POR-') || upper.startsWith('PR-')) {
    return routeForReferenceType('purchase_return', routeId);
  }
  if (upper.startsWith('PO-')) {
    return routeForReferenceType('purchase_order', routeId);
  }
  if (upper.startsWith('SR-')) {
    return routeForReferenceType('sales_return', routeId);
  }
  return null;
};

export const renderTransactionDescriptionLinks = (text, linkMap) => {
  if (text == null || text === '' || text === '—') return text;
  const str = String(text);
  const parts = [];
  let lastIndex = 0;
  const re = new RegExp(DOCUMENT_REF_RE.source, DOCUMENT_REF_RE.flags);
  let match;

  while ((match = re.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }
    const ref = match[0];
    const route = routeForDocumentRef(ref, linkMap);
    parts.push(
      route ? (
        <Link
          key={`${ref}-${match.index}`}
          to={route.to}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-decoration-underline"
          title={route.title}
        >
          {ref}
        </Link>
      ) : (
        ref
      )
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }
  return parts.length > 0 ? parts : str;
};
