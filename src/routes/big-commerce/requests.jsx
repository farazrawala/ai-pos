import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaCheck, FaGear, FaStore, FaXmark } from 'react-icons/fa6';
import {
  approveStoreRequestRequest,
  cancelStoreRequestRequest,
  fetchMarketplaceCompanyProfileRequest,
  fetchReceivedStoreRequestsRequest,
  fetchSentStoreRequestsRequest,
  normalizeConnectionSyncSettings,
  rejectStoreRequestRequest,
} from '../../features/bigCommerce/bigCommerceAPI.js';
import { buildApiUrl, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import DevApiSourcesFooter from '../../components/common/DevApiSourcesFooter.jsx';
import ConnectedStoreSettingsModal from '../../components/bigCommerce/ConnectedStoreSettingsModal.jsx';
import { DEBUG } from '../../config/env.js';
import { companyStorePath } from '../../features/bigCommerce/marketplaceUtils.js';
import { showToast } from '../../utils/toast.js';
import '../../components/common/devApiSources.css';
import './big-commerce.css';

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
];

function companyIdFrom(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id ?? value.id ?? '').trim();
}

function companyNameFrom(value) {
  if (!value) return 'Company';
  if (typeof value === 'string') return 'Company';
  return String(value.company_name ?? value.name ?? 'Company').trim() || 'Company';
}

function companyLogoFrom(value) {
  if (!value || typeof value !== 'object') return '';
  return resolveCategoryMediaUrl(
    value.company_logo || value.logo || value.bigcommerce_logo || ''
  );
}

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function personName(value) {
  if (!value || typeof value !== 'object') return '';
  return String(value.name || value.email || '').trim();
}

export default function BigCommerceRequestsPage() {
  useRequireModuleAccess('big-commerce');
  const navigate = useNavigate();
  const [direction, setDirection] = useState('received');
  const [statusTab, setStatusTab] = useState('pending');
  const [grouped, setGrouped] = useState({
    pending: [],
    approved: [],
    rejected: [],
    cancelled: [],
  });
  const [total, setTotal] = useState(0);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [actingId, setActingId] = useState('');
  const [openingStoreId, setOpeningStoreId] = useState('');
  const [settingsConnection, setSettingsConnection] = useState(null);

  const load = useCallback(async () => {
    setLoadStatus('loading');
    setLoadError('');
    try {
      const result =
        direction === 'sent'
          ? await fetchSentStoreRequestsRequest()
          : await fetchReceivedStoreRequestsRequest();
      setGrouped(result.grouped);
      setTotal(result.total);
      setLoadStatus('succeeded');
    } catch (err) {
      setLoadStatus('failed');
      setLoadError(err?.message || 'Failed to load store requests');
    }
  }, [direction]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: grouped.pending.length,
      approved: grouped.approved.length,
      rejected: grouped.rejected.length,
      cancelled: grouped.cancelled.length,
    }),
    [grouped]
  );

  const rows = grouped[statusTab] || [];

  const runAction = async (fn, successMessage) => {
    try {
      await fn();
      showToast({ message: successMessage, variant: 'success' });
      await load();
    } catch (err) {
      showToast({ message: err?.message || 'Action failed', variant: 'error' });
    } finally {
      setActingId('');
    }
  };

  const handleApprove = (row) => {
    const id = String(row._id || '');
    if (!id) return;
    setActingId(id);
    runAction(() => approveStoreRequestRequest(id), 'Request approved.');
  };

  const handleReject = (row) => {
    const id = String(row._id || '');
    if (!id) return;
    setActingId(id);
    runAction(() => rejectStoreRequestRequest(id), 'Request rejected.');
  };

  const handleCancel = (row) => {
    const id = String(row._id || '');
    if (!id) return;
    setActingId(id);
    runAction(() => cancelStoreRequestRequest(id), 'Request cancelled.');
  };

  const handleSettingsSaved = (nextSettings) => {
    const id = String(settingsConnection?._id || '');
    if (!id) return;
    const sync = normalizeConnectionSyncSettings(nextSettings || {});
    setGrouped((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = (next[key] || []).map((row) =>
          String(row._id || '') === id ? { ...row, ...sync } : row
        );
      }
      return next;
    });
  };

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];
    return [
      {
        key: 'requests-received',
        label: 'Received requests',
        url: buildApiUrl('big-commerce/requests/received'),
        status: direction === 'received' ? (loadStatus === 'failed' ? 'error' : loadStatus === 'succeeded' ? 'success' : loadStatus === 'loading' ? 'loading' : 'pending') : 'pending',
        durationMs: null,
        error: direction === 'received' && loadStatus === 'failed' ? loadError : null,
      },
      {
        key: 'requests-sent',
        label: 'Sent requests',
        url: buildApiUrl('big-commerce/requests/sent'),
        status: direction === 'sent' ? (loadStatus === 'failed' ? 'error' : loadStatus === 'succeeded' ? 'success' : loadStatus === 'loading' ? 'loading' : 'pending') : 'pending',
        durationMs: null,
        error: direction === 'sent' && loadStatus === 'failed' ? loadError : null,
      },
    ];
  }, [direction, loadStatus, loadError]);

  return (
    <div className="container-fluid py-4 px-3">
      <div className="bc-listing-page">
        <header className="bc-listing-header">
          <div className="bc-listing-header-copy">
            <p className="bc-listing-eyebrow mb-0">Big Commerce</p>
            <h1 className="bc-listing-title">Store requests</h1>
            <p className="bc-listing-subtitle mb-0">
              Review incoming connection requests, or check what you have sent.
            </p>
          </div>
          <Link to="/big-commerce" className="bc-btn bc-btn-ghost bc-listing-header-action">
            <FaStore aria-hidden="true" />
            View stores
          </Link>
        </header>

        <div className="card border-0 bc-listing-card">
          <div className="card-header bg-transparent border-0 pt-3 px-3 pb-2">
            <div className="bc-request-dir-tabs" role="tablist" aria-label="Request direction">
              <button
                type="button"
                role="tab"
                aria-selected={direction === 'received'}
                className={`bc-listing-tab ${direction === 'received' ? 'is-active' : ''}`}
                onClick={() => {
                  setDirection('received');
                  setStatusTab('pending');
                }}
              >
                <span className="bc-listing-tab-label">Received</span>
                {direction === 'received' ? (
                  <span className="bc-listing-tab-count">{total}</span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={direction === 'sent'}
                className={`bc-listing-tab ${direction === 'sent' ? 'is-active' : ''}`}
                onClick={() => {
                  setDirection('sent');
                  setStatusTab('pending');
                }}
              >
                <span className="bc-listing-tab-label">Sent</span>
                {direction === 'sent' ? (
                  <span className="bc-listing-tab-count">{total}</span>
                ) : null}
              </button>
            </div>

            <div className="bc-request-status-tabs" role="tablist" aria-label="Request status">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusTab === tab.id}
                  className={`bc-status-chip ${statusTab === tab.id ? 'is-active' : ''} is-${tab.id}`}
                  onClick={() => setStatusTab(tab.id)}
                >
                  {tab.label}
                  <span>{counts[tab.id] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pb-3">
            {loadStatus === 'loading' ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading…</span>
                </div>
                <p className="text-sm text-muted mt-3 mb-0">Loading requests…</p>
              </div>
            ) : null}

            {loadStatus === 'failed' ? (
              <div className="alert alert-danger mb-0" role="alert">
                {loadError}
                <div className="mt-2">
                  <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={load}>
                    Retry
                  </button>
                </div>
              </div>
            ) : null}

            {loadStatus === 'succeeded' && rows.length === 0 ? (
              <div className="bc-empty my-4">
                <h3>No {statusTab} requests</h3>
                <p>
                  {direction === 'received'
                    ? 'When another company sends you a store request, it will appear here.'
                    : 'Requests you send from View stores will appear here.'}
                </p>
              </div>
            ) : null}

            {loadStatus === 'succeeded' && rows.length > 0 ? (
              <div className="bc-request-list">
                {rows.map((row) => {
                  const id = String(row._id || '');
                  const partner =
                    direction === 'received'
                      ? row.sender_company || row.company_id
                      : row.target_company_id;
                  const partnerId = companyIdFrom(partner);
                  const partnerSlug =
                    partner && typeof partner === 'object'
                      ? String(partner.company_slug ?? partner.companySlug ?? partner.slug ?? '').trim()
                      : '';
                  const name = companyNameFrom(partner);
                  const logo = companyLogoFrom(partner);
                  const requester = personName(row.requested_by);
                  const busy = actingId === id;
                  const canApproveReject = direction === 'received' && row.status === 'pending';
                  const canCancel = direction === 'sent' && row.status === 'pending';
                  const canManageSettings = row.status === 'approved';

                  return (
                    <article key={id} className="bc-request-row">
                      <div className="bc-request-identity">
                        {logo ? (
                          <img className="bc-request-avatar" src={logo} alt="" />
                        ) : (
                          <div className="bc-request-avatar bc-request-avatar--fallback">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h5 className="bc-request-name">{name}</h5>
                          <p className="bc-request-meta mb-0">
                            {requester ? `Requested by ${requester}` : 'Store connection request'}
                            {row.createdAt ? ` · ${formatWhen(row.createdAt)}` : ''}
                          </p>
                          {row.remarks ? (
                            <p className="bc-request-remarks mb-0">{row.remarks}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="bc-request-actions">
                        <span className={`bc-status-badge is-${row.status}`}>{row.status}</span>
                        {partnerId ? (
                          <button
                            type="button"
                            className="bc-btn bc-btn-ghost bc-btn-sm"
                            disabled={openingStoreId === partnerId}
                            onClick={async () => {
                              if (partnerSlug) {
                                navigate(companyStorePath({ id: partnerId, slug: partnerSlug }));
                                return;
                              }
                              setOpeningStoreId(partnerId);
                              try {
                                const profile = await fetchMarketplaceCompanyProfileRequest(partnerId);
                                const slug = String(profile?.slug || '').trim();
                                navigate(
                                  companyStorePath(slug ? { id: partnerId, slug } : partnerId)
                                );
                              } catch {
                                navigate(companyStorePath(partner || partnerId));
                              } finally {
                                setOpeningStoreId('');
                              }
                            }}
                          >
                            {openingStoreId === partnerId ? 'Opening…' : 'View store'}
                          </button>
                        ) : null}
                        {canManageSettings ? (
                          <button
                            type="button"
                            className="bc-btn bc-btn-ghost bc-btn-sm"
                            onClick={() => setSettingsConnection(row)}
                          >
                            <FaGear aria-hidden="true" />
                            Settings
                          </button>
                        ) : null}
                        {canApproveReject ? (
                          <>
                            <button
                              type="button"
                              className="bc-btn bc-btn-primary bc-btn-sm"
                              disabled={busy}
                              onClick={() => handleApprove(row)}
                            >
                              <FaCheck aria-hidden="true" />
                              {busy ? 'Saving…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              className="bc-btn bc-btn-ghost bc-btn-sm"
                              disabled={busy}
                              onClick={() => handleReject(row)}
                            >
                              <FaXmark aria-hidden="true" />
                              Reject
                            </button>
                          </>
                        ) : null}
                        {canCancel ? (
                          <button
                            type="button"
                            className="bc-btn bc-btn-ghost bc-btn-sm"
                            disabled={busy}
                            onClick={() => handleCancel(row)}
                          >
                            {busy ? 'Cancelling…' : 'Cancel request'}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ConnectedStoreSettingsModal
        open={Boolean(settingsConnection)}
        connection={settingsConnection}
        partnerName={
          settingsConnection
            ? companyNameFrom(
                direction === 'received'
                  ? settingsConnection.sender_company || settingsConnection.company_id
                  : settingsConnection.target_company_id
              )
            : 'store'
        }
        onClose={() => setSettingsConnection(null)}
        onSaved={handleSettingsSaved}
      />

      <DevApiSourcesFooter sources={apiSources} className="mt-3" />
    </div>
  );
}
