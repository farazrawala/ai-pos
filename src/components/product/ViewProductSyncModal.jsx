import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import AppModal from '../AppModal.jsx';
import {
  fetchIntegrationByIdRequest,
  fetchIntegrationsRequest,
  fetchStoreProductVariationsRequest,
} from '../../features/integration/integrationAPI.js';
import { createBulkSyncProductProcessRequest } from '../../features/process/processAPI.js';
import {
  createSyncProductRequest,
  fetchSyncProductsRequest,
  updateSyncProductRequest,
} from '../../features/syncProduct/syncProductAPI.js';
import { parseStoreProductLink } from '../../utils/parseStoreProductUrl.js';
import { toast } from '../../utils/toast.js';
import './view-product-sync-modal.css';

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

const variationOptionLabel = (variation) => {
  const name = decodeHtml(variation?.name || `Variation ${variation?.id || ''}`);
  const sku = String(variation?.sku || '').trim();
  const ref = String(variation?.reference_id || variation?.id || '').trim();
  const parts = [name];
  if (sku) parts.push(`SKU ${sku}`);
  if (ref) parts.push(`ID ${ref}`);
  return parts.join(' · ');
};

export default function ViewProductSyncModal({
  open,
  productId,
  productName,
  parentProductId = '',
  onClose,
}) {
  const isPosVariantChild =
    Boolean(String(parentProductId || '').trim()) || looksLikeVariantName(productName);

  const [list, setList] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [togglingSyncId, setTogglingSyncId] = useState(null);
  const [toggleError, setToggleError] = useState(null);
  const [syncPriceDrafts, setSyncPriceDrafts] = useState({});
  const [savingSyncPriceId, setSavingSyncPriceId] = useState(null);
  const [syncPriceError, setSyncPriceError] = useState(null);

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
    setSyncPriceDrafts({});
    setSavingSyncPriceId(null);

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
      if (pickIntegrationStoreUrl(resolved)) return;
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

  const createLinkMapping = async (referenceId, integration, integrationId) => {
    await createSyncProductRequest({
      product_id: productId,
      integration_id: integrationId,
      refference_id: referenceId,
      status: 'active',
    });
    setLinkStatus('succeeded');
    setLinkSuccess(
      `Linked to ${integrationOptionLabel(integration)} (ID ${referenceId}).`
    );
    setLinkUrl('');
    resetVariationPicker();
    loadSyncRecords();
  };

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

    // Product URL without variant → fetch store variations and let user pick
    const needsVariationPick =
      parsedLink.productId && !parsedLink.variantId && !selectedStoreVariation;

    if (needsVariationPick) {
      setLinkStatus('loading');
      setLinkError(null);
      setLinkSuccess(null);
      setSyncError(null);
      setSyncSuccess(null);
      setStoreVariationsStatus('loading');
      setStoreVariations([]);
      setSelectedStoreVariationId('');
      setPendingParentRemoteId(parsedLink.productId);

      try {
        const result = await fetchStoreProductVariationsRequest(
          parsedLink.integrationId,
          parsedLink.productId
        );
        const variations = Array.isArray(result?.data) ? result.data : [];
        setStoreVariations(variations);
        setStoreVariationsStatus('succeeded');
        setLinkStatus('idle');

        if (variations.length === 0) {
          // Simple product — link parent id only
          setLinkStatus('loading');
          await createLinkMapping(
            parsedLink.productId,
            parsedLink.integration,
            parsedLink.integrationId
          );
          return;
        }

        if (variations.length === 1) {
          // Single remote variant — link automatically as product:variant
          setLinkStatus('loading');
          const only = variations[0];
          await createLinkMapping(
            String(only.reference_id || `${parsedLink.productId}:${only.id}`),
            parsedLink.integration,
            parsedLink.integrationId
          );
          return;
        }

        setLinkSuccess(
          `Found ${variations.length} variation(s). Select the matching one, then click Link variation.`
        );
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
      ? String(selectedStoreVariation.reference_id || '').trim()
      : parsedLink.externalProductId;

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

  const title = productName ? decodeHtml(productName) : 'Product';
  const submitDisabled =
    linkStatus === 'loading' ||
    storeVariationsStatus === 'loading' ||
    !linkUrl.trim() ||
    !productId ||
    (storeVariations.length > 1 && !selectedStoreVariationId);

  const footer = (
    <>
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
                Push only this product to the selected store integration.
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
              <h6 className="ps-step-title">Link existing store product</h6>
              <p className="ps-step-hint">
                {isPosVariantChild
                  ? 'Paste the parent store product URL (Shopify/WordPress). Variations are loaded so you can pick the matching one.'
                  : 'Paste a store product URL. If it has variations, you can pick one; otherwise it links the product id.'}
              </p>
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
                      disabled={linkStatus === 'loading' || storeVariationsStatus === 'loading'}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary ps-action-btn mb-0"
                    onClick={handleLinkExistingProduct}
                    disabled={submitDisabled}
                  >
                    {linkStatus === 'loading' || storeVariationsStatus === 'loading' ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        {storeVariationsStatus === 'loading' ? 'Loading…' : 'Linking…'}
                      </>
                    ) : storeVariations.length > 1 ? (
                      <>
                        <i className="fas fa-link me-1" aria-hidden="true" />
                        Link variation
                      </>
                    ) : (
                      <>
                        <i className="fas fa-link me-1" aria-hidden="true" />
                        Link
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
                              : ` · Product ID ${parsedLink.productId || parsedLink.externalProductId} · will load variations on Link`
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

                {storeVariations.length > 1 ? (
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
                Review sync price, status, and when each store was last linked.
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
                      return (
                        <tr key={rowId || index}>
                          <td>
                            <div className="ps-integration-cell">
                              <span className="ps-integration-name">
                                {integrationLabel(item.integration_id)}
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
                          <td
                            className="text-end ps-synced-at"
                            title={
                              item.createdAt
                                ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                : undefined
                            }
                          >
                            {item.createdAt ? moment(item.createdAt).fromNow() : '—'}
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
