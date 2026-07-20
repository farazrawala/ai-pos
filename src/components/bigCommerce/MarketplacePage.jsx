import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaSliders } from 'react-icons/fa6';
import {
  loadMarketplaceBootstrap,
  fetchMarketplaceProducts,
  openMarketplaceProduct,
  setMarketplaceCompanyId,
  setMarketplaceFilters,
  resetMarketplaceFilters,
  setMarketplaceLimit,
  setMarketplaceViewMode,
  closeMarketplaceDetail,
  selectBigCommerce,
} from '../../features/bigCommerce/bigCommerceSlice.js';
import { excludeChildProducts } from '../../features/bigCommerce/marketplaceUtils.js';
import CompanyProfileHeader from './CompanyProfileHeader.jsx';
import MarketplaceFilters from './MarketplaceFilters.jsx';
import ProductToolbar from './ProductToolbar.jsx';
import ProductCard, { ProductCardSkeleton } from './ProductCard.jsx';
import ProductDetailModal from './ProductDetailModal.jsx';

/**
 * Reusable Facebook-style product marketplace.
 * Pass `companyId` to load that company's profile + catalog.
 * Product pagination loads more on page scroll.
 */
export default function MarketplacePage({ companyId }) {
  const dispatch = useDispatch();
  const state = useSelector(selectBigCommerce);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(state.filters.search || '');
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const initialLoading =
    state.productsStatus === 'loading' && state.products.length === 0;
  const loadingMore = state.productsStatus === 'loadingMore';
  const isBusy =
    state.productsStatus === 'loading' || state.productsStatus === 'loadingMore';

  useEffect(() => {
    loadingRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    const id = String(companyId || '').trim();
    setSearchDraft('');
    dispatch(setMarketplaceCompanyId(id));
    dispatch(loadMarketplaceBootstrap({ companyId: id }));
  }, [companyId, dispatch]);

  // Debounced search → filters
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== state.filters.search) {
        dispatch(setMarketplaceFilters({ search: searchDraft }));
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft, state.filters.search, dispatch]);

  // Fetch page 1 when filters / company / limit / bootstrap change
  useEffect(() => {
    if (state.bootstrapStatus === 'idle' || state.bootstrapStatus === 'loading') return;
    dispatch(
      fetchMarketplaceProducts({
        companyId: String(companyId || '').trim(),
        page: 1,
        limit: state.pagination.limit,
        append: false,
      })
    );
  }, [
    companyId,
    state.filters,
    state.pagination.limit,
    state.bootstrapStatus,
    dispatch,
  ]);

  const loadNextPage = useCallback(() => {
    if (loadingRef.current) return;
    // No products → do not keep requesting; page-1 failures use the Retry button.
    if (state.products.length === 0) return;

    const isFailureRetry = state.productsStatus === 'failed';
    if (!isFailureRetry && !state.productsHasMore) return;
    if (!isFailureRetry && state.productsStatus !== 'succeeded') return;

    dispatch(
      fetchMarketplaceProducts({
        companyId: String(companyId || '').trim(),
        skip: state.products.length,
        limit: state.pagination.limit,
        append: true,
      })
    );
  }, [
    dispatch,
    companyId,
    state.productsHasMore,
    state.productsStatus,
    state.products.length,
    state.pagination.limit,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    // Scroll-load only while we have items and more pages — never auto-retry failures.
    if (
      state.products.length === 0 ||
      !state.productsHasMore ||
      state.productsStatus !== 'succeeded'
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadNextPage();
      },
      { root: null, rootMargin: '480px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage, state.products.length, state.productsHasMore, state.productsStatus]);

  const onFilterChange = useCallback(
    (patch) => {
      if (Object.prototype.hasOwnProperty.call(patch, 'search')) {
        setSearchDraft(patch.search);
      }
      dispatch(setMarketplaceFilters(patch));
      const onlySearch = Object.keys(patch).length === 1 && 'search' in patch;
      if (!onlySearch) setFiltersOpen(false);
    },
    [dispatch]
  );

  const onReset = useCallback(() => {
    setSearchDraft('');
    dispatch(resetMarketplaceFilters());
  }, [dispatch]);

  // Children stay in Redux for variation lookup / skip pagination; hide them as cards.
  const visibleProducts = useMemo(
    () => excludeChildProducts(state.products),
    [state.products]
  );

  const priceBounds = useMemo(() => {
    let max = 1000;
    for (const p of visibleProducts) {
      const price = Number(p?.price ?? p?.product_price ?? 0);
      if (price > max) max = price;
    }
    return { min: 0, max: Math.ceil(max / 100) * 100 || 100000 };
  }, [visibleProducts]);

  const showing = visibleProducts.length;

  return (
    <div className="bc-marketplace">
      <CompanyProfileHeader
        company={state.company}
        loading={state.bootstrapStatus === 'loading'}
      />

      <div className="bc-layout">
        <button
          type="button"
          className="bc-filter-open bc-btn bc-btn-ghost"
          onClick={() => setFiltersOpen(true)}
        >
          <FaSliders aria-hidden="true" /> Filters
        </button>

        <div className={`bc-filters-drawer ${filtersOpen ? 'is-open' : ''}`}>
          <div
            className="bc-filters-backdrop"
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <MarketplaceFilters
            filters={state.filters}
            categories={state.categories}
            brands={state.brands}
            onChange={onFilterChange}
            onReset={onReset}
            priceBounds={priceBounds}
          />
        </div>

        <div className="bc-filters-desktop">
          <MarketplaceFilters
            filters={state.filters}
            categories={state.categories}
            brands={state.brands}
            onChange={onFilterChange}
            onReset={onReset}
            priceBounds={priceBounds}
          />
        </div>

        <section className="bc-listing">
          <ProductToolbar
            search={searchDraft}
            onSearchChange={setSearchDraft}
            showing={showing}
            total={state.pagination.total}
            viewMode={state.viewMode}
            onViewModeChange={(mode) => dispatch(setMarketplaceViewMode(mode))}
            pageSize={state.pagination.limit}
            onPageSizeChange={(limit) => dispatch(setMarketplaceLimit(limit))}
          />

          {state.error && state.productsStatus === 'failed' && state.products.length === 0 ? (
            <div className="bc-error" role="alert">
              {state.error}
              <button
                type="button"
                className="bc-btn bc-btn-ghost bc-btn-sm ms-2"
                onClick={() =>
                  dispatch(
                    fetchMarketplaceProducts({
                      companyId: String(companyId || '').trim(),
                      page: 1,
                      append: false,
                    })
                  )
                }
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className={`bc-products bc-products--${state.viewMode}`}>
            {initialLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={`sk-${i}`} viewMode={state.viewMode} />
                ))
              : null}

            {!initialLoading &&
            visibleProducts.length === 0 &&
            state.productsStatus === 'succeeded' ? (
              <div className="bc-empty">
                <h3>No products found</h3>
                <p>Try adjusting filters or search terms.</p>
                <button type="button" className="bc-btn bc-btn-primary" onClick={onReset}>
                  Reset filters
                </button>
              </div>
            ) : null}

            {!initialLoading
              ? visibleProducts.map((product) => (
                  <ProductCard
                    key={product._id || product.id}
                    product={product}
                    viewMode={state.viewMode}
                    onViewDetails={(id) =>
                      dispatch(openMarketplaceProduct({ productId: id, product }))
                    }
                  />
                ))
              : null}
          </div>

          <div ref={sentinelRef} className="bc-scroll-sentinel" aria-hidden="true" />

          {loadingMore ? (
            <div className="bc-scroll-loading text-center py-3">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading more…</span>
              </div>
              <span className="text-muted text-sm ms-2">Loading more products…</span>
            </div>
          ) : null}

          {!initialLoading &&
          !loadingMore &&
          state.products.length > 0 &&
          !state.productsHasMore ? (
            <p className="bc-scroll-end text-center text-muted text-sm mb-0 py-3">
              You&apos;ve reached the end of the list
            </p>
          ) : null}

          {state.productsStatus === 'failed' && state.products.length > 0 ? (
            <div className="text-center py-3">
              <p className="text-danger text-sm mb-2">{state.error}</p>
              <button type="button" className="bc-btn bc-btn-ghost bc-btn-sm" onClick={loadNextPage}>
                Try again
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <ProductDetailModal
        open={state.detailOpen}
        onClose={() => dispatch(closeMarketplaceDetail())}
        product={state.selectedProduct}
        variations={state.selectedVariations}
        related={state.relatedProducts}
        loading={state.detailStatus === 'loading'}
        onOpenRelated={(id) => dispatch(openMarketplaceProduct(id))}
      />
    </div>
  );
}
