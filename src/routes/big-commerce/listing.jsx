import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaMagnifyingGlass, FaPaperPlane, FaStore } from 'react-icons/fa6';
import {
  fetchMarketplaceCompanies,
  sendCompanyStoreRequest,
  setCompaniesSearch,
  clearStoreRequestStatus,
  selectBigCommerce,
} from '../../features/bigCommerce/bigCommerceSlice.js';
import { normalizeCompanyProfile } from '../../features/bigCommerce/marketplaceUtils.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import AppModal from '../../components/AppModal.jsx';
import { showToast } from '../../utils/toast.js';
import './big-commerce.css';

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
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
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

  useEffect(() => {
    if (storeRequestStatus === 'succeeded') {
      showToast({ message: 'Store request sent.', variant: 'success' });
      setRequestTarget(null);
      setRequestMessage('');
      dispatch(clearStoreRequestStatus());
    } else if (storeRequestStatus === 'failed' && storeRequestError) {
      showToast({ message: storeRequestError, variant: 'error' });
      dispatch(clearStoreRequestStatus());
    }
  }, [storeRequestStatus, storeRequestError, dispatch]);

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

  const openRequestModal = useCallback((company) => {
    setRequestTarget(company);
    setRequestMessage('');
  }, []);

  const submitRequest = () => {
    if (!requestTarget?.id) return;
    dispatch(
      sendCompanyStoreRequest({
        companyId: requestTarget.id,
        message: requestMessage,
      })
    );
  };

  const requesting =
    storeRequestStatus === 'loading' &&
    storeRequestTargetId === String(requestTarget?.id || '');

  return (
    <div className="container-fluid py-4 px-3">
      <div className="bc-listing-page">
        <div className="bc-listing-header">
          <div>
            <p className="bc-listing-eyebrow mb-0">
              <FaStore aria-hidden="true" />
              Big Commerce
            </p>
            <h4 className="bc-listing-title">Company directory</h4>
            <p className="bc-listing-subtitle mb-0">
              Browse companies, send a store request, or open their marketplace.
            </p>
          </div>
        </div>

        <div className="card border-0 bc-listing-card">
          <div className="card-header bg-transparent border-0 pt-3 px-3 pb-2">
            <div className="bc-listing-toolbar">
              <div className="bc-search-wrap bc-listing-search">
                <FaMagnifyingGlass className="bc-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="bc-search-input"
                  placeholder="Search companies…"
                  value={localSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  aria-label="Search companies"
                />
              </div>
              <p className="bc-result-summary mb-0">
                Showing {rows.length.toLocaleString()}
                {companiesPagination.total
                  ? ` of ${companiesPagination.total.toLocaleString()}`
                  : ''}{' '}
                companies
              </p>
            </div>
          </div>

          <div className="px-3 pb-3">
            {initialLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading…</span>
                </div>
                <p className="text-sm text-muted mt-3 mb-0">Loading companies…</p>
              </div>
            ) : null}

            {!initialLoading && companiesStatus === 'failed' && rows.length === 0 ? (
              <div className="alert alert-danger mb-0" role="alert">
                Error loading companies: {companiesError}
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger mb-0"
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
              </div>
            ) : null}

            {!initialLoading && rows.length === 0 && companiesStatus === 'succeeded' ? (
              <div className="bc-empty my-4">
                <h3>No companies found</h3>
                <p>Try a different search term.</p>
              </div>
            ) : null}

            {rows.length > 0 ? (
              <div className="bc-company-grid">
                {rows.map((company) => {
                  const isSelf = sessionCompanyId && company.id === String(sessionCompanyId);
                  const requestEnabled = company.showStoreForRequest === true;

                  return (
                    <article key={company.id} className="bc-company-card">
                      <div
                        className="bc-company-banner"
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
                            <h5 className="bc-company-card-name" title={company.name}>
                              {company.name}
                            </h5>
                            {company.location ? (
                              <p className="bc-company-card-meta">{company.location}</p>
                            ) : null}
                            {company.phone ? (
                              <p className="bc-company-card-meta">{company.phone}</p>
                            ) : null}
                          </div>
                        </div>

                        {company.description ? (
                          <p className="bc-company-card-desc">{company.description}</p>
                        ) : (
                          <p className="bc-company-card-desc bc-muted">No description</p>
                        )}

                        <div className="bc-company-stats">
                          <span>
                            {Number(company.totalProducts || 0).toLocaleString()} products
                          </span>
                          {isSelf ? <span className="bc-pill">Your company</span> : null}
                        </div>

                        <div className="bc-company-actions">
                          <button
                            type="button"
                            className="bc-btn bc-btn-ghost"
                            disabled={isSelf || !requestEnabled || requesting}
                            title={
                              isSelf
                                ? 'Cannot request your own store'
                                : !requestEnabled
                                  ? 'This store is not accepting requests'
                                  : 'Send store request'
                            }
                            onClick={() => openRequestModal(company)}
                          >
                            <FaPaperPlane aria-hidden="true" />
                            Send request
                          </button>
                          <button
                            type="button"
                            className="bc-btn bc-btn-primary"
                            onClick={() => navigate(`/big-commerce/store/${company.id}`)}
                          >
                            <FaStore aria-hidden="true" />
                            View store
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
              <div className="bc-scroll-loading text-center py-3">
                <div
                  className="spinner-border spinner-border-sm text-primary"
                  role="status"
                >
                  <span className="visually-hidden">Loading more…</span>
                </div>
                <span className="text-muted text-sm ms-2">Loading more companies…</span>
              </div>
            ) : null}

            {!initialLoading && !loadingMore && rows.length > 0 && !companiesHasMore ? (
              <p className="bc-scroll-end text-center text-muted text-sm mb-0 py-3">
                You&apos;ve reached the end of the list
              </p>
            ) : null}

            {companiesStatus === 'failed' && rows.length > 0 ? (
              <div className="text-center py-3">
                <p className="text-danger text-sm mb-2">{companiesError}</p>
                <button
                  type="button"
                  className="bc-btn bc-btn-ghost bc-btn-sm"
                  onClick={loadNextPage}
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </div>
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
    </div>
  );
}
