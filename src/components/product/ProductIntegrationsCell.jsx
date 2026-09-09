import { useState } from 'react';
import {
  integrationNameFromRecord,
  storeTypeLabel,
} from '../../routes/integration/integrationForm.js';
import { pickIntegrationStoreLogoUrl } from '../../features/integration/integrationAPI.js';
import { buildShopifyProductAdminUrl } from '../../utils/parseStoreProductUrl.js';

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
    ? integrationsList.find((row) => integrationIdFromRecord(row) === integrationId)
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
 * Shows which store integrations a product is actively synced to (logos, or names as fallback).
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

  const activeRows = (Array.isArray(syncRows) ? syncRows : []).filter(
    (row) => String(row?.status || '').trim().toLowerCase() === 'active'
  );

  if (!activeRows.length) {
    return <span className="text-muted">—</span>;
  }

  const seen = new Set();
  const linkedIntegrations = [];

  for (const row of activeRows) {
    const integration = resolveIntegrationRecord(row, integrations);
    const id = integrationIdFromRecord(integration) || resolveSyncIntegrationId(row);
    const key = id || integrationTitle(integration);
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
    <div
      className="list-integrations-cell"
      title={summary}
      onClick={typeof onClick === 'function' ? onClick : undefined}
      onKeyDown={
        typeof onClick === 'function'
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      role={typeof onClick === 'function' ? 'button' : undefined}
      tabIndex={typeof onClick === 'function' ? 0 : undefined}
    >
      <div className="list-integrations-cell__badges">
        {linkedIntegrations.map(({ integration, syncRow }) => {
          const id = integrationIdFromRecord(integration) || integrationTitle(integration);
          const referenceId = pickSyncReferenceId(syncRow);
          const shopifyHref = isShopifyStoreType(integration)
            ? buildShopifyProductAdminUrl(integration, referenceId)
            : '';
          const shopifyTitle = shopifyHref
            ? `Open in Shopify — ${integrationTitle(integration)} (ID ${referenceId})`
            : undefined;
          return (
            <IntegrationBadge
              key={id}
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
          );
        })}
      </div>
    </div>
  );
}
