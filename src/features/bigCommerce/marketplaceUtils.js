import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { getProductAvailableStock } from '../../utils/productStock.js';

export const DEFAULT_FILTERS = {
  search: '',
  categoryIds: [],
  brandIds: [],
  minPrice: '',
  maxPrice: '',
  stock: '', // in_stock | out_of_stock | low_stock | ''
  minRating: 0,
  sortBy: 'latest',
};

export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'oldest', label: 'Oldest', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'price_asc', label: 'Price Low → High', sortBy: 'price', sortOrder: 'asc' },
  { value: 'price_desc', label: 'Price High → Low', sortBy: 'price', sortOrder: 'desc' },
  { value: 'name_asc', label: 'Name A-Z', sortBy: 'product_name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Name Z-A', sortBy: 'product_name', sortOrder: 'desc' },
  { value: 'best_selling', label: 'Best Selling', sortBy: 'sold_count', sortOrder: 'desc' },
  { value: 'highest_rated', label: 'Highest Rated', sortBy: 'rating', sortOrder: 'desc' },
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const LOW_STOCK_THRESHOLD = 5;

export function productIdFromRecord(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item._id ?? item.id ?? item.product_id ?? '').trim();
}

/** Parent product id from a child/variation row (string, or nested object). */
export function getParentProductId(item) {
  if (!item || typeof item !== 'object') return '';
  const raw = item.parent_product_id ?? item.parentProductId;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return String(raw._id ?? raw.id ?? '').trim();
  }
  return String(raw).trim();
}

/** True when this row is a child / variation of another product. */
export function hasParentProductId(item) {
  return Boolean(getParentProductId(item));
}

/** Strip trailing `[Size - Color]` option suffix used by variation SKUs. */
export function baseProductName(name) {
  return String(name || '')
    .replace(/\s*\[[^\]]*\]\s*$/g, '')
    .trim()
    .toLowerCase();
}

/** Single SKUs named `Parent [options]` are variation rows even without parent_product_id. */
export function looksLikeNamedVariation(item) {
  if (!item || typeof item !== 'object') return false;
  const type = String(item.product_type ?? item.productType ?? '').trim().toLowerCase();
  if (type === 'variable') return false;
  const name = String(item.product_name ?? item.name ?? '').trim();
  return /\[[^\]]+\]\s*$/.test(name);
}

/** True for marketplace rows that should not appear as top-level cards. */
export function isMarketplaceChildProduct(item) {
  return hasParentProductId(item) || looksLikeNamedVariation(item);
}

/** Parent-only catalog rows (exclude variation/child products). */
export function excludeChildProducts(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => !isMarketplaceChildProduct(item));
}

/** Variations / child products on a parent product record. */
export function getProductVariations(item) {
  if (!item || typeof item !== 'object') return [];
  const kids =
    item.childproducts ??
    item.child_products ??
    item.variations ??
    item.children ??
    [];
  return Array.isArray(kids) ? kids.filter(Boolean) : [];
}

function mergeVariationLists(...lists) {
  const out = [];
  const seen = new Set();
  lists.flat().forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = productIdFromRecord(item);
    const key = id || `name:${String(item.product_name ?? item.name ?? '').trim()}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

/**
 * Nest flat child/variation rows onto their Variable parent within a list page.
 * Marketplace APIs often return children as sibling products, not nested `childproducts`.
 */
export function attachSiblingChildren(list) {
  if (!Array.isArray(list) || list.length === 0) return Array.isArray(list) ? list : [];

  const byParentId = new Map();
  const byBaseName = new Map();

  list.forEach((item) => {
    if (!isMarketplaceChildProduct(item)) return;
    const parentId = getParentProductId(item);
    if (parentId) {
      if (!byParentId.has(parentId)) byParentId.set(parentId, []);
      byParentId.get(parentId).push(item);
    }
    const base = baseProductName(item.product_name ?? item.name);
    if (base) {
      if (!byBaseName.has(base)) byBaseName.set(base, []);
      byBaseName.get(base).push(item);
    }
  });

  return list.map((item) => {
    if (isMarketplaceChildProduct(item)) return item;
    const id = productIdFromRecord(item);
    const type = String(item?.product_type ?? item?.productType ?? '').trim().toLowerCase();
    const base = baseProductName(item?.product_name ?? item?.name);
    const fromId = id ? byParentId.get(id) || [] : [];
    const fromName =
      type === 'variable' && base ? byBaseName.get(base) || [] : [];
    const existing = getProductVariations(item);
    const merged = mergeVariationLists(existing, fromId, fromName);
    if (merged.length === 0) return item;
    return { ...item, childproducts: merged };
  });
}

/**
 * Collect child variations for a parent from nested fields + flat catalog siblings.
 */
export function collectMarketplaceVariations(parent, catalog = []) {
  if (!parent || typeof parent !== 'object') return [];
  const parentId = productIdFromRecord(parent);
  const parentBase = baseProductName(parent.product_name ?? parent.name);
  const nested = getProductVariations(parent);

  const siblings = (Array.isArray(catalog) ? catalog : []).filter((item) => {
    if (!item || item === parent) return false;
    const itemId = productIdFromRecord(item);
    if (parentId && itemId && itemId === parentId) return false;
    const linkedParent = getParentProductId(item);
    if (parentId && linkedParent && linkedParent === parentId) return true;
    if (
      parentBase &&
      looksLikeNamedVariation(item) &&
      baseProductName(item.product_name ?? item.name) === parentBase
    ) {
      return true;
    }
    return false;
  });

  return mergeVariationLists(nested, siblings);
}

export function getVariationLabel(variation, parentName = '') {
  const full = String(
    variation?.product_name ?? variation?.name ?? variation?.sku ?? variation?.product_code ?? ''
  ).trim();
  if (!full) return 'Variation';

  const bracket = full.match(/\[([^\]]+)\]/);
  if (bracket?.[1]) {
    return bracket[1].trim().replace(/\s*-\s*/g, ' · ');
  }

  const parent = String(parentName || '').trim();
  if (parent && full.toLowerCase().startsWith(parent.toLowerCase())) {
    const rest = full.slice(parent.length).replace(/^[\s\-–—:]+/, '').trim();
    if (rest) return rest;
  }

  return full;
}

/** Plain-text description from HTML or plain strings. */
export function formatProductDescriptionHtml(raw) {
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

export function getProductName(item) {
  return String(item?.name || item?.product_name || 'Product').trim() || 'Product';
}

export function getProductPrice(item) {
  const raw =
    item?.price ??
    item?.product_price ??
    item?.sale_price ??
    item?.selling_price ??
    item?.retail_price ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function getProductComparePrice(item) {
  const raw = item?.compare_at_price ?? item?.mrp ?? item?.old_price ?? item?.regular_price;
  const n = Number(raw);
  return Number.isFinite(n) && n > getProductPrice(item) ? n : null;
}

export function getProductSku(item) {
  return String(item?.sku ?? item?.product_code ?? '').trim();
}

export function getProductBarcode(item) {
  return String(item?.barcode ?? '').trim();
}

export function getProductBrand(item) {
  const brand = item?.brand_id ?? item?.brand;
  if (brand && typeof brand === 'object') {
    return {
      id: String(brand._id ?? brand.id ?? '').trim(),
      name: String(brand.name ?? brand.brand_name ?? '').trim() || '—',
    };
  }
  const name = String(item?.brand_name ?? item?.brand ?? '').trim();
  const id = String(typeof brand === 'string' || typeof brand === 'number' ? brand : '').trim();
  return { id, name: name || '—' };
}

export function getProductCategory(item) {
  const cat = item?.category_id ?? item?.category;
  if (cat && typeof cat === 'object') {
    return {
      id: String(cat._id ?? cat.id ?? '').trim(),
      name: String(cat.name ?? cat.category_name ?? '').trim() || '—',
    };
  }
  const name = String(item?.category_name ?? item?.category ?? '').trim();
  const id = String(typeof cat === 'string' || typeof cat === 'number' ? cat : '').trim();
  return { id, name: name || '—' };
}

export function getProductRating(item) {
  const raw = item?.rating ?? item?.average_rating ?? item?.avg_rating;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(0, n));
}

export function getProductDescription(item) {
  return formatProductDescriptionHtml(
    item?.short_description ??
      item?.description ??
      item?.product_description ??
      item?.details ??
      ''
  );
}

export function getProductImages(item) {
  if (!item || typeof item !== 'object') return [];
  const collected = [];
  const push = (raw) => {
    const url = resolveCategoryMediaUrl(raw);
    if (url && !collected.includes(url)) collected.push(url);
  };

  push(item.product_image);
  push(item.image);
  if (Array.isArray(item.multi_images)) item.multi_images.forEach(push);
  if (Array.isArray(item.images)) item.images.forEach(push);
  if (Array.isArray(item.gallery)) item.gallery.forEach(push);

  return collected;
}

export function getProductStock(item) {
  if (!item || typeof item !== 'object') return null;

  // Variable parents often store stock on children only (parent qty is 0).
  const type = String(item.product_type ?? item.productType ?? '').trim().toLowerCase();
  const kids = getProductVariations(item);
  if ((type === 'variable' || kids.length > 0) && kids.length > 0) {
    let total = 0;
    let hasAny = false;
    for (const child of kids) {
      // Resolve each child directly (avoid re-entering variable parent logic).
      const childStock = getProductAvailableStock(child);
      if (childStock != null && Number.isFinite(childStock)) {
        total += childStock;
        hasAny = true;
      }
    }
    if (hasAny) return Math.round(total * 100) / 100;
  }

  const stock = getProductAvailableStock(item);
  if (stock == null || !Number.isFinite(stock)) return null;
  return stock;
}

export function getAlertQty(item) {
  const raw = item?.alert_qty ?? item?.alertQty ?? LOW_STOCK_THRESHOLD;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : LOW_STOCK_THRESHOLD;
}

export function getProductBadges(item) {
  const badges = [];
  const stock = getProductStock(item);
  const price = getProductPrice(item);
  const compare = getProductComparePrice(item);
  const created = item?.createdAt ?? item?.created_at;
  const isNew =
    item?.is_new === true ||
    item?.badge === 'new' ||
    (created && Date.now() - new Date(created).getTime() < 1000 * 60 * 60 * 24 * 30);

  if (stock === 0) badges.push({ key: 'out', label: 'Out of Stock', tone: 'danger' });
  else if (stock != null && stock <= getAlertQty(item)) {
    badges.push({ key: 'low', label: 'Low Stock', tone: 'warning' });
  }
  if (compare != null && compare > price) badges.push({ key: 'sale', label: 'Sale', tone: 'accent' });
  if (isNew) badges.push({ key: 'new', label: 'New', tone: 'info' });
  return badges;
}

export function resolveSortParams(sortKey) {
  return SORT_OPTIONS.find((o) => o.value === sortKey) || SORT_OPTIONS[0];
}

/** Client-side filter pass for fields the list API may not fully support yet. */
export function filterProductsClientSide(products, filters) {
  if (!Array.isArray(products)) return [];
  const cats = new Set((filters.categoryIds || []).map(String));
  const brands = new Set((filters.brandIds || []).map(String));
  const minPrice = filters.minPrice !== '' ? Number(filters.minPrice) : null;
  const maxPrice = filters.maxPrice !== '' ? Number(filters.maxPrice) : null;
  const minRating = Number(filters.minRating) || 0;
  const q = String(filters.search || '')
    .trim()
    .toLowerCase();

  return products.filter((item) => {
    if (q) {
      const hay = [
        getProductName(item),
        getProductSku(item),
        getProductBarcode(item),
        getProductBrand(item).name,
        getProductCategory(item).name,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (cats.size > 0) {
      const cat = getProductCategory(item);
      if (!cats.has(cat.id) && !cats.has(cat.name)) return false;
    }

    if (brands.size > 0) {
      const brand = getProductBrand(item);
      if (!brands.has(brand.id) && !brands.has(brand.name)) return false;
    }

    const price = getProductPrice(item);
    if (minPrice != null && Number.isFinite(minPrice) && price < minPrice) return false;
    if (maxPrice != null && Number.isFinite(maxPrice) && price > maxPrice) return false;

    if (minRating > 0) {
      const rating = getProductRating(item) ?? 0;
      if (rating < minRating) return false;
    }

    if (filters.stock) {
      const stock = getProductStock(item);
      if (filters.stock === 'in_stock' && !(stock != null && stock > getAlertQty(item))) {
        return false;
      }
      if (filters.stock === 'out_of_stock' && stock !== 0) return false;
      if (
        filters.stock === 'low_stock' &&
        !(stock != null && stock > 0 && stock <= getAlertQty(item))
      ) {
        return false;
      }
    }

    return true;
  });
}

export function sortProductsClientSide(products, sortKey) {
  const list = [...(products || [])];
  const sort = resolveSortParams(sortKey);

  list.sort((a, b) => {
    let av;
    let bv;
    switch (sort.value) {
      case 'price_asc':
      case 'price_desc':
        av = getProductPrice(a);
        bv = getProductPrice(b);
        break;
      case 'name_asc':
      case 'name_desc':
        av = getProductName(a).toLowerCase();
        bv = getProductName(b).toLowerCase();
        break;
      case 'highest_rated':
        av = getProductRating(a) ?? 0;
        bv = getProductRating(b) ?? 0;
        break;
      case 'best_selling':
        av = Number(a.sold_count ?? a.sales_count ?? 0);
        bv = Number(b.sold_count ?? b.sales_count ?? 0);
        break;
      case 'oldest':
        av = new Date(a.createdAt ?? a.created_at ?? 0).getTime();
        bv = new Date(b.createdAt ?? b.created_at ?? 0).getTime();
        break;
      case 'latest':
      default:
        av = new Date(a.createdAt ?? a.created_at ?? 0).getTime();
        bv = new Date(b.createdAt ?? b.created_at ?? 0).getTime();
        break;
    }
    if (av < bv) return sort.sortOrder === 'asc' ? -1 : 1;
    if (av > bv) return sort.sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

export function parseBigcommerceSettings(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeCompanyProfile(company, stats = {}) {
  if (!company || typeof company !== 'object') {
    return {
      id: '',
      name: 'Company Marketplace',
      description: '',
      location: '',
      phone: '',
      email: '',
      logoUrl: '',
      coverUrl: '',
      rating: null,
      showStoreForListing: false,
      showProducts: true,
      showStoreForRequest: false,
      totalProducts: stats.totalProducts ?? 0,
      totalCategories: stats.totalCategories ?? 0,
      joinedAt: null,
    };
  }

  const settings = parseBigcommerceSettings(
    company.bigcommerce_settings ?? company.bigcommerceSettings
  );

  const coverRaw =
    settings?.banner ||
    settings?.bigcommerce_banner ||
    company.bigcommerce_banner ||
    company.bigcommerceBanner ||
    company.company_cover ||
    company.cover_image ||
    company.coverImage ||
    company.banner ||
    company.company_banner ||
    '';

  const logoFromSettings = settings?.logo || settings?.bigcommerce_logo || '';

  const showStoreForListing = (() => {
    const root =
      company.display_store_on_bigcommerce ??
      company.displayStoreOnBigcommerce ??
      company.display_store_on_big_commerce;
    if (root !== undefined && root !== null && root !== '') {
      return root === true || root === 'true' || root === 1 || root === '1';
    }
    if (settings && typeof settings === 'object') {
      if (settings.display_store_on_bigcommerce !== undefined) {
        return Boolean(settings.display_store_on_bigcommerce);
      }
      if (settings.show_store_for_listing !== undefined) {
        return Boolean(settings.show_store_for_listing);
      }
      if (settings.show_products !== undefined) {
        return Boolean(settings.show_products);
      }
    }
    return false;
  })();

  const showStoreForRequest =
    settings && typeof settings === 'object' && settings.show_store_for_request !== undefined
      ? Boolean(settings.show_store_for_request)
      : false;

  return {
    id: String(company._id ?? company.id ?? '').trim(),
    name: String(company.company_name ?? company.name ?? 'Company').trim(),
    description: String(
      company.tagline ?? company.description ?? company.company_description ?? ''
    ).trim(),
    location: String(
      company.company_address ?? company.address ?? company.city ?? company.location ?? ''
    ).trim(),
    phone: String(
      company.company_phone ?? company.phone ?? company.contact_phone ?? company.mobile ?? ''
    ).trim(),
    email: String(company.company_email ?? company.email ?? '').trim(),
    logoUrl: resolveCategoryMediaUrl(
      logoFromSettings ||
        company.bigcommerce_logo ||
        company.bigcommerceLogo ||
        company.company_logo ||
        company.companyLogo ||
        company.logo ||
        company.logo_image ||
        ''
    ),
    coverUrl: resolveCategoryMediaUrl(coverRaw),
    showStoreForListing,
    showProducts: showStoreForListing,
    showStoreForRequest,
    rating: (() => {
      const n = Number(company.rating ?? company.average_rating);
      return Number.isFinite(n) && n > 0 ? Math.min(5, n) : null;
    })(),
    totalProducts: stats.totalProducts ?? (Number(company.total_products) || 0),
    totalCategories: stats.totalCategories ?? (Number(company.total_categories) || 0),
    joinedAt: company.createdAt ?? company.created_at ?? company.joined_at ?? null,
  };
}

export function formatJoinedDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function renderStars(rating, { max = 5 } = {}) {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const filled = Math.round(Math.min(max, Math.max(0, value)));
  return `${'★'.repeat(filled)}${'☆'.repeat(max - filled)}`;
}

/** Digits-only phone for WhatsApp `wa.me` links. */
export function toWhatsAppPhoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  // Local PK mobiles (03XXXXXXXXX) → international 92…
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = `92${digits.slice(1)}`;
  }
  return digits.length >= 7 ? digits : '';
}

/**
 * WhatsApp deep link.
 * - With phone: opens chat with that number
 * - Phone omitted but message set: opens WhatsApp so the user can pick a contact
 */
export function buildWhatsAppUrl(phone, message = '') {
  const digits = toWhatsAppPhoneDigits(phone);
  const text = String(message || '').trim();
  if (!digits && !text) return '';
  if (!digits) return `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (!text) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
