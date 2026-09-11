import { useState } from 'react';
import {
  integrationNameFromRecord,
  storeTypeLabel,
} from '../../routes/integration/integrationForm.js';
import { pickIntegrationStoreLogoUrl } from '../../features/integration/integrationAPI.js';
import { buildShopifyProductAdminUrl, pickShopifyProductIds } from '../../utils/parseStoreProductUrl.js';

const integrationIdFromRecord = (item) =>
  String(item?._id || item?.id || item?.integration_id || '').trim();

const resolveSyncIntegrationId = (syncRow) => {
  const populated =
    syncRow?.integration_id && typeof syncRow.integration_id === 'object'
      ? syncRow.integration_id
      : null;
  return String(
    populated?._id ||
      populated?.id ||
      (typeof syncRow?.integration_id === 'string' || typeof syncRow?.integration_id === 'number'
        ? syncRow.integration_id
        : '') ||
      ''
  ).trim();
};

const resolveIntegrationRecord = (syncRow, integrationsList = []) => {
  const populated =
    syncRow?.integration_id && typeof syncRow.integration_id === 'object'
      ? syncRow.integration_id
      : null;
  const integrationId = resolveSyncIntegrationId(syncRow);

  const fromList = Array.isArray(integrationsList)
    ? integrationsList.find((row) => {
        const rowId = integrationIdFromRecord(row);
        if (integrationId && rowId === integrationId) return true;
        const populatedName = populated?.store_name || populated?.storeName || populated?.name;
        const rowName = row?.store_name || row?.storeName || row?.name;
        return Boolean(populatedName && rowName && populatedName === rowName);
      })
    : null;

  if (fromList || populated) {
    return { ...(populated || {}), ...(fromList || {}) };
  }
  return populated;
};

const integrationTitle = (integration) => {
  if (!integration || typeof integration !== 'object') return 'Integration';
  const name = integrationNameFromRecord(integration);
  const storeType = integration?.store_type || integration?.storeType || '';
  return storeType ? `${name} (${storeTypeLabel(storeType)})` : name;
};

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
    const productId = raw.product_id ?? raw.productId ?? raw.id ?? raw._id ?? '';
    const variantId = raw.variant_id ?? raw.variantId ?? '';
    const product = String(productId || raw.reference_id || raw.refference_id || '').trim();
    const variant = String(variantId || '').trim();
    if (product && variant) return `${product}:${variant}`;
    return product;
  }
  return String(raw).trim();
};

const isShopifyStoreType = (integration) =>
  String(integration?.store_type || integration?.storeType || '').toLowerCase() === 'shopify';

const isInactiveSyncRow = (row) => {
  const status = String(row?.status ?? '').trim().toLowerCase();
  return status === 'inactive' || status === 'disabled' || status === 'false' || status === '0' || status === 'no';
};

const trackingLinesForSync = (syncRow, integration) => {
  const referenceId = pickSyncReferenceId(syncRow);
  if (!referenceId) return [];

  if (isShopifyStoreType(integration) || /^\d+(:\d+)?$/.test(referenceId) || /gid:\/\/shopify\//i.test(referenceId)) {
    const { productId, variantId } = pickShopifyProductIds(referenceId);
    const lines = [];
    if (productId) lines.push({ key: 'product', label: 'product', value: productId });
    if (variantId) lines.push({ key: 'variant', label: 'variant', value: variantId });
    if (lines.length) return lines;
  }

  return [{ key: 'ref', label: 'id', value: referenceId }];
};

function IntegrationBadge({ integration, onClick, href, title: titleOverride }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = pickIntegrationStoreLogoUrl(integration);
  const title =
    titleOverride ||
    (href
      ? `Open product in Shopify — ${integrationTitle(integration)}`
      : integrationTitle(integration));
  const name = integrationNameFromRecord(integration);
  const shortName = name.length > 10 ? `${name.slice(0, 9)}…` : name;

  const content =
    logoUrl && !logoFailed ? (
      <img
        src={logoUrl}
        alt={name}
        className="list-integration-logo"
        onError={() => setLogoFailed(true)}
      />
    ) : (
      <span className="list-integration-name" title={title}>
        {shortName}
      </span>
    );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="list-integration-badge list-integration-badge--link"
        title={title}
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  if (typeof onClick === 'function') {
    return (
      <button
        type="button"
        className="list-integration-badge list-integration-badge--btn"
        title={title}
        aria-label={title}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <span className="list-integration-badge" title={title} aria-label={title}>
      {content}
    </span>
  );
}

/**
 * Shows which store integrations a product is actively synced to (logos + Shopify ids).
 */
export default function ProductIntegrationsCell({
  syncRows = [],
  integrations = [],
  totalIntegrations = 0,
  onClick,
  loading = false,
}) {
  if (loading) {
    return (
      <span className="text-muted text-sm" aria-busy="true">
        …
      </span>
    );
  }

  const linkedRows = (Array.isArray(syncRows) ? syncRows : []).filter((row) => !isInactiveSyncRow(row));

  if (!linkedRows.length) {
    return <span className="text-muted">—</span>;
  }

  const seen = new Set();
  const linkedIntegrations = [];

  for (const row of linkedRows) {
    const integration = resolveIntegrationRecord(row, integrations);
    const id = integrationIdFromRecord(integration) || resolveSyncIntegrationId(row);
    const referenceId = pickSyncReferenceId(row);
    const key = `${id || integrationTitle(integration)}:${referenceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    linkedIntegrations.push({
      integration: integration || { name: 'Integration', _id: key },
      syncRow: row,
    });
  }

  const total = Number(totalIntegrations) || 0;
  const summary =
    total > 0
      ? `Synced to ${linkedIntegrations.length} of ${total} integration${total === 1 ? '' : 's'}`
      : `Synced to ${linkedIntegrations.length} integration${linkedIntegrations.length === 1 ? '' : 's'}`;

  return (
    <div className="list-integrations-cell" title={summary}>
      <div className="list-integrations-cell__badges">
        {linkedIntegrations.map(({ integration, syncRow }) => {
          const id = integrationIdFromRecord(integration) || integrationTitle(integration);
          const referenceId = pickSyncReferenceId(syncRow);
          const shopifyHref = isShopifyStoreType(integration)
            ? buildShopifyProductAdminUrl(integration, referenceId)
            : '';
          const lines = trackingLinesForSync(syncRow, integration);
          const shopifyTitle = shopifyHref
            ? `Open in Shopify — ${integrationTitle(integration)}`
            : integrationTitle(integration);
          return (
            <div key={`${id}:${referenceId}`} className="list-integration-track">
              <IntegrationBadge
                integration={integration}
                href={shopifyHref || undefined}
                title={shopifyTitle}
                onClick={
                  typeof onClick === 'function'
                    ? (e) => {
                        e.stopPropagation();
                        onClick(e);
                      }
                    : undefined
                }
              />
              {lines.length ? (
                <div className="list-integration-ids">
                  {lines.map((line) => (
                    <span
                      key={line.key}
                      className={`list-integration-id${line.key === 'variant' ? ' list-integration-id--variant' : ''}`}
                      title={`Shopify ${line.label} ${line.value}`}
                    >
                      <span className="list-integration-id__label">{line.label}</span>
                      {shopifyHref ? (
                        <a
                          href={shopifyHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="list-integration-id__value"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {line.value}
                        </a>
                      ) : (
                        <span className="list-integration-id__value">{line.value}</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
