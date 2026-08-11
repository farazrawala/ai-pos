import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaGear,
  FaInbox,
  FaLocationDot,
  FaMagnifyingGlass,
  FaPaperPlane,
  FaPhone,
  FaStore,
  FaXmark,
} from 'react-icons/fa6';
import {
  fetchMarketplaceCompanies,
  sendCompanyStoreRequest,
  setCompaniesSearch,
  clearStoreRequestStatus,
  selectBigCommerce,
} from '../../features/bigCommerce/bigCommerceSlice.js';
import {
  cancelStoreRequestRequest,
  fetchMarketplaceCompanyProfileRequest,
  fetchSentStoreRequestsRequest,
  normalizeConnectionSyncSettings,
} from '../../features/bigCommerce/bigCommerceAPI.js';
import { companyStorePath, normalizeCompanyProfile } from '../../features/bigCommerce/marketplaceUtils.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import AppModal from '../../components/AppModal.jsx';
import ConnectedStoreSettingsModal from '../../components/bigCommerce/ConnectedStoreSettingsModal.jsx';
import DevApiSourcesFooter from '../../components/common/DevApiSourcesFooter.jsx';
import { buildApiUrl } from '../../config/apiConfig.js';
import { DEBUG } from '../../config/env.js';
import { showToast } from '../../utils/toast.js';
import '../../components/common/devApiSources.css';
import './big-commerce.css';

function mapOutgoingConnections(rows) {
  const next = {};
  (rows || []).forEach((row) => {
    const target = row.target_company_id;
    const companyId =
      typeof target === 'object'
        ? String(target?._id ?? target?.id ?? '').trim()
        : String(target || '').trim();
    if (!companyId) return;
    if (row.status !== 'pending' && row.status !== 'approved') return;
    const requestId = String(row._id || row.id || '').trim();
    next[companyId] = {
      status: row.status,
      requestId,
      connection: row,
      settings: normalizeConnectionSyncSettings(row),
    };
  });
  return next;
}

function CompanyCardSkeleton() {
  return (
    <article className="bc-company-card bc-company-card--skeleton" aria-hidden="true">
      <div className="bc-company-banner bc-skeleton" />
      <div className="bc-company-card-body">
        <div className="bc-company-identity">
          <div className="bc-company-avatar bc-skeleton" />
          <div className="bc-company-identity-text">
            <div className="bc-skeleton bc-skeleton-line w-70" />
            <div className="bc-skeleton bc-skeleton-line w-50" />
          </div>
        </div>
        <div className="bc-skeleton bc-skeleton-line w-90" />
        <div className="bc-skeleton bc-skeleton-line w-80" />
        <div className="bc-company-actions">
          <div className="bc-skeleton" style={{ height: 34, borderRadius: 8 }} />
          <div className="bc-skeleton" style={{ height: 34, borderRadius: 8 }} />
        </div>
      </div>
    </article>
  );
}

const mapLoadStatus = (status) => {
  if (status === 'loading' || status === 'loadingMore') return 'loading';
  if (status === 'failed') return 'error';
  if (status === 'succeeded') return 'success';
  return 'pending';
};

export default function BigCommerceListingPage() {
  useRequireModuleAccess('big-commerce');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sessionCompanyId = useSelector(selectCompanyId);
  const {
    companies,
    companiesSearch,
    companiesPagination,
    companiesStatus,
    companiesError,
    companiesHasMore,
    storeRequestStatus,
    storeRequestError,
    storeRequestTargetId,
  } = useSelector(selectBigCommerce);

  const [localSearch, setLocalSearch] = useState(companiesSearch || '');
  const searchTimeoutRef = useRef(null);
  const [openingStoreId, setOpeningStoreId] = useState('');
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [outgoingByCompanyId, setOutgoingByCompanyId] = useState({});
  const [cancellingRequestId, setCancellingRequestId] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [settingsTarget, setSettingsTarget] = useState(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const initialLoading = companiesStatus === 'loading' && companies.length === 0;
  const loadingMore = companiesStatus === 'loadingMore';
  const isBusy = companiesStatus === 'loading' || companiesStatus === 'loadingMore';

  useEffect(() => {
    loadingRef.current = isBusy;
  }, [isBusy]);

  // Initial / search-driven fetch (always page 1, replace)
  useEffect(() => {
    dispatch(
      fetchMarketplaceCompanies({
        page: 1,
        limit: companiesPagination.limit,
        search: companiesSearch,
        append: false,
      })
    );
  }, [dispatch, companiesSearch, companiesPagination.limit]);

  const loadNextPage = useCallback(() => {
    if (loadingRef.current) return;
    if (!companiesHasMore) return;
    if (companiesStatus === 'failed' && companies.length === 0) return;

    const nextPage = (companiesPagination.page || 1) + 1;
    dispatch(
      fetchMarketplaceCompanies({
        page: nextPage,
        limit: companiesPagination.limit,
        search: companiesSearch,
        append: true,
      })
    );
  }, [
    dispatch,
    companiesHasMore,
    companiesStatus,
    companies.length,
    companiesPagination.page,
    companiesPagination.limit,
    companiesSearch,
  ]);

  // Infinite scroll via IntersectionObserver (viewport / page scroll)
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadNextPage();
      },
      {
        root: null,
        rootMargin: '240px 0px',
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage, companies.length]);

  const refreshOutgoingRequests = useCallback(async () => {
    const result = await fetchSentStoreRequestsRequest();
    setOutgoingByCompanyId(mapOutgoingConnections(result.rows));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSentStoreRequestsRequest()
      .then((result) => {
        if (cancelled) return;
        setOutgoingByCompanyId(mapOutgoingConnections(result.rows));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (storeRequestStatus === 'succeeded') {
      showToast({ message: 'Store request sent.', variant: 'success' });
      if (requestTarget?.id) {
        setOutgoingByCompanyId((prev) => ({
          ...prev,
          [String(requestTarget.id)]: {
            status: 'pending',
            requestId: prev[String(requestTarget.id)]?.requestId || '',
          },
        }));
      }
      setRequestTarget(null);
      setRequestMessage('');
      dispatch(clearStoreRequestStatus());
      refreshOutgoingRequests().catch(() => {});
    } else if (storeRequestStatus === 'failed' && storeRequestError) {
      showToast({ message: storeRequestError, variant: 'error' });
      dispatch(clearStoreRequestStatus());
    }
  }, [
    storeRequestStatus,
    storeRequestError,
    dispatch,
    requestTarget,
    refreshOutgoingRequests,
  ]);

  const handleSearchChange = (value) => {
    setLocalSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      dispatch(setCompaniesSearch(value));
    }, 350);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const rows = useMemo(
    () =>
      (companies || [])
        .map((raw) => normalizeCompanyProfile(raw))
        .filter((c) => c.id && c.showStoreForListing !== false),
    [companies]
  );

  const getOutgoingConnection = useCallback(
    (companyId) => outgoingByCompanyId[String(companyId)] || null,
    [outgoingByCompanyId]
  );

  const getConnectionStatus = useCallback(
    (companyId) => getOutgoingConnection(companyId)?.status || '',
    [getOutgoingConnection]
  );

  const connectionCounts = useMemo(() => {
    let connected = 0;
    let requested = 0;
    let available = 0;
    rows.forEach((company) => {
      const status = getConnectionStatus(company.id);
      if (status === 'approved') connected += 1;
      else if (status === 'pending') requested += 1;
      else available += 1;
    });
    return {
      all: rows.length,
      connected,
      requested,
      available,
    };
  }, [rows, getConnectionStatus]);

  const filteredRows = useMemo(() => {
    if (connectionFilter === 'all') return rows;
    return rows.filter((company) => {
      const status = getConnectionStatus(company.id);
      if (connectionFilter === 'connected') return status === 'approved';
      if (connectionFilter === 'requested') return status === 'pending';
      if (connectionFilter === 'available') {
        return status !== 'approved' && status !== 'pending';
      }
      return true;
    });
  }, [rows, connectionFilter, getConnectionStatus]);

  const connectionTabs = useMemo(
    () => [
      { id: 'all', label: 'All', count: connectionCounts.all },
      { id: 'connected', label: 'Connected', count: connectionCounts.connected },
      { id: 'requested', label: 'Requested', count: connectionCounts.requested },
      { id: 'available', label: 'Not connected', count: connectionCounts.available },
    ],
    [connectionCounts]
  );

  const openRequestModal = useCallback((company) => {
    setRequestTarget(company);
    setRequestMessage('');
  }, []);

  const openStore = useCallback(
    async (company) => {
      if (company?.slug) {
        navigate(companyStorePath(company));
        return;
      }
      const id = String(company?.id || '').trim();
      if (!id) return;
      setOpeningStoreId(id);
      try {
        const profile = await fetchMarketplaceCompanyProfileRequest(id);
        const slug = String(profile?.slug || '').trim();
        navigate(companyStorePath(slug ? { ...company, slug } : company));
      } catch {
        navigate(companyStorePath(company));
      } finally {
        setOpeningStoreId('');
      }
    },
    [navigate]
  );

  const submitRequest = () => {
    if (!requestTarget?.id) return;
    dispatch(
      sendCompanyStoreRequest({
        companyId: requestTarget.id,
        message: requestMessage,
      })
    );
  };

  const handleCancelRequest = useCallback(
    async (company) => {
      const companyId = String(company?.id || '').trim();
      const outgoing = getOutgoingConnection(companyId);
      const requestId = String(outgoing?.requestId || '').trim();
      if (!companyId || !requestId || outgoing?.status !== 'pending') {
        showToast({
          message: 'Unable to cancel this request. Try refreshing the page.',
          variant: 'error',
        });
        return;
      }

      setCancellingRequestId(requestId);
      try {
        await cancelStoreRequestRequest(requestId);
        setOutgoingByCompanyId((prev) => {
          const next = { ...prev };
          delete next[companyId];
          return next;
        });
        showToast({ message: 'Request cancelled.', variant: 'success' });
      } catch (err) {
        showToast({
          message: err?.message || 'Failed to cancel request',
          variant: 'error',
        });
      } finally {
        setCancellingRequestId('');
      }
    },
    [getOutgoingConnection]
  );

  const requesting =
    storeRequestStatus === 'loading' &&
    storeRequestTargetId === String(requestTarget?.id || '');

  const apiSources = useMemo(() => {
    if (!DEBUG) return [];

    const page = Math.max(1, Number(companiesPagination.page) || 1);
    const limit = Math.max(1, Number(companiesPagination.limit) || 20);
    const skip = (page - 1) * limit;
    const listQuery = new URLSearchParams({
      limit: String(limit),
      skip: String(skip),
    });
    const search = String(companiesSearch || '').trim();
    if (search) listQuery.set('search', search);

    return [
      {
        key: 'companies-listing',
        label: 'View stores',
        url: buildApiUrl(`company/get-all-for-listing?${listQuery.toString()}`),
        status: mapLoadStatus(companiesStatus),
        durationMs: null,
        error: companiesStatus === 'failed' ? companiesError : null,
      },
      {
        key: 'store-request',
        label: 'Send store request',
        url: buildApiUrl('big-commerce/connection/request'),
        status: mapLoadStatus(storeRequestStatus),
        durationMs: null,
        error: storeRequestStatus === 'failed' ? storeRequestError : null,
      },
      {
        key: 'store-requests-inbox',
        label: 'Received requests',
        url: buildApiUrl('big-commerce/requests/received'),
        status: 'pending',
        durationMs: null,
        error: null,
      },
    ];
  }, [
    companiesPagination.page,
    companiesPagination.limit,
    companiesSearch,
    companiesStatus,
    companiesError,
    storeRequestStatus,
    storeRequestError,
  ]);

  return (
    <div className="container-fluid py-4 px-3">
      <div className="bc-listing-page">
        <header className="bc-listing-header">
          <div className="bc-listing-header-copy">
            <p className="bc-listing-eyebrow mb-0">Big Commerce</p>
            <h1 className="bc-listing-title">View stores</h1>
            <p className="bc-listing-subtitle mb-0">
              Browse partner companies, request a connection, or open their marketplace.
            </p>
          </div>
          <Link to="/big-commerce/requests" className="bc-btn bc-btn-ghost bc-listing-header-action">
            <FaInbox aria-hidden="true" />
            Store requests
          </Link>
        </header>

        <section className="bc-listing-panel" aria-label="Company directory">
          <div className="bc-listing-toolbar">
            <div className="bc-search-wrap bc-listing-search">
              <FaMagnifyingGlass className="bc-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="bc-search-input"
                placeholder="Search by company name…"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label="Search companies"
              />
            </div>
            {!initialLoading ? (
              <p className="bc-result-summary mb-0">
                {connectionFilter === 'all'
                  ? companiesPagination.total
                    ? `${rows.length.toLocaleString()} of ${companiesPagination.total.toLocaleString()} companies`
                    : `${rows.length.toLocaleString()} companies`
                  : `${filteredRows.length.toLocaleString()} ${
                      connectionFilter === 'connected'
                        ? 'connected'
                        : connectionFilter === 'requested'
                          ? 'requested'
                          : 'not connected'
                    }`}
              </p>
            ) : null}
          </div>

          {!initialLoading && rows.length > 0 ? (
            <div className="bc-listing-tabs" role="tablist" aria-label="Connection status">
              {connectionTabs.map((tab) => {
                const isActive = connectionFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`bc-listing-tab ${isActive ? 'is-active' : ''}`}
                    onClick={() => setConnectionFilter(tab.id)}
                  >
                    <span className="bc-listing-tab-label">{tab.label}</span>
                    <span className="bc-listing-tab-count">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {initialLoading ? (
            <div className="bc-company-grid" aria-busy="true" aria-label="Loading companies">
              <CompanyCardSkeleton />
              <CompanyCardSkeleton />
              <CompanyCardSkeleton />
            </div>
          ) : null}

          {!initialLoading && companiesStatus === 'failed' && rows.length === 0 ? (
            <div className="bc-listing-state bc-listing-state--error" role="alert">
              <h3>Couldn’t load companies</h3>
              <p>{companiesError || 'Something went wrong. Please try again.'}</p>
              <button
                type="button"
                className="bc-btn bc-btn-primary"
                onClick={() =>
                  dispatch(
                    fetchMarketplaceCompanies({
                      page: 1,
                      limit: companiesPagination.limit,
                      search: companiesSearch,
                      append: false,
                    })
                  )
                }
              >
                Retry
              </button>
            </div>
          ) : null}

          {!initialLoading && rows.length === 0 && companiesStatus === 'succeeded' ? (
            <div className="bc-listing-state">
              <FaStore aria-hidden="true" />
              <h3>No companies found</h3>
              <p>
                {localSearch.trim()
                  ? 'Try a different search term.'
                  : 'There are no stores available to browse yet.'}
              </p>
            </div>
          ) : null}

          {!initialLoading &&
          rows.length > 0 &&
          filteredRows.length === 0 &&
          companiesStatus !== 'failed' ? (
            <div className="bc-listing-state">
              <FaStore aria-hidden="true" />
              <h3>No stores in this filter</h3>
              <p>
                {connectionFilter === 'connected'
                  ? 'You are not connected to any of the loaded stores yet.'
                  : connectionFilter === 'requested'
                    ? 'You have no pending requests for the loaded stores.'
                    : 'No stores match this connection filter.'}
              </p>
              <button
                type="button"
                className="bc-btn bc-btn-ghost"
                onClick={() => setConnectionFilter('all')}
              >
                Show all stores
              </button>
            </div>
          ) : null}

          {filteredRows.length > 0 ? (
            <div className="bc-company-grid">
              {filteredRows.map((company) => {
                const isSelf = sessionCompanyId && company.id === String(sessionCompanyId);
                const requestEnabled = company.showStoreForRequest === true;
                const outgoing = getOutgoingConnection(company.id);
                const outgoingStatus = outgoing?.status || '';
                const outgoingRequestId = String(outgoing?.requestId || '').trim();
                const alreadyRequested =
                  outgoingStatus === 'pending' || outgoingStatus === 'approved';
                const canCancelRequest =
                  !isSelf && outgoingStatus === 'pending' && Boolean(outgoingRequestId);
                const canManageSettings =
                  !isSelf && outgoingStatus === 'approved' && Boolean(outgoingRequestId);
                const cancelling =
                  canCancelRequest && cancellingRequestId === outgoingRequestId;
                const productCount = Number(company.totalProducts || 0);

                return (
                  <article key={company.id} className="bc-company-card">
                    <div
                      className={`bc-company-banner${company.coverUrl ? ' has-cover' : ''}`}
                      style={
                        company.coverUrl
                          ? { backgroundImage: `url(${company.coverUrl})` }
                          : undefined
                      }
                      role="img"
                      aria-label={`${company.name || 'Company'} banner`}
                    />
                    <div className="bc-company-card-body">
                      <div className="bc-company-identity">
                        {company.logoUrl ? (
                          <img
                            className="bc-company-avatar"
                            src={company.logoUrl}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <div className="bc-company-avatar bc-company-avatar--fallback">
                            {(company.name || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="bc-company-identity-text">
                          <div className="bc-company-name-row">
                            <h2 className="bc-company-card-name" title={company.name}>
                              {company.name}
                            </h2>
                            {isSelf ? <span className="bc-pill">You</span> : null}
                            {outgoingStatus === 'approved' ? (
                              <span className="bc-pill bc-pill--connected">Connected</span>
                            ) : null}
                          </div>
                          {company.location ? (
                            <p className="bc-company-card-meta">
                              <FaLocationDot aria-hidden="true" />
                              <span>{company.location}</span>
                            </p>
                          ) : null}
                          {company.phone &&
                          String(company.phone).trim().toUpperCase() !== 'N/A' ? (
                            <p className="bc-company-card-meta">
                              <FaPhone aria-hidden="true" />
                              <span>{company.phone}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {company.description ? (
                        <p className="bc-company-card-desc">{company.description}</p>
                      ) : null}

                      <div className="bc-company-stats">
                        <span className="bc-company-stat">
                          <strong>{productCount.toLocaleString()}</strong>
                          {productCount === 1 ? ' product' : ' products'}
                        </span>
                      </div>

                      <div className="bc-company-actions">
                        {canCancelRequest ? (
                          <button
                            type="button"
                            className="bc-btn bc-btn-danger-ghost"
                            disabled={cancelling || requesting}
                            title="Cancel pending store request"
                            onClick={() => handleCancelRequest(company)}
                          >
                            <FaXmark aria-hidden="true" />
                            {cancelling ? 'Cancelling…' : 'Cancel request'}
                          </button>
                        ) : canManageSettings ? (
                          <button
                            type="button"
                            className="bc-btn bc-btn-ghost"
                            title="Connected store settings"
                            onClick={() =>
                              setSettingsTarget({
                                company,
                                connection: {
                                  ...(outgoing?.connection || {}),
                                  _id: outgoingRequestId,
                                  ...normalizeConnectionSyncSettings(
                                    outgoing?.settings || outgoing?.connection || {}
                                  ),
                                },
                              })
                            }
                          >
                            <FaGear aria-hidden="true" />
                            Settings
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="bc-btn bc-btn-ghost"
                            disabled={isSelf || !requestEnabled || requesting || alreadyRequested}
                            title={
                              isSelf
                                ? 'Cannot request your own store'
                                : !requestEnabled
                                  ? 'This store is not accepting requests'
                                  : outgoingStatus === 'pending'
                                    ? 'Request already sent'
                                    : 'Send store request'
                            }
                            onClick={() => openRequestModal(company)}
                          >
                            <FaPaperPlane aria-hidden="true" />
                            {outgoingStatus === 'pending' ? 'Requested' : 'Send request'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="bc-btn bc-btn-primary"
                          onClick={() => openStore(company)}
                          disabled={openingStoreId === String(company.id)}
                        >
                          <FaStore aria-hidden="true" />
                          {openingStoreId === String(company.id) ? 'Opening…' : 'View store'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div ref={sentinelRef} className="bc-scroll-sentinel" aria-hidden="true" />

          {loadingMore ? (
            <div className="bc-scroll-loading" role="status">
              <div className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Loading more…</span>
            </div>
          ) : null}

          {!initialLoading && !loadingMore && rows.length > 0 && !companiesHasMore ? (
            <p className="bc-scroll-end mb-0">End of list</p>
          ) : null}

          {companiesStatus === 'failed' && rows.length > 0 ? (
            <div className="bc-scroll-loading">
              <p className="text-danger text-sm mb-2">{companiesError}</p>
              <button type="button" className="bc-btn bc-btn-ghost bc-btn-sm" onClick={loadNextPage}>
                Try again
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <AppModal
        open={Boolean(requestTarget)}
        onClose={() => {
          if (requesting) return;
          setRequestTarget(null);
          setRequestMessage('');
        }}
        title="Send store request"
        subtitle={requestTarget ? `To ${requestTarget.name}` : undefined}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="bc-btn bc-btn-ghost"
              disabled={requesting}
              onClick={() => {
                setRequestTarget(null);
                setRequestMessage('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bc-btn bc-btn-primary"
              disabled={requesting}
              onClick={submitRequest}
            >
              {requesting ? 'Sending…' : 'Send Request'}
            </button>
          </>
        }
      >
        <label className="company-label d-block mb-2" htmlFor="bc-store-request-message">
          Message <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id="bc-store-request-message"
          className="form-control"
          rows={4}
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          placeholder="Introduce your company or describe what you need…"
          disabled={requesting}
        />
      </AppModal>

      <ConnectedStoreSettingsModal
        open={Boolean(settingsTarget)}
        connection={settingsTarget?.connection}
        partnerName={settingsTarget?.company?.name || 'store'}
        onClose={() => setSettingsTarget(null)}
        onSaved={(nextSettings) => {
          const companyId = String(settingsTarget?.company?.id || '').trim();
          const requestId = String(settingsTarget?.connection?._id || '').trim();
          if (!companyId || !requestId) return;
          const sync = normalizeConnectionSyncSettings(nextSettings || {});
          setOutgoingByCompanyId((prev) => {
            const existing = prev[companyId];
            if (!existing) return prev;
            return {
              ...prev,
              [companyId]: {
                ...existing,
                settings: sync,
                connection: {
                  ...(existing.connection || {}),
                  ...sync,
                },
              },
            };
          });
        }}
      />

      <DevApiSourcesFooter sources={apiSources} className="mt-3" />
    </div>
  );
}
