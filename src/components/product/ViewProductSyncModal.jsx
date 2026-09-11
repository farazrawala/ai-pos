import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import AppModal from '../AppModal.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import { buildApiUrl } from '../../config/apiConfig.js';
import { DEBUG } from '../../config/env.js';
import {
  fetchIntegrationByIdRequest,
  fetchIntegrationsRequest,
  fetchStoreProductVariationsRequest,
  pickIntegrationStoreLogoUrl,
} from '../../features/integration/integrationAPI.js';
import { createBulkSyncProductProcessRequest } from '../../features/process/processAPI.js';
import { fetchProductVariationRequest } from '../../features/products/productsAPI.js';
import {
  SYNC_ROW_QUERY_PRODUCT_ID,
  createSyncProductRequest,
  deleteSyncProductRequest,
  fetchSyncProductsForProductIdsRequest,
  fetchSyncProductsRequest,
  productIdFromSyncRow,
  updateSyncProductRequest,
} from '../../features/syncProduct/syncProductAPI.js';
import { parseStoreProductLink, buildShopifyProductAdminUrl, pickShopifyProductIds } from '../../utils/parseStoreProductUrl.js';
import { toast } from '../../utils/toast.js';
import '../common/devApiSources.css';
import './view-product-sync-modal.css';

const mapLoadStatus = (status) => {
  if (status === 'loading' || status === true) return 'loading';
  if (status === 'failed') return 'error';
  if (status === 'succeeded' || status === false) return 'success';
  return 'pending';
};

const integrationIdFromRecord = (item) =>
  item?._id || item?.id || item?.integration_id || '';

const integrationOptionLabel = (item) => {
  const name = item?.store_name || item?.storeName || item?.name || 'Integration';
  const storeType = item?.store_type || item?.storeType || '';
  return storeType ? `${name} (${storeType})` : name;
};

const decodeHtml = (value) => {
  if (!value) return '';
  if (typeof document === 'undefined') return String(value);
  const el = document.createElement('textarea');
  el.innerHTML = String(value);
  return el.value;
};

const integrationLabel = (integration) => {
  if (!integration || typeof integration !== 'object') return '-';
  const name = integration.store_name || integration.storeName || integration.name || 'Integration';
  const storeType = integration.store_type || integration.storeType || '';
  return storeType ? `${name} (${storeType})` : name;
};

const syncIdFromRecord = (item) => item?._id || item?.id || '';

const isSyncActive = (item) => String(item?.status || '').toLowerCase() === 'active';

const pickSyncedAt = (item) =>
  item?.last_synced_at ||
  item?.lastSyncedAt ||
  item?.synced_at ||
  item?.syncedAt ||
  item?.updatedAt ||
  item?.updated_at ||
  item?.createdAt ||
  item?.created_at ||
  '';

function ConnectedStoreLogo({ integration, href, title }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = pickIntegrationStoreLogoUrl(integration);

  if (!logoUrl || logoFailed) return null;

  const img = (
    <img
      src={logoUrl}
      alt=""
      className="ps-store-logo"
      onError={() => setLogoFailed(true)}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="ps-store-logo-link"
        title={title}
        aria-label={title}
      >
        {img}
      </a>
    );
  }

  return (
    <span className="ps-store-logo-wrap" title={title}>
      {img}
    </span>
  );
}

const pickSyncReferenceId = (item) => {
  const raw =
    item?.refference_id ??
    item?.reference_id ??
    item?.referenceId ??
    item?.reffrence_id ??
    item?.external_id ??
    item?.externalId ??
    item?.remote_id ??
    item?.remoteId ??
    '';
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    return String(raw.id || raw._id || raw.reference_id || raw.refference_id || '').trim();
  }
  return String(raw).trim();
};

/** Parent WooCommerce product id from `123`, `123:456`, or strings containing digits. */
const pickWooCommerceProductId = (referenceId) => {
  const raw = String(referenceId || '').trim();
  if (!raw) return '';
  const parent = raw.includes(':') ? raw.split(':')[0].trim() : raw;
  if (/^\d+$/.test(parent)) return parent;
  const match = parent.match(/(\d{2,})/);
  return match?.[1] || '';
};

const normalizeStoreBaseUrl = (rawUrl) => {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${path === '/' ? '' : path}`;
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

const pickIntegrationStoreUrl = (integration) =>
  integration?.url ||
  integration?.store_url ||
  integration?.storeUrl ||
  integration?.website ||
  integration?.Website ||
  integration?.URL ||
  '';

const isWooLikeStore = (integration) => {
  const storeType = String(integration?.store_type || integration?.storeType || '').toLowerCase();
  return !storeType || storeType === 'woocommerce' || storeType === 'wordpress';
};

/** WordPress product edit: /wp-admin/post.php?post={id}&action=edit */
const buildWooCommerceProductAdminUrl = (integration, referenceId) => {
  const productId = pickWooCommerceProductId(referenceId);
  if (!productId || !integration || !isWooLikeStore(integration)) return '';

  const baseUrl = normalizeStoreBaseUrl(pickIntegrationStoreUrl(integration));
  if (!baseUrl) return '';

  return `${baseUrl}/wp-admin/post.php?post=${encodeURIComponent(productId)}&action=edit`;
};

const resolveSyncIntegrationId = (item) => {
  const populated =
    item?.integration_id && typeof item.integration_id === 'object' ? item.integration_id : null;
  return String(
    populated?._id ||
      populated?.id ||
      (typeof item?.integration_id === 'string' || typeof item?.integration_id === 'number'
        ? item.integration_id
        : '') ||
      ''
  ).trim();
};

const resolveSyncIntegration = (item, integrationsList = []) => {
  const populated =
    item?.integration_id && typeof item.integration_id === 'object' ? item.integration_id : null;
  const integrationId = resolveSyncIntegrationId(item);

  const fromList = Array.isArray(integrationsList)
    ? integrationsList.find((row) => {
        const rowId = String(integrationIdFromRecord(row));
        if (integrationId && rowId === integrationId) return true;
        const populatedName = populated?.store_name || populated?.storeName;
        const rowName = row?.store_name || row?.storeName;
        return Boolean(populatedName && rowName && populatedName === rowName);
      })
    : null;

  // Prefer the full active-integrations record (includes `url`); keep populated label fields as fallback.
  if (fromList || populated) {
    return { ...(populated || {}), ...(fromList || {}) };
  }
  return null;
};

const looksLikeVariantName = (name) => /\[[^\]]+\]/.test(String(name || ''));

const productIdFromRecord = (item) =>
  String(item?._id ?? item?.id ?? item?.product_id ?? '').trim();

const collectIdsFromVariationPayload = (body) => {
  const ids = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || typeof item !== 'object') return;
    const id = productIdFromRecord(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    const kids = item.childproducts ?? item.child_products ?? item.variations;
    if (Array.isArray(kids)) kids.forEach(push);
  };

  if (Array.isArray(body)) {
    body.forEach(push);
    return ids;
  }
  const record = body?.data ?? body?.product ?? body;
  if (Array.isArray(record)) {
    record.forEach(push);
    return ids;
  }
  if (record && typeof record === 'object') push(record);
  return ids;
};

const variationOptionLabel = (variation) => {
  const name = decodeHtml(variation?.name || `Variation ${variation?.id || ''}`);
  const sku = String(variation?.sku || '').trim();
  const ref = String(variation?.reference_id || variation?.id || '').trim();
  const parts = [name];
  if (sku) parts.push(`SKU ${sku}`);
  if (ref) parts.push(`ID ${ref}`);
  return parts.join(' · ');
};

const productNameFromRecord = (item) =>
  decodeHtml(item?.product_name ?? item?.name ?? item?.productName ?? '');

const productSkuFromRecord = (item) =>
  String(item?.sku ?? item?.product_sku ?? item?.productSku ?? '').trim();

const collectFamilyProductsFromVariationPayload = (body) => {
  const products = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || typeof item !== 'object') return;
    const id = productIdFromRecord(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      products.push({
        id,
        name: productNameFromRecord(item),
        sku: productSkuFromRecord(item),
        productType: String(item?.product_type ?? item?.productType ?? '')
          .trim()
          .toLowerCase(),
      });
    }
    const kids = item.childproducts ?? item.child_products ?? item.variations;
    if (Array.isArray(kids)) kids.forEach(push);
  };

  if (Array.isArray(body)) {
    body.forEach(push);
    return products;
  }
  const record = body?.data ?? body?.product ?? body;
  if (Array.isArray(record)) {
    record.forEach(push);
    return products;
  }
  if (record && typeof record === 'object') push(record);
  return products;
};

const normalizeMatchKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const extractBracketOption = (name) => {
  const match = String(name || '').match(/\[([^\]]+)\]/);
  return match ? normalizeMatchKey(match[1]) : '';
};

const matchKeysForProduct = (name, sku) => {
  const keys = [];
  const bracket = extractBracketOption(name);
  const skuKey = normalizeMatchKey(sku);
  const full = normalizeMatchKey(decodeHtml(name));
  if (bracket) keys.push(bracket);
  if (skuKey) keys.push(skuKey);
  if (full) keys.push(full);
  return keys;
};

const storeVariationReferenceId = (variation, parentRemoteId) =>
  String(variation?.reference_id || `${parentRemoteId}:${variation?.id || ''}`).trim();

const matchStoreVariation = (posProduct, storeVariations, usedIds) => {
  const posKeys = matchKeysForProduct(posProduct?.name, posProduct?.sku);
  if (!posKeys.length) return null;
  const posBracket = extractBracketOption(posProduct?.name);

  let best = null;
  let bestScore = 0;
  storeVariations.forEach((variation) => {
    const vid = String(variation?.id || '');
    if (!vid || usedIds.has(vid)) return;
    const storeKeys = matchKeysForProduct(variation?.name, variation?.sku);
    const storeBracket = extractBracketOption(variation?.name);
    let score = 0;
    if (posBracket && storeBracket && posBracket === storeBracket) {
      score = 4;
    } else {
      posKeys.forEach((pk) => {
        if (!pk || !storeKeys.includes(pk)) return;
        score = Math.max(score, pk === posBracket || pk === storeBracket ? 4 : 3);
      });
    }
    if (score > bestScore) {
      bestScore = score;
      best = variation;
    }
  });
  return bestScore >= 3 ? best : null;
};

export default function ViewProductSyncModal({
  open,
  productId,
  productName,
  parentProductId = '',
  productType = '',
  onClose,
  onUnlinked,
}) {
  const isVariableParent =
    String(productType || '').trim().toLowerCase() === 'variable';
  const isPosVariantChild =
    !isVariableParent &&
    (Boolean(String(parentProductId || '').trim()) || looksLikeVariantName(productName));

  const [list, setList] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [togglingSyncId, setTogglingSyncId] = useState(null);
  const [toggleError, setToggleError] = useState(null);
  const [syncPriceDrafts, setSyncPriceDrafts] = useState({});
  const [savingSyncPriceId, setSavingSyncPriceId] = useState(null);
  const [syncPriceError, setSyncPriceError] = useState(null);
  const [unlinkingSyncId, setUnlinkingSyncId] = useState(null);
  const [unlinkError, setUnlinkError] = useState(null);
  const [syncingNowId, setSyncingNowId] = useState(null);
  const [syncNowError, setSyncNowError] = useState(null);

  const [integrations, setIntegrations] = useState([]);
  const [integrationsStatus, setIntegrationsStatus] = useState('idle');
  const [integrationsError, setIntegrationsError] = useState(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(null);

  const [linkUrl, setLinkUrl] = useState('');
  const [linkStatus, setLinkStatus] = useState('idle');
  const [linkError, setLinkError] = useState(null);
  const [linkSuccess, setLinkSuccess] = useState(null);

  const [storeVariations, setStoreVariations] = useState([]);
  const [storeVariationsStatus, setStoreVariationsStatus] = useState('idle');
  const [selectedStoreVariationId, setSelectedStoreVariationId] = useState('');
  const [pendingParentRemoteId, setPendingParentRemoteId] = useState('');
  const hydratedIntegrationIdsRef = useRef(new Set());

  const resetVariationPicker = useCallback(() => {
    setStoreVariations([]);
    setStoreVariationsStatus('idle');
    setSelectedStoreVariationId('');
    setPendingParentRemoteId('');
  }, []);

  const loadSyncRecords = useCallback(() => {
    if (!productId) return undefined;

    let cancelled = false;
    setLoadStatus('loading');
    setError(null);
    setToggleError(null);
    setSyncPriceError(null);
    setUnlinkError(null);
    setSyncNowError(null);
    setSyncPriceDrafts({});
    setSavingSyncPriceId(null);
    setUnlinkingSyncId(null);
    setSyncingNowId(null);

    fetchSyncProductsRequest({
      product_id: productId,
      populate: 'product_id,integration_id',
    })
      .then((result) => {
        if (cancelled) return;
        setList(Array.isArray(result?.data) ? result.data : []);
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        if (!cancelled) {
          setList([]);
          setLoadStatus('failed');
          setError(err?.message || 'Failed to load product sync records');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!open || !productId) return undefined;
    setList([]);
    return loadSyncRecords();
  }, [open, productId, loadSyncRecords]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setIntegrationsStatus('loading');
    setIntegrationsError(null);
    setSyncStatus('idle');
    setSyncError(null);
    setSyncSuccess(null);
    setSelectedIntegrationId('');
    setLinkUrl('');
    setLinkStatus('idle');
    setLinkError(null);
    setLinkSuccess(null);
    resetVariationPicker();

    fetchIntegrationsRequest()
      .then((result) => {
        if (cancelled) return;
        const integrationList = Array.isArray(result?.data) ? result.data : [];
        setIntegrations(integrationList);
        setIntegrationsStatus('succeeded');
        if (integrationList.length === 1) {
          setSelectedIntegrationId(integrationIdFromRecord(integrationList[0]));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIntegrations([]);
          setIntegrationsStatus('failed');
          setIntegrationsError(err?.message || 'Failed to load integrations');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, resetVariationPicker]);

  // Populated sync rows often omit integration.url — hydrate from get-by-id when needed.
  useEffect(() => {
    if (!open) {
      hydratedIntegrationIdsRef.current = new Set();
      return undefined;
    }
    if (loadStatus !== 'succeeded' || !list.length) return undefined;

    let cancelled = false;
    const missingIds = [];

    list.forEach((item) => {
      const integrationId = resolveSyncIntegrationId(item);
      if (!integrationId) return;
      if (hydratedIntegrationIdsRef.current.has(integrationId)) return;
      const resolved = resolveSyncIntegration(item, integrations);
      if (pickIntegrationStoreUrl(resolved) && pickIntegrationStoreLogoUrl(resolved)) return;
      missingIds.push(integrationId);
    });

    const uniqueMissing = [...new Set(missingIds)];
    if (!uniqueMissing.length) return undefined;

    uniqueMissing.forEach((id) => hydratedIntegrationIdsRef.current.add(id));

    (async () => {
      const fetched = [];
      await Promise.all(
        uniqueMissing.map(async (id) => {
          try {
            const result = await fetchIntegrationByIdRequest(id);
            const record = result?.data && typeof result.data === 'object' ? result.data : result;
            if (record && typeof record === 'object') fetched.push(record);
          } catch (err) {
            console.warn('[Sync product module] Failed to load integration for WP link', {
              integrationId: id,
              error: err,
            });
          }
        })
      );

      if (cancelled || !fetched.length) return;

      setIntegrations((prev) => {
        const byId = new Map(
          (Array.isArray(prev) ? prev : []).map((row) => [
            String(integrationIdFromRecord(row)),
            row,
          ])
        );
        fetched.forEach((row) => {
          const id = String(integrationIdFromRecord(row));
          if (!id) return;
          byId.set(id, { ...(byId.get(id) || {}), ...row });
        });
        return Array.from(byId.values());
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, loadStatus, list, integrations]);

  const parsedLink = useMemo(
    () => parseStoreProductLink(linkUrl, integrations),
    [linkUrl, integrations]
  );

  const selectedStoreVariation = useMemo(
    () =>
      storeVariations.find(
        (item) => String(item?.id || '') === String(selectedStoreVariationId)
      ) || null,
    [storeVariations, selectedStoreVariationId]
  );

  const handleSyncProduct = async () => {
    if (!productId) {
      setSyncError('Product id is missing.');
      return;
    }
    if (!selectedIntegrationId) {
      setSyncError('Please select an integration.');
      return;
    }
    if (linkUrl.trim() || storeVariations.length > 0) {
      setSyncError(
        isVariableParent
          ? 'This product already exists on Shopify. Do not press Sync. Paste the product URL in step 2 and click Link parent.'
          : isPosVariantChild
            ? 'This product already exists on Shopify. Do not press Sync. Paste the product URL in step 2, choose the variation, then click Link variation.'
            : 'This product already exists on Shopify. Do not press Sync. Paste the product URL in step 2 and click Link.'
      );
      return;
    }

    setSyncStatus('loading');
    setSyncError(null);
    setSyncSuccess(null);
    setLinkError(null);
    setLinkSuccess(null);

    try {
      await createBulkSyncProductProcessRequest(selectedIntegrationId, [productId]);
      setSyncStatus('succeeded');
      setSyncSuccess('Product sync process queued successfully.');
      loadSyncRecords();
    } catch (err) {
      setSyncStatus('failed');
      setSyncError(err?.message || 'Failed to queue product sync process');
      console.error('[Sync product module] Failed to queue single product sync', {
        productId,
        integrationId: selectedIntegrationId,
        error: err,
      });
    }
  };

  const writeLinkMapping = async (targetProductId, referenceId, integrationId) => {
    await createSyncProductRequest({
      product_id: targetProductId,
      integration_id: integrationId,
      refference_id: String(referenceId || '').trim(),
      status: 'active',
    });
  };

  const createLinkMapping = async (referenceId, integration, integrationId) => {
    await writeLinkMapping(productId, referenceId, integrationId);
    setLinkStatus('succeeded');
    setLinkSuccess(
      isVariableParent
        ? `Linked parent to ${integrationOptionLabel(integration)} (product ${referenceId}).`
        : `Linked to ${integrationOptionLabel(integration)} (ID ${referenceId}).`
    );
    if (!isVariableParent) {
      setLinkUrl('');
      resetVariationPicker();
    }
    loadSyncRecords();
  };

  const loadStoreVariationsForLink = async () => {
    const result = await fetchStoreProductVariationsRequest(
      parsedLink.integrationId,
      parsedLink.productId
    );
    const variations = Array.isArray(result?.data) ? result.data : [];
    setStoreVariations(variations);
    setStoreVariationsStatus('succeeded');
    setPendingParentRemoteId(parsedLink.productId);
    return variations;
  };

  useEffect(() => {
    if (!open) return undefined;
    if (!isPosVariantChild && !isVariableParent) return undefined;
    if (!parsedLink.productId || !parsedLink.integrationId || parsedLink.variantId) {
      return undefined;
    }
    if (!/^\d{6,}$/.test(String(parsedLink.productId))) return undefined;
    if (String(pendingParentRemoteId) === String(parsedLink.productId)) return undefined;

    let cancelled = false;
    (async () => {
      setStoreVariationsStatus('loading');
      try {
        await loadStoreVariationsForLink();
      } catch (err) {
        if (cancelled) return;
        setStoreVariationsStatus('failed');
        if (isPosVariantChild) {
          setLinkError(err?.message || 'Failed to fetch store variations');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Load once per pasted Shopify product URL (parent or child).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    isPosVariantChild,
    isVariableParent,
    parsedLink.productId,
    parsedLink.integrationId,
    parsedLink.variantId,
    pendingParentRemoteId,
  ]);

  const handleLinkExistingProduct = async () => {
    if (!productId) {
      setLinkError('Product id is missing.');
      return;
    }
    if (!linkUrl.trim()) {
      setLinkError('Please paste a store product URL.');
      return;
    }
    if (!parsedLink.productId && !parsedLink.externalProductId) {
      setLinkError(
        'Could not extract a product id from this URL. Use a WordPress edit URL (?post=189) or Shopify product/variant URL.'
      );
      return;
    }
    if (!parsedLink.integrationId) {
      setLinkError(
        'No integration matches this URL domain. Check that the store URL is saved on the integration.'
      );
      return;
    }

    const alreadyLinked = list.some((item) => {
      const rowIntegrationId =
        item?.integration_id?._id ||
        item?.integration_id?.id ||
        item?.integration_id ||
        '';
      return String(rowIntegrationId) === String(parsedLink.integrationId);
    });
    if (alreadyLinked) {
      setLinkError('This product is already linked to that integration.');
      return;
    }

    // Variable parent: one Shopify product URL → parent mapping only (no variation picker).
    if (isVariableParent && parsedLink.productId && !selectedStoreVariation) {
      setLinkStatus('loading');
      setLinkError(null);
      setLinkSuccess(null);
      setSyncError(null);
      setSyncSuccess(null);
      try {
        await createLinkMapping(
          parsedLink.productId,
          parsedLink.integration,
          parsedLink.integrationId
        );
      } catch (err) {
        setLinkStatus('failed');
        setLinkError(err?.message || 'Failed to link parent to existing store product');
        console.error('[Sync product module] Failed to link variable parent', {
          productId,
          integrationId: parsedLink.integrationId,
          refference_id: parsedLink.productId,
          error: err,
        });
      }
      return;
    }

    // Child: paste parent URL, then pick the Shopify variation from the dropdown.
    const needsVariationPick =
      isPosVariantChild &&
      parsedLink.productId &&
      !parsedLink.variantId &&
      !selectedStoreVariation;

    if (needsVariationPick) {
      setLinkStatus('loading');
      setLinkError(null);
      setLinkSuccess(null);
      setSyncError(null);
      setSyncSuccess(null);

      try {
        let variations = storeVariations;
        if (
          !variations.length ||
          String(pendingParentRemoteId) !== String(parsedLink.productId)
        ) {
          setStoreVariationsStatus('loading');
          variations = await loadStoreVariationsForLink();
        }
        setLinkStatus('idle');

        if (variations.length === 0) {
          setLinkStatus('loading');
          await createLinkMapping(
            parsedLink.productId,
            parsedLink.integration,
            parsedLink.integrationId
          );
          return;
        }

        if (variations.length === 1) {
          setLinkStatus('loading');
          const only = variations[0];
          await createLinkMapping(
            storeVariationReferenceId(only, parsedLink.productId),
            parsedLink.integration,
            parsedLink.integrationId
          );
          return;
        }

        setLinkSuccess('Select this child’s Shopify variation, then click Link variation.');
      } catch (err) {
        setStoreVariationsStatus('failed');
        setLinkStatus('failed');
        setLinkError(err?.message || 'Failed to fetch store variations');
        console.error('[Sync product module] Failed to fetch store variations', {
          productId,
          integrationId: parsedLink.integrationId,
          remoteProductId: parsedLink.productId,
          error: err,
        });
      }
      return;
    }

    const referenceId = selectedStoreVariation
      ? storeVariationReferenceId(selectedStoreVariation, parsedLink.productId)
      : parsedLink.externalProductId || parsedLink.productId;

    if (!referenceId) {
      setLinkError('Select a store variation to link.');
      return;
    }

    if (
      selectedStoreVariation &&
      pendingParentRemoteId &&
      parsedLink.productId &&
      String(parsedLink.productId) !== String(pendingParentRemoteId)
    ) {
      setLinkError('URL changed after loading variations. Submit again to reload.');
      resetVariationPicker();
      return;
    }

    setLinkStatus('loading');
    setLinkError(null);
    setLinkSuccess(null);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      await createLinkMapping(
        referenceId,
        parsedLink.integration,
        parsedLink.integrationId
      );
    } catch (err) {
      setLinkStatus('failed');
      setLinkError(err?.message || 'Failed to link existing store product');
      console.error('[Sync product module] Failed to link existing product', {
        productId,
        integrationId: parsedLink.integrationId,
        refference_id: referenceId,
        error: err,
      });
    }
  };

  const handleLinkAllMatchingVariations = async () => {
    if (!productId) {
      setLinkError('Product id is missing.');
      return;
    }
    if (!linkUrl.trim()) {
      setLinkError('Please paste a store product URL.');
      return;
    }
    if (!parsedLink.productId) {
      setLinkError(
        'Could not extract a parent product id from this URL. Paste the Shopify parent product URL, not a variant-only URL.'
      );
      return;
    }
    if (!parsedLink.integrationId) {
      setLinkError(
        'No integration matches this URL domain. Check that the store URL is saved on the integration.'
      );
      return;
    }

    setLinkStatus('loading');
    setLinkError(null);
    setLinkSuccess(null);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      let variations = storeVariations;
      if (!variations.length) {
        setStoreVariationsStatus('loading');
        variations = await loadStoreVariationsForLink();
      }

      if (!variations.length) {
        await createLinkMapping(
          parsedLink.productId,
          parsedLink.integration,
          parsedLink.integrationId
        );
        return;
      }

      const isVariable = String(productType || '').trim().toLowerCase() === 'variable';
      const currentId = String(productId || '').trim();
      const parentHint = String(parentProductId || '').trim();
      const rootId = (isVariable ? currentId : parentHint) || currentId;

      let family = [];
      try {
        const variationBody = await fetchProductVariationRequest(rootId);
        family = collectFamilyProductsFromVariationPayload(variationBody);
      } catch (err) {
        console.warn('[Sync product module] Failed to load POS variations for family link', {
          rootId,
          error: err,
        });
      }

      if (isVariable && !family.some((item) => item.id === rootId)) {
        family.unshift({
          id: rootId,
          name: decodeHtml(productName),
          sku: '',
          productType: 'variable',
        });
      }
      if (currentId && !family.some((item) => item.id === currentId)) {
        family.push({
          id: currentId,
          name: decodeHtml(productName),
          sku: '',
          productType: String(productType || '').trim().toLowerCase(),
        });
      }

      const parentPos =
        family.find((item) => item.productType === 'variable') ||
        (isVariable ? family.find((item) => item.id === currentId) : null) ||
        family.find((item) => parentHint && item.id === parentHint) ||
        null;
      const children = family.filter((item) => {
        if (parentPos && item.id === parentPos.id) return false;
        return item.productType !== 'variable';
      });

      const existingRows = await fetchSyncProductsForProductIdsRequest(
        family.map((item) => item.id),
        { populate: 'integration_id' }
      );
      const isAlreadyLinked = (posId) =>
        existingRows.some((row) => {
          const rowProduct =
            productIdFromSyncRow(row) || String(row[SYNC_ROW_QUERY_PRODUCT_ID] || '').trim();
          return (
            String(rowProduct) === String(posId) &&
            resolveSyncIntegrationId(row) === String(parsedLink.integrationId)
          );
        });

      let linkedCount = 0;
      let skippedCount = 0;
      const unmatched = [];

      const canLinkParent =
        parentPos &&
        (parentPos.productType === 'variable' || (isVariable && parentPos.id === currentId));
      if (canLinkParent) {
        if (!isAlreadyLinked(parentPos.id)) {
          await writeLinkMapping(parentPos.id, parsedLink.productId, parsedLink.integrationId);
          linkedCount += 1;
        } else {
          skippedCount += 1;
        }
      }

      const usedStoreIds = new Set();
      for (const child of children) {
        if (isAlreadyLinked(child.id)) {
          skippedCount += 1;
          continue;
        }
        const match = matchStoreVariation(child, variations, usedStoreIds);
        if (!match) {
          unmatched.push(child.name || child.id);
          continue;
        }
        usedStoreIds.add(String(match.id || ''));
        await writeLinkMapping(
          child.id,
          storeVariationReferenceId(match, parsedLink.productId),
          parsedLink.integrationId
        );
        linkedCount += 1;
      }

      setLinkStatus('succeeded');
      const unmatchedNote = unmatched.length
        ? ` Could not match: ${unmatched.join(', ')}.`
        : '';
      const skippedNote = skippedCount ? ` ${skippedCount} already linked.` : '';
      setLinkSuccess(
        `Linked ${linkedCount} mapping(s) to ${integrationOptionLabel(parsedLink.integration)} (parent + matching children).${skippedNote}${unmatchedNote}`
      );
      if (unmatched.length) {
        setLinkError(
          `Some children were not matched to a Shopify variation.${unmatchedNote} Link those one by one.`
        );
      }
      setLinkUrl('');
      resetVariationPicker();
      loadSyncRecords();
      toast.success(
        unmatched.length
          ? `Linked ${linkedCount} mapping(s). ${unmatched.length} child(ren) still need a manual match.`
          : `Linked parent and ${Math.max(linkedCount - 1, 0)} child variation(s) to the existing Shopify product.`
      );
    } catch (err) {
      setLinkStatus('failed');
      setLinkError(err?.message || 'Failed to link parent and child variations');
      console.error('[Sync product module] Failed to link family to existing store product', {
        productId,
        integrationId: parsedLink.integrationId,
        remoteProductId: parsedLink.productId,
        error: err,
      });
    }
  };

  const pickSyncPrice = (item) => {
    const raw = item?.sync_price ?? item?.syncPrice ?? '';
    if (raw == null || raw === '') return '';
    return String(raw);
  };

  const handleToggleStatus = async (syncId, isCurrentlyActive) => {
    if (!syncId) return;

    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    setTogglingSyncId(syncId);
    setToggleError(null);

    try {
      await updateSyncProductRequest(syncId, { status: newStatus });
      setList((prev) =>
        prev.map((item) =>
          syncIdFromRecord(item) === syncId ? { ...item, status: newStatus } : item
        )
      );
    } catch (err) {
      setToggleError(err?.message || 'Failed to update sync status');
      console.error('[Sync product module] Failed to toggle sync status', { syncId, error: err });
    } finally {
      setTogglingSyncId(null);
    }
  };

  const handleSyncPriceChange = (syncId, value) => {
    setSyncPriceDrafts((prev) => ({ ...prev, [syncId]: value }));
    if (syncPriceError) setSyncPriceError(null);
  };

  const handleSyncPriceSave = async (item) => {
    const syncId = syncIdFromRecord(item);
    if (!syncId) return;

    const current = pickSyncPrice(item);
    const next =
      syncPriceDrafts[syncId] !== undefined ? String(syncPriceDrafts[syncId]) : current;
    if (String(next) === String(current)) return;

    setSavingSyncPriceId(syncId);
    setSyncPriceError(null);

    try {
      await updateSyncProductRequest(syncId, { sync_price: next });
      setList((prev) =>
        prev.map((row) =>
          syncIdFromRecord(row) === syncId ? { ...row, sync_price: next } : row
        )
      );
      setSyncPriceDrafts((prev) => {
        const copy = { ...prev };
        delete copy[syncId];
        return copy;
      });
      toast.success('Sync price updated successfully.');
    } catch (err) {
      setSyncPriceError(err?.message || 'Failed to update sync price');
      console.error('[Sync product module] Failed to update sync_price', { syncId, error: err });
    } finally {
      setSavingSyncPriceId(null);
    }
  };

  const handleUnlinkStore = async (item) => {
    const syncId = syncIdFromRecord(item);
    if (!syncId) return;

    const storeLabel = integrationLabel(item.integration_id);
    const integrationId = resolveSyncIntegrationId(item);
    const isVariable = String(productType || '').trim().toLowerCase() === 'variable';
    const cascadeChildren = isVariable || isPosVariantChild;
    const confirmed = window.confirm(
      cascadeChildren
        ? `Unlink this product and all of its child variations from "${storeLabel}"? This cannot be undone.`
        : `Unlink this product from "${storeLabel}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setUnlinkingSyncId(syncId);
    setUnlinkError(null);

    try {
      const syncIdsToDelete = new Set([String(syncId)]);

      if (cascadeChildren) {
        const familyIds = new Set();
        const currentId = String(productId || '').trim();
        const parentId = String(parentProductId || '').trim();
        const rootId = isVariable ? currentId : parentId || currentId;
        if (currentId) familyIds.add(currentId);
        if (rootId) familyIds.add(rootId);

        if (rootId) {
          try {
            const variationBody = await fetchProductVariationRequest(rootId);
            collectIdsFromVariationPayload(variationBody).forEach((id) => familyIds.add(id));
          } catch (err) {
            console.warn('[Sync product module] Failed to load variations for unlink cascade', {
              rootId,
              error: err,
            });
          }
        }

        try {
          const familyRows = await fetchSyncProductsForProductIdsRequest([...familyIds], {
            populate: 'integration_id',
            limit: 50,
          });
          (Array.isArray(familyRows) ? familyRows : []).forEach((row) => {
            const rowSyncId = String(syncIdFromRecord(row) || '').trim();
            if (!rowSyncId) return;
            const rowIntegrationId = resolveSyncIntegrationId(row);
            if (integrationId && rowIntegrationId && rowIntegrationId !== integrationId) return;
            syncIdsToDelete.add(rowSyncId);
          });
        } catch (err) {
          console.warn('[Sync product module] Failed to load family sync rows for unlink', {
            familyIds: [...familyIds],
            error: err,
          });
        }
      }

      const deleteIds = [...syncIdsToDelete];
      const results = await Promise.allSettled(
        deleteIds.map((id) => deleteSyncProductRequest(id))
      );
      const succeededIds = deleteIds.filter((_, index) => results[index].status === 'fulfilled');
      const failed = results.length - succeededIds.length;

      if (succeededIds.length === 0) {
        const firstError = results.find((result) => result.status === 'rejected')?.reason;
        throw firstError instanceof Error
          ? firstError
          : new Error(firstError?.message || 'Failed to unlink store');
      }

      setList((prev) =>
        prev.filter((row) => !succeededIds.includes(String(syncIdFromRecord(row) || '')))
      );
      toast.success(
        succeededIds.length > 1
          ? `Unlinked from ${storeLabel} (${succeededIds.length} mappings, including child variations).`
          : `Unlinked from ${storeLabel}.`
      );
      if (failed > 0) {
        toast.warning(`${failed} related mapping(s) could not be unlinked.`);
      }
      if (typeof onUnlinked === 'function') onUnlinked();
    } catch (err) {
      setUnlinkError(err?.message || 'Failed to unlink store');
      console.error('[Sync product module] Failed to unlink store product', {
        syncId,
        error: err,
      });
    } finally {
      setUnlinkingSyncId(null);
    }
  };

  const handleSyncNow = async (item) => {
    const syncId = syncIdFromRecord(item);
    const integrationId = resolveSyncIntegrationId(item);
    const busyId = syncId || integrationId;
    if (!productId) {
      setSyncNowError('Product id is missing.');
      return;
    }
    if (!integrationId) {
      setSyncNowError('Integration id is missing for this store.');
      return;
    }

    setSyncingNowId(busyId);
    setSyncNowError(null);

    try {
      await createBulkSyncProductProcessRequest(integrationId, [productId]);
      const syncedAt = new Date().toISOString();
      if (syncId) {
        setList((prev) =>
          prev.map((row) =>
            syncIdFromRecord(row) === syncId
              ? { ...row, last_synced_at: syncedAt, updatedAt: syncedAt }
              : row
          )
        );
        try {
          await updateSyncProductRequest(syncId, { last_synced_at: syncedAt });
        } catch (stampErr) {
          console.warn('[Sync product module] Failed to stamp last_synced_at', {
            syncId,
            error: stampErr,
          });
          const currentStatus = String(item?.status || '').trim();
          if (currentStatus) {
            try {
              await updateSyncProductRequest(syncId, { status: currentStatus });
            } catch (statusErr) {
              console.warn('[Sync product module] Failed to bump sync timestamp', {
                syncId,
                error: statusErr,
              });
            }
          }
        }
      }
      toast.success(`Sync queued for ${integrationLabel(item.integration_id)}.`);
    } catch (err) {
      setSyncNowError(err?.message || 'Failed to queue product sync');
      console.error('[Sync product module] Failed to queue row sync now', {
        productId,
        integrationId,
        syncId,
        error: err,
      });
    } finally {
      setSyncingNowId(null);
    }
  };

  const title = productName ? decodeHtml(productName) : 'Product';
  const variationPickRequired = isPosVariantChild && storeVariations.length > 1;
  const submitDisabled =
    linkStatus === 'loading' ||
    !linkUrl.trim() ||
    !productId ||
    (isPosVariantChild && storeVariationsStatus === 'loading') ||
    (variationPickRequired && !selectedStoreVariationId);
  const primaryLinkLabel = isVariableParent
    ? 'Link parent'
    : variationPickRequired || (isPosVariantChild && parsedLink.variantId)
      ? 'Link variation'
      : 'Link';
  const linkStepHint = isVariableParent
    ? 'Paste the Shopify product URL once (…/products/10608704782635). That links this parent only. Optionally use Link matching children, or open each child and pick a variation.'
    : isPosVariantChild
      ? 'Paste the Shopify parent product URL, then choose this child’s variation from the dropdown.'
      : 'Paste the existing Shopify product URL to link this POS product. This does not create a new store product.';

  const storeVariationRemoteId = pendingParentRemoteId || parsedLink.productId || '';
  const apiSources = useMemo(() => {
    if (!DEBUG) return [];

    const syncListQuery = new URLSearchParams();
    if (productId) syncListQuery.set('product_id', String(productId));
    syncListQuery.set('populate', 'product_id,integration_id');

    const storeVariationsUrl =
      parsedLink.integrationId && storeVariationRemoteId
        ? buildApiUrl(
            `integration/store-product-variations/${encodeURIComponent(parsedLink.integrationId)}/${encodeURIComponent(storeVariationRemoteId)}`
          )
        : buildApiUrl('integration/store-product-variations/:integrationId/:remoteProductId');

    const updateBusy = Boolean(togglingSyncId || savingSyncPriceId);
    const unlinkBusy = Boolean(unlinkingSyncId);

    return [
      {
        key: 'sync-products',
        label: 'Sync records',
        url: buildApiUrl(`sync_product/get-all?${syncListQuery.toString()}`),
        status: mapLoadStatus(loadStatus),
        durationMs: null,
        error: loadStatus === 'failed' ? error : null,
      },
      {
        key: 'integrations',
        label: 'Active integrations',
        url: buildApiUrl('integration/get-all-active'),
        status: mapLoadStatus(integrationsStatus),
        durationMs: null,
        error: integrationsStatus === 'failed' ? integrationsError : null,
      },
      {
        key: 'integration-by-id',
        label: 'Integration by id (store URL)',
        url: buildApiUrl('integration/get/:id'),
        status: 'pending',
        durationMs: null,
        error: null,
      },
      {
        key: 'sync-process',
        label: 'Queue product sync (POST)',
        url: buildApiUrl('process/bulk-create'),
        status: syncingNowId
          ? 'loading'
          : mapLoadStatus(syncStatus) !== 'pending'
            ? mapLoadStatus(syncStatus)
            : syncNowError
              ? 'error'
              : 'pending',
        durationMs: null,
        error: syncNowError || (syncStatus === 'failed' ? syncError : null),
      },
      {
        key: 'link-product',
        label: 'Link store product (POST)',
        url: buildApiUrl('sync_product/create'),
        status: mapLoadStatus(linkStatus),
        durationMs: null,
        error: linkStatus === 'failed' ? linkError : null,
      },
      {
        key: 'store-variations',
        label: 'Store product variations',
        url: storeVariationsUrl,
        status: mapLoadStatus(storeVariationsStatus),
        durationMs: null,
        error: storeVariationsStatus === 'failed' ? linkError : null,
      },
      {
        key: 'update-sync',
        label: 'Update sync (status / price)',
        url: buildApiUrl('sync_product/update/:id'),
        status: updateBusy ? 'loading' : toggleError || syncPriceError ? 'error' : 'pending',
        durationMs: null,
        error: toggleError || syncPriceError || null,
      },
      {
        key: 'unlink-product',
        label: 'Unlink store product (DELETE)',
        url: unlinkingSyncId
          ? buildApiUrl(`sync_product/delete/${encodeURIComponent(unlinkingSyncId)}`)
          : buildApiUrl('sync_product/delete/:id'),
        status: unlinkBusy ? 'loading' : unlinkError ? 'error' : 'pending',
        durationMs: null,
        error: unlinkError,
      },
    ];
  }, [
    productId,
    loadStatus,
    error,
    integrationsStatus,
    integrationsError,
    syncStatus,
    syncError,
    linkStatus,
    linkError,
    storeVariationsStatus,
    parsedLink.integrationId,
    storeVariationRemoteId,
    togglingSyncId,
    savingSyncPriceId,
    toggleError,
    syncPriceError,
    unlinkingSyncId,
    unlinkError,
    syncingNowId,
    syncNowError,
  ]);

  const footer = (
    <>
      <DevApiSourcesFooter
        sources={apiSources}
        title="API request URLs"
        className="ps-modal-api-sources"
      />
      <span className="ps-footer-note d-none d-sm-inline">
        {loadStatus === 'succeeded' && list.length > 0
          ? `${list.length} connected store${list.length === 1 ? '' : 's'}`
          : 'Manage sync for this product'}
      </span>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onClose}>
        Close
      </button>
    </>
  );

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title="Product Sync"
      subtitle={
        <>
          Push or link store products for{' '}
          <span className="ps-product-pill">
            <i className="fas fa-box-open" aria-hidden="true" />
            <span>{title}</span>
          </span>
        </>
      }
      footer={footer}
      ariaLabelledBy="viewProductSyncModalLabel"
    >
      <div className="ps-modal">
        <section className="ps-step">
          <div className="ps-step-head">
            <span className="ps-step-num" aria-hidden="true">
              1
            </span>
            <div>
              <h6 className="ps-step-title">Sync this product</h6>
              <p className="ps-step-hint">
                Use this only to create a new store product. If it already exists on
                Shopify, skip Sync and use Link in step 2.
              </p>
            </div>
          </div>
          <div className="ps-step-body">
            {integrationsStatus === 'loading' && (
              <div className="ps-records-loading">
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Loading integrations…
              </div>
            )}

            {integrationsStatus === 'failed' && (
              <div className="alert alert-danger py-2 mb-0">{integrationsError}</div>
            )}

            {integrationsStatus === 'succeeded' && integrations.length === 0 && (
              <div className="alert alert-warning py-2 mb-0">
                No active integrations found. Add one under Integrations first.
              </div>
            )}

            {integrationsStatus === 'succeeded' && integrations.length > 0 && (
              <div className="ps-action-row">
                <div>
                  <label htmlFor="viewProductSyncIntegration" className="form-label">
                    Integration <span className="text-danger">*</span>
                  </label>
                  <select
                    id="viewProductSyncIntegration"
                    className="form-select"
                    value={selectedIntegrationId}
                    onChange={(e) => {
                      setSelectedIntegrationId(e.target.value);
                      if (syncError) setSyncError(null);
                      if (syncSuccess) setSyncSuccess(null);
                    }}
                    disabled={syncStatus === 'loading'}
                  >
                    <option value="">Select integration…</option>
                    {integrations.map((item) => {
                      const id = integrationIdFromRecord(item);
                      return (
                        <option key={id} value={id}>
                          {integrationOptionLabel(item)}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary ps-action-btn mb-0"
                  onClick={handleSyncProduct}
                  disabled={syncStatus === 'loading' || !selectedIntegrationId || !productId}
                >
                  {syncStatus === 'loading' ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      Syncing…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sync-alt me-1" aria-hidden="true" />
                      Sync
                    </>
                  )}
                </button>
              </div>
            )}

            {syncError && <div className="alert alert-danger py-2 mt-3 mb-0">{syncError}</div>}
            {syncSuccess && (
              <div className="alert alert-success py-2 mt-3 mb-0">{syncSuccess}</div>
            )}
          </div>
        </section>

        <section className="ps-step">
          <div className="ps-step-head">
            <span className="ps-step-num" aria-hidden="true">
              2
            </span>
            <div>
              <h6 className="ps-step-title">
                Link existing store product
                <span className="ps-role-pill">
                  {isVariableParent
                    ? 'Variable parent'
                    : isPosVariantChild
                      ? 'Child variation'
                      : 'Single product'}
                </span>
              </h6>
              <p className="ps-step-hint">{linkStepHint}</p>
            </div>
          </div>
          <div className="ps-step-body">
            {integrationsStatus === 'succeeded' && integrations.length > 0 && (
              <>
                <div className="ps-action-row">
                  <div>
                    <label htmlFor="viewProductSyncLinkUrl" className="form-label">
                      Store product URL <span className="text-danger">*</span>
                    </label>
                    <input
                      id="viewProductSyncLinkUrl"
                      type="url"
                      className="form-control"
                      placeholder="https://admin.shopify.com/store/.../products/10489827983541"
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        if (linkError) setLinkError(null);
                        if (linkSuccess) setLinkSuccess(null);
                        if (storeVariations.length || storeVariationsStatus !== 'idle') {
                          resetVariationPicker();
                        }
                      }}
                      disabled={linkStatus === 'loading'}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary ps-action-btn mb-0"
                    onClick={handleLinkExistingProduct}
                    disabled={submitDisabled}
                  >
                    {linkStatus === 'loading' ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Linking…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-link me-1" aria-hidden="true" />
                        {primaryLinkLabel}
                      </>
                    )}
                  </button>
                </div>

                {linkUrl.trim() ? (
                  <div className="ps-detect">
                    <i className="fas fa-info-circle" aria-hidden="true" />
                    <div>
                      {parsedLink.integration ? (
                        <span>
                          Detected:{' '}
                          <strong>{integrationOptionLabel(parsedLink.integration)}</strong>
                          {parsedLink.externalProductId
                            ? parsedLink.variantId
                              ? ` · Reference ${parsedLink.externalProductId} (product + variant)`
                              : isVariableParent
                                ? ` · Product ID ${parsedLink.productId || parsedLink.externalProductId} · click Link parent`
                                : isPosVariantChild
                                  ? ` · Product ID ${parsedLink.productId || parsedLink.externalProductId} · pick a variation below`
                                  : ` · Product ID ${parsedLink.productId || parsedLink.externalProductId}`
                            : ' · product id not found in URL'}
                        </span>
                      ) : (
                        <span>No matching integration for this domain yet.</span>
                      )}
                    </div>
                  </div>
                ) : null}

                {storeVariationsStatus === 'loading' ? (
                  <div className="text-muted text-sm mt-3 mb-0">
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Loading store variations…
                  </div>
                ) : null}

                {isPosVariantChild && storeVariations.length > 1 ? (
                  <div className="ps-variation-field">
                    <label htmlFor="viewProductSyncStoreVariation" className="form-label">
                      Store variation <span className="text-danger">*</span>
                    </label>
                    <select
                      id="viewProductSyncStoreVariation"
                      className="form-select"
                      value={selectedStoreVariationId}
                      onChange={(e) => {
                        setSelectedStoreVariationId(e.target.value);
                        if (linkError) setLinkError(null);
                        if (linkSuccess) setLinkSuccess(null);
                      }}
                      disabled={linkStatus === 'loading'}
                    >
                      <option value="">Select variation…</option>
                      {storeVariations.map((variation) => {
                        const id = String(variation?.id || '');
                        return (
                          <option key={id} value={id}>
                            {variationOptionLabel(variation)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : null}

                {isVariableParent && storeVariations.length > 0 ? (
                  <div className="ps-link-all-row">
                    <button
                      type="button"
                      className="btn btn-primary ps-action-btn mb-0"
                      onClick={handleLinkAllMatchingVariations}
                      disabled={
                        linkStatus === 'loading' ||
                        storeVariationsStatus === 'loading' ||
                        !linkUrl.trim() ||
                        !productId
                      }
                    >
                      {linkStatus === 'loading' ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          />
                          Linking…
                        </>
                      ) : (
                        <>
                          <i className="fas fa-link me-1" aria-hidden="true" />
                          Link matching children
                        </>
                      )}
                    </button>
                    <p className="ps-step-hint mb-0">
                      Optional. Maps every matching child to a Shopify variation from this
                      same product URL. Does not create a new store product.
                    </p>
                  </div>
                ) : null}
              </>
            )}

            {integrationsStatus === 'succeeded' && integrations.length === 0 && (
              <div className="alert alert-warning py-2 mb-0">
                No active integrations found. Add one under Integrations first.
              </div>
            )}

            {linkError && <div className="alert alert-danger py-2 mt-3 mb-0">{linkError}</div>}
            {linkSuccess && (
              <div className="alert alert-success py-2 mt-3 mb-0">{linkSuccess}</div>
            )}
          </div>
        </section>

        <section className="ps-step">
          <div className="ps-step-head">
            <span className="ps-step-num" aria-hidden="true">
              3
            </span>
            <div>
              <h6 className="ps-step-title">Connected integrations</h6>
              <p className="ps-step-hint">
                Review sync price, status, and when each store was last linked. Sync now to push
                this product again, or unlink to remove the mapping. Unlinking a variable product
                also unlinks all of its child variations.
              </p>
            </div>
          </div>
          <div className="ps-step-body">
            {toggleError ? (
              <div className="alert alert-danger py-2 mb-3">{toggleError}</div>
            ) : null}
            {syncPriceError ? (
              <div className="alert alert-danger py-2 mb-3">{syncPriceError}</div>
            ) : null}
            {unlinkError ? (
              <div className="alert alert-danger py-2 mb-3">{unlinkError}</div>
            ) : null}
            {syncNowError ? (
              <div className="alert alert-danger py-2 mb-3">{syncNowError}</div>
            ) : null}

            {loadStatus === 'loading' && (
              <div className="ps-records-loading">
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Loading sync records…
              </div>
            )}

            {loadStatus === 'failed' && (
              <div className="alert alert-danger py-2 mb-0">{error}</div>
            )}

            {loadStatus === 'succeeded' && list.length === 0 && (
              <div className="ps-records-empty">
                No sync records found for this product yet.
              </div>
            )}

            {loadStatus === 'succeeded' && list.length > 0 && (
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead>
                    <tr>
                      <th>Integration</th>
                      <th className="text-center">Sync price</th>
                      <th className="text-center">Status</th>
                      <th className="text-end">Synced at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item, index) => {
                      const rowId = syncIdFromRecord(item);
                      const active = isSyncActive(item);
                      const syncedAt = pickSyncedAt(item);
                      const priceValue =
                        syncPriceDrafts[rowId] !== undefined
                          ? syncPriceDrafts[rowId]
                          : pickSyncPrice(item);
                      const referenceId = pickSyncReferenceId(item);
                      const integration = resolveSyncIntegration(item, integrations);
                      const wpAdminUrl = buildWooCommerceProductAdminUrl(
                        integration,
                        referenceId
                      );
                      const wooProductId = pickWooCommerceProductId(referenceId);
                      const shopifyAdminUrl = buildShopifyProductAdminUrl(integration, referenceId);
                      const shopifyProductId = pickShopifyProductIds(referenceId).productId;
                      const storeAdminUrl = shopifyAdminUrl || wpAdminUrl || '';
                      const storeLogoTitle = shopifyAdminUrl
                        ? `Open in Shopify (product ${shopifyProductId})`
                        : wpAdminUrl
                          ? `Open in WordPress (post ${wooProductId})`
                          : integrationLabel(integration || item.integration_id);
                      return (
                        <tr key={rowId || index}>
                          <td>
                            <div className="ps-integration-cell">
                              <div className="ps-integration-row">
                                <ConnectedStoreLogo
                                  integration={integration}
                                  href={storeAdminUrl || undefined}
                                  title={storeLogoTitle}
                                />
                                <span className="ps-integration-name">
                                  {integrationLabel(integration || item.integration_id)}
                                </span>
                                {wpAdminUrl ? (
                                  <a
                                    href={wpAdminUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ps-wp-link"
                                    title={`Open in WordPress (post ${wooProductId})`}
                                    aria-label="Open in WordPress"
                                  >
                                    WP
                                  </a>
                                ) : null}
                                {shopifyAdminUrl ? (
                                  <a
                                    href={shopifyAdminUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ps-wp-link"
                                    title={`Open in Shopify (product ${shopifyProductId})`}
                                    aria-label="Open in Shopify"
                                  >
                                    Shopify
                                  </a>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="ps-unlink-btn"
                                onClick={() => handleUnlinkStore(item)}
                                disabled={!rowId || Boolean(unlinkingSyncId)}
                                title={
                                  String(productType || '').trim().toLowerCase() === 'variable' ||
                                  isPosVariantChild
                                    ? 'Unlink this product and all child variations from this store'
                                    : 'Unlink this product from this store'
                                }
                                aria-label={`Unlink from ${integrationLabel(item.integration_id)}`}
                              >
                                {unlinkingSyncId === rowId ? (
                                  <>
                                    <span
                                      className="spinner-border spinner-border-sm"
                                      role="status"
                                      aria-hidden="true"
                                    />
                                    Unlinking…
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-unlink" aria-hidden="true" />
                                    Unlink
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="text-center" style={{ minWidth: '7.5rem' }}>
                            <div className="d-inline-flex align-items-center justify-content-center gap-2">
                              <input
                                type="number"
                                className="form-control form-control-sm ps-price-input"
                                value={priceValue}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                disabled={!rowId || savingSyncPriceId === rowId}
                                onChange={(e) => handleSyncPriceChange(rowId, e.target.value)}
                                onBlur={() => handleSyncPriceSave(item)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                aria-label="Sync price"
                              />
                              {savingSyncPriceId === rowId ? (
                                <span
                                  className="spinner-border spinner-border-sm text-primary"
                                  role="status"
                                  style={{ width: '1rem', height: '1rem' }}
                                >
                                  <span className="visually-hidden">Saving…</span>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="ps-status-cell">
                              <div className="form-check form-switch mb-0">
                                <input
                                  className="form-check-input m-0"
                                  type="checkbox"
                                  role="switch"
                                  id={`sync-toggle-${rowId || index}`}
                                  checked={active}
                                  onChange={() => handleToggleStatus(rowId, active)}
                                  disabled={!rowId || togglingSyncId === rowId}
                                  aria-label={active ? 'Active' : 'Inactive'}
                                  title={active ? 'Active' : 'Inactive'}
                                  style={{
                                    width: '2.5rem',
                                    height: '1.25rem',
                                    cursor:
                                      togglingSyncId === rowId ? 'not-allowed' : 'pointer',
                                  }}
                                />
                              </div>
                              <span
                                className={`ps-status-label ${active ? 'is-active' : 'is-inactive'}`}
                              >
                                {togglingSyncId === rowId
                                  ? 'Saving…'
                                  : active
                                    ? 'Active'
                                    : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="ps-synced-at-cell">
                              <span
                                className="ps-synced-at"
                                title={
                                  syncedAt
                                    ? moment(syncedAt).format('MM-DD-YYYY h:mm a')
                                    : undefined
                                }
                              >
                                {syncedAt ? moment(syncedAt).fromNow() : '—'}
                              </span>
                              <button
                                type="button"
                                className="ps-sync-now-btn"
                                onClick={() => handleSyncNow(item)}
                                disabled={
                                  !productId ||
                                  !resolveSyncIntegrationId(item) ||
                                  syncingNowId === rowId ||
                                  unlinkingSyncId === rowId
                                }
                                title="Queue a sync for this store now"
                                aria-label={`Sync now to ${integrationLabel(item.integration_id)}`}
                              >
                                {syncingNowId === rowId ? (
                                  <>
                                    <span
                                      className="spinner-border spinner-border-sm"
                                      role="status"
                                      aria-hidden="true"
                                    />
                                    Syncing…
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-sync-alt" aria-hidden="true" />
                                    Sync now
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppModal>
  );
}
