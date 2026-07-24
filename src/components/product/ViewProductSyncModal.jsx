import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
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

  if (!open) return null;

  const title = productName ? decodeHtml(productName) : 'Product';
  const submitDisabled =
    linkStatus === 'loading' ||
    storeVariationsStatus === 'loading' ||
    !linkUrl.trim() ||
    !productId ||
    (storeVariations.length > 1 && !selectedStoreVariationId);

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="viewProductSyncModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="viewProductSyncModalLabel">
                Product Sync — {title}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="card border mb-4">
                <div className="card-body py-3">
                  <h6 className="mb-2">Sync this product</h6>
                  <p className="text-sm text-muted mb-3">
                    Push only this product to the selected store integration.
                  </p>

                  {integrationsStatus === 'loading' && (
                    <div className="text-muted text-sm">
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
                    <div className="row g-2 align-items-end">
                      <div className="col-md-8">
                        <label htmlFor="viewProductSyncIntegration" className="form-label mb-1">
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
                      <div className="col-md-4">
                        <button
                          type="button"
                          className="btn btn-primary w-100 mb-0"
                          onClick={handleSyncProduct}
                          disabled={
                            syncStatus === 'loading' ||
                            !selectedIntegrationId ||
                            !productId
                          }
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
                            'Sync'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {syncError && <div className="alert alert-danger py-2 mt-3 mb-0">{syncError}</div>}
                  {syncSuccess && (
                    <div className="alert alert-success py-2 mt-3 mb-0">{syncSuccess}</div>
                  )}
                </div>
              </div>

              <div className="card border mb-4">
                <div className="card-body py-3">
                  <h6 className="mb-2">Link existing store product</h6>
                  <p className="text-sm text-muted mb-3">
                    {isPosVariantChild
                      ? 'Paste the parent store product URL (Shopify/WordPress). Variations are loaded so you can pick the matching one.'
                      : 'Paste a store product URL. If it has variations, you can pick one; otherwise it links the product id.'}
                  </p>

                  {integrationsStatus === 'succeeded' && integrations.length > 0 && (
                    <>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-9">
                          <label htmlFor="viewProductSyncLinkUrl" className="form-label mb-1">
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
                        <div className="col-md-3">
                          <button
                            type="button"
                            className="btn btn-outline-primary w-100 mb-0"
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
                              'Link variation'
                            ) : (
                              'Submit'
                            )}
                          </button>
                        </div>
                      </div>

                      {linkUrl.trim() ? (
                        <div className="text-sm text-muted mt-2 mb-0">
                          {parsedLink.integration ? (
                            <span>
                              Detected:{' '}
                              <strong>{integrationOptionLabel(parsedLink.integration)}</strong>
                              {parsedLink.externalProductId
                                ? parsedLink.variantId
                                  ? ` · Reference ${parsedLink.externalProductId} (product + variant)`
                                  : ` · Product ID ${parsedLink.productId || parsedLink.externalProductId} · will load variations on Submit`
                                : ' · product id not found in URL'}
                            </span>
                          ) : (
                            <span>No matching integration for this domain yet.</span>
                          )}
                        </div>
                      ) : null}

                      {storeVariationsStatus === 'loading' ? (
                        <div className="text-muted text-sm mt-3 mb-0">
                          <span className="spinner-border spinner-border-sm me-2" role="status" />
                          Loading store variations…
                        </div>
                      ) : null}

                      {storeVariations.length > 1 ? (
                        <div className="mt-3">
                          <label
                            htmlFor="viewProductSyncStoreVariation"
                            className="form-label mb-1"
                          >
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
              </div>

              {toggleError ? (
                <div className="alert alert-danger py-2 mb-3">{toggleError}</div>
              ) : null}
              {syncPriceError ? (
                <div className="alert alert-danger py-2 mb-3">{syncPriceError}</div>
              ) : null}

              {loadStatus === 'loading' && (
                <div className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading sync records…
                </div>
              )}

              {loadStatus === 'failed' && (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              )}

              {loadStatus === 'succeeded' && list.length === 0 && (
                <div className="alert alert-warning py-2 mb-0">
                  No sync records found for this product.
                </div>
              )}

              {loadStatus === 'succeeded' && list.length > 0 && (
                <div className="table-responsive">
                  <table className="table align-items-center mb-0">
                    <thead>
                      <tr>
                        <th>Integration</th>
                        <th className="text-center" style={{ width: '3rem' }} />
                        <th className="text-center">Sync Price</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Synced At</th>
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
                            <td className="text-sm">{integrationLabel(item.integration_id)}</td>
                            <td className="text-center">
                              {wpAdminUrl ? (
                                <a
                                  href={wpAdminUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-outline-primary py-0 px-2"
                                  title={`Open in WordPress (post ${wooProductId})`}
                                  aria-label="Open in WordPress"
                                >
                                  WP
                                </a>
                              ) : (
                                <span
                                  className="text-muted"
                                  title={
                                    !referenceId
                                      ? 'No store reference id on this sync record'
                                      : !pickIntegrationStoreUrl(integration)
                                        ? 'Integration store URL missing'
                                        : 'WordPress link unavailable'
                                  }
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td className="text-sm text-center" style={{ minWidth: '7.5rem' }}>
                              <div className="d-inline-flex align-items-center justify-content-center gap-2">
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-center"
                                  style={{ maxWidth: '6.5rem' }}
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
                            <td className="text-sm text-center">
                              <div className="d-inline-flex align-items-center justify-content-center gap-2">
                                <div className="form-check form-switch mb-0 d-flex justify-content-center">
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
                                      cursor: togglingSyncId === rowId ? 'not-allowed' : 'pointer',
                                    }}
                                  />
                                </div>
                                {togglingSyncId === rowId ? (
                                  <span
                                    className="spinner-border spinner-border-sm text-primary"
                                    role="status"
                                    style={{ width: '1rem', height: '1rem' }}
                                  >
                                    <span className="visually-hidden">Loading...</span>
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td
                              className="text-sm text-center text-nowrap"
                              title={
                                item.createdAt
                                  ? moment(item.createdAt).format('MM-DD-YYYY h:mm a')
                                  : undefined
                              }
                            >
                              {item.createdAt ? moment(item.createdAt).fromNow() : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary mb-0" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}
