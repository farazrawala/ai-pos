import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaCartShopping,
  FaCheck,
  FaChevronDown,
  FaChevronRight,
  FaEnvelope,
  FaEye,
  FaMagnifyingGlass,
  FaMinus,
  FaPhone,
  FaPlus,
  FaSliders,
  FaStore,
  FaWhatsapp,
  FaXmark,
} from 'react-icons/fa6';
import { buildApiUrl, resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import {
  buildShopWhatsAppUrl,
  shopVariantLabel,
  stripShopHtml,
  toShopTitleCase,
  toShopWhatsAppDigits,
} from './shopUtils.js';
import './public-shop.css';

const SORT_OPTIONS = [
  { value: 'default', label: 'Default sorting' },
  { value: 'newest', label: 'Sort by latest' },
  { value: 'price_asc', label: 'Sort by price: low to high' },
  { value: 'price_desc', label: 'Sort by price: high to low' },
  { value: 'name_asc', label: 'Sort by name: A to Z' },
  { value: 'name_desc', label: 'Sort by name: Z to A' },
];

const STOCK_OPTIONS = [
  { value: '', label: 'All products' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

const PRICE_PRESETS = [
  { label: 'Under Rs. 500', min: '', max: '500' },
  { label: 'Rs. 500 – 1,000', min: '500', max: '1000' },
  { label: 'Rs. 1,000 – 5,000', min: '1000', max: '5000' },
  { label: 'Rs. 5,000+', min: '5000', max: '' },
];

const PAGE_SIZE = 24;

const formatPrice = (value) =>
  `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;

async function fetchPublicShop(path) {
  const response = await fetch(buildApiUrl(path), {
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || body?.error || 'Could not load this store.');
  }
  return body;
}

function ProductSkeleton() {
  return (
    <div className="shop-card is-skeleton">
      <div className="shop-card-media" />
      <div className="shop-card-body">
        <span className="skeleton-line w-40" />
        <span className="skeleton-line w-90" />
        <span className="skeleton-line w-60" />
      </div>
    </div>
  );
}

export default function PublicShop() {
  const { companySlug } = useParams();
  const navigate = useNavigate();
  const slug = encodeURIComponent(companySlug || '');

  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);

  const [bootLoading, setBootLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cart, setCart] = useState({});
  const [quickView, setQuickView] = useState(null);
  const [quickVariantId, setQuickVariantId] = useState('');
  const [quickQty, setQuickQty] = useState(1);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeSearchBox, setActiveSearchBox] = useState('');

  const requestSeq = useRef(0);
  const suggestSeq = useRef(0);
  const categoryMenuRef = useRef(null);
  const searchBoxRef = useRef(null);
  const loadMoreRef = useRef(null);
  const cartStorageKey = store?._id ? `shop_cart_${store._id}` : '';

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Type-ahead suggestions, independent of the main grid request.
  useEffect(() => {
    const term = searchInput.trim();
    if (!activeSearchBox) return undefined;
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return undefined;
    }

    setSuggestLoading(true);
    const timer = setTimeout(() => {
      const seq = suggestSeq.current + 1;
      suggestSeq.current = seq;
      const params = new URLSearchParams({ page: '1', limit: '6', search: term });
      if (categoryId) params.set('category', categoryId);

      fetchPublicShop(`shop/${slug}/products?${params.toString()}`)
        .then((body) => {
          if (suggestSeq.current !== seq) return;
          setSuggestions(Array.isArray(body?.data) ? body.data : []);
        })
        .catch(() => {
          if (suggestSeq.current !== seq) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (suggestSeq.current === seq) setSuggestLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput, slug, categoryId, activeSearchBox]);

  useEffect(() => {
    if (!activeSearchBox) return undefined;
    const closeOnOutside = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) setActiveSearchBox('');
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActiveSearchBox('');
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeSearchBox]);

  useEffect(() => {
    if (!categoryMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (!categoryMenuRef.current?.contains(event.target)) {
        setCategoryMenuOpen(false);
        setCategorySearch('');
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setCategoryMenuOpen(false);
        setCategorySearch('');
      }
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [categoryMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    setBootLoading(true);
    setError('');

    Promise.all([
      fetchPublicShop(`shop/${slug}`),
      fetchPublicShop(`shop/${slug}/categories`).catch(() => ({ data: [] })),
      fetchPublicShop(`shop/${slug}/brands`).catch(() => ({ data: [] })),
    ])
      .then(([storeBody, categoryBody, brandBody]) => {
        if (cancelled) return;
        setStore(storeBody?.data || null);
        setCategories(
          Array.isArray(categoryBody?.data) ?
            categoryBody.data.map((category) => ({
              ...category,
              name: toShopTitleCase(category.name),
            }))
          : []
        );
        setBrands(
          Array.isArray(brandBody?.data) ?
            brandBody.data.map((brand) => ({
              ...brand,
              name: toShopTitleCase(brand.name),
            }))
          : []
        );
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Cart is scoped per store so two storefronts never share items.
  useEffect(() => {
    if (!cartStorageKey) return;
    try {
      const saved = window.localStorage.getItem(cartStorageKey);
      setCart(saved ? JSON.parse(saved) : {});
    } catch {
      setCart({});
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (!cartStorageKey) return;
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {
      /* storage unavailable */
    }
  }, [cart, cartStorageKey]);

  useEffect(() => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    const isFirstPage = page === 1;
    if (isFirstPage) {
      setProductsLoading(true);
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort,
    });
    if (search) params.set('search', search);
    if (categoryId) params.set('category', categoryId);
    if (brandId) params.set('brand', brandId);
    if (stockStatus) params.set('stock_status', stockStatus);
    if (priceMin !== '' && Number.isFinite(Number(priceMin))) {
      params.set('price_min', String(priceMin));
    }
    if (priceMax !== '' && Number.isFinite(Number(priceMax))) {
      params.set('price_max', String(priceMax));
    }

    fetchPublicShop(`shop/${slug}/products?${params.toString()}`)
      .then((body) => {
        if (requestSeq.current !== seq) return;
        const rows = Array.isArray(body?.data) ? body.data : [];
        setTotal(Number(body?.total) || 0);
        if (isFirstPage) {
          setProducts(rows);
          return;
        }
        setProducts((prev) => {
          const seen = new Set(prev.map((item) => String(item._id)));
          const next = rows.filter((item) => !seen.has(String(item._id)));
          return next.length ? [...prev, ...next] : prev;
        });
      })
      .catch(() => {
        if (requestSeq.current !== seq) return;
        if (isFirstPage) {
          setProducts([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (requestSeq.current !== seq) return;
        setProductsLoading(false);
        setLoadingMore(false);
      });
  }, [slug, page, sort, search, categoryId, brandId, stockStatus, priceMin, priceMax]);

  const addToCart = useCallback((product, qty = 1, mediaFallback = null) => {
    const amount = Math.max(1, Number(qty) || 1);
    const image =
      product.product_image_thumbnail_url ||
      product.product_image ||
      mediaFallback?.product_image_thumbnail_url ||
      mediaFallback?.product_image ||
      '';
    setCart((prev) => {
      const existing = prev[product._id];
      return {
        ...prev,
        [product._id]: {
          product_id: product._id,
          name: product.product_name,
          sku: product.sku || product.product_code || '',
          image,
          price: Number(product.unit_price) || Number(mediaFallback?.unit_price) || 0,
          qty: (existing?.qty || 0) + amount,
        },
      };
    });
  }, []);

  const openQuickView = useCallback((product) => {
    setQuickView(product);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const initialVariant =
      variants.find((variant) => variant.is_available) || variants[0] || null;
    setQuickVariantId(initialVariant ? String(initialVariant._id) : '');
    setQuickQty(1);
  }, []);

  const closeQuickView = useCallback(() => {
    setQuickView(null);
    setQuickVariantId('');
    setQuickQty(1);
  }, []);

  useEffect(() => {
    if (!quickView) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeQuickView();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [quickView, closeQuickView]);

  const { cartCount, cartSubtotal } = useMemo(() => {
    const lines = Object.values(cart);
    return {
      cartCount: lines.reduce((sum, line) => sum + (Number(line?.qty) || 0), 0),
      cartSubtotal: lines.reduce(
        (sum, line) => sum + (Number(line?.qty) || 0) * (Number(line?.price) || 0),
        0
      ),
    };
  }, [cart]);

  const activeFilterCount =
    (categoryId ? 1 : 0) +
    (brandId ? 1 : 0) +
    (stockStatus ? 1 : 0) +
    (priceMin !== '' || priceMax !== '' ? 1 : 0);

  const hasMore = products.length < total;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || productsLoading || loadingMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setPage((prev) => prev + 1);
      },
      { root: null, rootMargin: '280px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, productsLoading, loadingMore, products.length]);

  const clearFilters = () => {
    setCategoryId('');
    setBrandId('');
    setStockStatus('');
    setPriceMin('');
    setPriceMax('');
    setPage(1);
  };

  if (bootLoading) {
    return (
      <div className="shop-boot">
        <div className="shop-boot-spinner" />
        <p>Loading store…</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="shop-boot">
        <FaStore className="shop-boot-icon" />
        <h1>Store unavailable</h1>
        <p>{error || 'This store could not be found.'}</p>
      </div>
    );
  }

  const logo = resolveCategoryMediaUrl(store.company_logo);
  const banner = resolveCategoryMediaUrl(store.company_banner);
  const initials = String(store.company_name || '?').trim().charAt(0).toUpperCase();
  const whatsappUrl =
    buildShopWhatsAppUrl(store.whatsapp_number) ||
    buildShopWhatsAppUrl(store.company_phone);
  const whatsappLabel =
    toShopWhatsAppDigits(store.whatsapp_number).length >= 10 ?
      String(store.whatsapp_number).trim()
    : store.company_phone || 'WhatsApp';
  const activeCategoryName =
    categories.find((category) => String(category._id) === categoryId)?.name || '';
  const searchableCategories = categories.filter((category) =>
    String(category.name || '')
      .toLowerCase()
      .includes(categorySearch.trim().toLowerCase())
  );

  const searchTerm = searchInput.trim();

  const renderSuggestions = (box) => {
    if (activeSearchBox !== box || searchTerm.length < 2) return null;

    return (
      <div className="shop-suggest" role="listbox" aria-label="Product suggestions">
        {suggestLoading && !suggestions.length ? (
          <div className="shop-suggest-state">
            <span className="shop-suggest-spinner" aria-hidden="true" />
            Searching products…
          </div>
        ) : suggestions.length ? (
          <>
            {suggestLoading ? (
              <div className="shop-suggest-progress" aria-hidden="true" />
            ) : null}
            {suggestions.map((product) => {
              const thumb = resolveCategoryMediaUrl(
                product.product_image_thumbnail_url || product.product_image
              );
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="shop-suggest-item"
                  key={product._id}
                  onClick={() => {
                    setActiveSearchBox('');
                    openQuickView(product);
                  }}
                >
                  <span className="shop-suggest-thumb">
                    {thumb ? <img src={thumb} alt="" loading="lazy" /> : <FaStore />}
                  </span>
                  <span className="shop-suggest-text">
                    <strong>{product.product_name}</strong>
                    <small>{product.brand_id?.name || 'Generic'}</small>
                  </span>
                  <span className="shop-suggest-price">
                    {formatPrice(product.unit_price)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="shop-suggest-all"
              onClick={() => {
                setSearch(searchTerm);
                setPage(1);
                setActiveSearchBox('');
              }}
            >
              View all results for “{searchTerm}”
            </button>
          </>
        ) : (
          <div className="shop-suggest-state is-empty">No products match “{searchTerm}”</div>
        )}
      </div>
    );
  };

  const filterPanel = (
    <>
      <div className="shop-filter-group">
        <h3 className="shop-filter-title">Categories</h3>
        <ul className="shop-filter-list">
          <li>
            <button
              type="button"
              className={!categoryId ? 'is-active' : ''}
              onClick={() => {
                setCategoryId('');
                setPage(1);
              }}
            >
              All categories
            </button>
          </li>
          {categories.map((category) => (
            <li key={category._id}>
              <button
                type="button"
                className={categoryId === String(category._id) ? 'is-active' : ''}
                onClick={() => {
                  setCategoryId(String(category._id));
                  setPage(1);
                }}
              >
                {category.name}
              </button>
            </li>
          ))}
          {!categories.length ? <li className="shop-filter-empty">No categories</li> : null}
        </ul>
      </div>

      <div className="shop-filter-group">
        <h3 className="shop-filter-title">Brands</h3>
        <ul className="shop-filter-list">
          <li>
            <button
              type="button"
              className={!brandId ? 'is-active' : ''}
              onClick={() => {
                setBrandId('');
                setPage(1);
              }}
            >
              All brands
            </button>
          </li>
          {brands.map((brand) => (
            <li key={brand._id}>
              <button
                type="button"
                className={brandId === String(brand._id) ? 'is-active' : ''}
                onClick={() => {
                  setBrandId(String(brand._id));
                  setPage(1);
                }}
              >
                {brand.name}
              </button>
            </li>
          ))}
          {!brands.length ? <li className="shop-filter-empty">No brands</li> : null}
        </ul>
      </div>

      <div className="shop-filter-group">
        <h3 className="shop-filter-title">Availability</h3>
        <ul className="shop-filter-list">
          {STOCK_OPTIONS.map((option) => (
            <li key={option.value || 'all'}>
              <button
                type="button"
                className={stockStatus === option.value ? 'is-active' : ''}
                onClick={() => {
                  setStockStatus(option.value);
                  setPage(1);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="shop-filter-group shop-price-filter">
        <div className="shop-price-heading">
          <h3 className="shop-filter-title">Price range</h3>
          {priceMin !== '' || priceMax !== '' ? (
            <button
              type="button"
              onClick={() => {
                setPriceMin('');
                setPriceMax('');
                setPage(1);
              }}
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className="shop-price-range">
          <label>
            <span>Minimum</span>
            <div>
              <small>Rs.</small>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={priceMin}
                onChange={(event) => {
                  setPriceMin(event.target.value);
                  setPage(1);
                }}
                aria-label="Minimum price"
              />
            </div>
          </label>
          <span>–</span>
          <label>
            <span>Maximum</span>
            <div>
              <small>Rs.</small>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Any"
                value={priceMax}
                onChange={(event) => {
                  setPriceMax(event.target.value);
                  setPage(1);
                }}
                aria-label="Maximum price"
              />
            </div>
          </label>
        </div>

        <div className="shop-price-presets" aria-label="Popular price ranges">
          {PRICE_PRESETS.map((preset) => {
            const selected = priceMin === preset.min && priceMax === preset.max;
            return (
              <button
                type="button"
                className={selected ? 'is-active' : ''}
                key={preset.label}
                onClick={() => {
                  setPriceMin(preset.min);
                  setPriceMax(preset.max);
                  setPage(1);
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {priceMin !== '' || priceMax !== '' ? (
          <p className="shop-price-summary">
            Showing products
            {priceMin !== '' ? ` from ${formatPrice(priceMin)}` : ''}
            {priceMax !== '' ? ` up to ${formatPrice(priceMax)}` : ''}
          </p>
        ) : null}
      </div>

      {activeFilterCount ? (
        <button type="button" className="shop-clear-all" onClick={clearFilters}>
          Clear all filters
        </button>
      ) : null}
    </>
  );

  return (
    <div className="shop">
      <div className="shop-topbar">
        <div className="shop-container shop-topbar-inner">
          <span className="shop-topbar-welcome">
            Welcome to {store.company_name}
          </span>
          <div className="shop-topbar-links">
            {store.company_phone ? (
              <a href={`tel:${store.company_phone}`}>
                <FaPhone /> {store.company_phone}
              </a>
            ) : null}
            {whatsappUrl ? (
              <a
                className="shop-topbar-whatsapp"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp /> {whatsappLabel}
              </a>
            ) : null}
            {store.company_email ? (
              <a href={`mailto:${store.company_email}`}>
                <FaEnvelope /> {store.company_email}
              </a>
            ) : null}
            {store.store_status ? (
              <span className={`shop-topbar-status is-${store.store_status}`}>
                {store.store_status === 'open' ? 'Open now' : 'Closed'}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <header className="shop-header">
        <div className="shop-container shop-header-inner">
          <div className="shop-brand">
            <div className="shop-brand-logo">
              {logo ? <img src={logo} alt={`${store.company_name} logo`} /> : initials}
            </div>
            <div className="shop-brand-text">
              <strong>{store.company_name}</strong>
              {store.tagline ? <span>{store.tagline}</span> : null}
            </div>
          </div>

          <form
            className="shop-searchbar"
            ref={activeSearchBox === 'header' ? searchBoxRef : null}
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
              setActiveSearchBox('');
            }}
          >
            <div className="shop-searchbar-field">
              <input
                type="search"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setActiveSearchBox('header');
                }}
                onFocus={() => setActiveSearchBox('header')}
                placeholder="Search for products"
                aria-label="Search for products"
              />
              {suggestLoading && activeSearchBox === 'header' ? (
                <span className="shop-searchbar-spinner" aria-hidden="true" />
              ) : null}
            </div>
            {renderSuggestions('header')}
            <div className="shop-category-picker" ref={categoryMenuRef}>
              <button
                type="button"
                className="shop-category-trigger"
                aria-haspopup="listbox"
                aria-expanded={categoryMenuOpen}
                onClick={() => {
                  setCategoryMenuOpen((open) => !open);
                  setCategorySearch('');
                }}
              >
                <span>{activeCategoryName || 'All Categories'}</span>
                <FaChevronDown aria-hidden="true" />
              </button>

              {categoryMenuOpen ? (
                <div className="shop-category-menu">
                  <div className="shop-category-search">
                    <FaMagnifyingGlass aria-hidden="true" />
                    <input
                      type="search"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Search categories..."
                      aria-label="Search categories"
                      autoFocus
                    />
                  </div>
                  <div className="shop-category-options" role="listbox">
                    <button
                      type="button"
                      role="option"
                      aria-selected={!categoryId}
                      className={!categoryId ? 'is-selected' : ''}
                      onClick={() => {
                        setCategoryId('');
                        setPage(1);
                        setCategoryMenuOpen(false);
                        setCategorySearch('');
                      }}
                    >
                      <span>All Categories</span>
                      {!categoryId ? <FaCheck aria-hidden="true" /> : null}
                    </button>
                    {searchableCategories.map((category) => {
                      const value = String(category._id);
                      const selected = categoryId === value;
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={selected ? 'is-selected' : ''}
                          key={category._id}
                          onClick={() => {
                            setCategoryId(value);
                            setPage(1);
                            setCategoryMenuOpen(false);
                            setCategorySearch('');
                          }}
                        >
                          <span>{category.name}</span>
                          {selected ? <FaCheck aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                    {searchableCategories.length === 0 ? (
                      <p className="shop-category-empty">No categories found</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <button type="submit" className="shop-search-submit" aria-label="Search">
              <FaMagnifyingGlass />
            </button>
          </form>

          <button
            type="button"
            className="shop-cart-btn"
            aria-label="Open cart"
            onClick={() => navigate(`/shop/${companySlug}/cart`)}
          >
            <span className="shop-cart-icon">
              <FaCartShopping />
              {cartCount ? <em>{cartCount}</em> : null}
            </span>
            <span className="shop-cart-total">{formatPrice(cartSubtotal)}</span>
          </button>
        </div>
      </header>

      <nav className="shop-nav">
        <div className="shop-container shop-nav-inner">
          <div className="shop-nav-links">
            <button
              type="button"
              className={!categoryId ? 'is-active' : ''}
              onClick={() => {
                setCategoryId('');
                setPage(1);
              }}
            >
              All Products
            </button>
            {categories.slice(0, 7).map((category) => (
              <button
                key={category._id}
                type="button"
                className={categoryId === String(category._id) ? 'is-active' : ''}
                onClick={() => {
                  setCategoryId(String(category._id));
                  setPage(1);
                }}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <section className="shop-hero">
        <div
          className="shop-hero-media"
          style={banner ? { backgroundImage: `url("${banner}")` } : undefined}
          aria-label={`${store.company_name} banner`}
        />
      </section>

      <div className="shop-container shop-breadcrumb">
        <span>Home</span>
        <FaChevronRight />
        <span>Shop</span>
        {activeCategoryName ? (
          <>
            <FaChevronRight />
            <strong>{activeCategoryName}</strong>
          </>
        ) : null}
      </div>

      <div className="shop-container shop-body">
        <aside className={`shop-filters ${filtersOpen ? 'is-open' : ''}`}>
          <div className="shop-filters-panel">
            <div className="shop-filters-titlebar">
              <h2>Filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <FaXmark />
              </button>
            </div>
            {filterPanel}
          </div>
        </aside>

        {filtersOpen ? (
          <button
            type="button"
            className="shop-filters-backdrop"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
        ) : null}

        <main className="shop-content">
          <div className="shop-results-bar">
            <div className="shop-results-info">
              <h2>{activeCategoryName || (search ? `Results for “${search}”` : 'All products')}</h2>
              <span>
                {productsLoading ?
                  <>
                    <span className="shop-results-inline-spinner" aria-hidden="true" />
                    Fetching products…
                  </>
                : `Showing ${products.length} of ${total} products`}
              </span>
            </div>

            <div
              className="shop-results-search"
              ref={activeSearchBox === 'results' ? searchBoxRef : null}
            >
              <FaMagnifyingGlass />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setActiveSearchBox('results');
                }}
                onFocus={() => setActiveSearchBox('results')}
                placeholder="Search products…"
                aria-label="Search products"
              />
              {suggestLoading && activeSearchBox === 'results' ? (
                <span className="shop-results-spinner" aria-hidden="true" />
              ) : searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setActiveSearchBox('');
                  }}
                  aria-label="Clear search"
                >
                  <FaXmark />
                </button>
              ) : null}
              {renderSuggestions('results')}
            </div>

            <div className="shop-results-actions">
              <button
                type="button"
                className="shop-filter-toggle"
                onClick={() => setFiltersOpen(true)}
              >
                <FaSliders /> Filters
                {activeFilterCount ? <em>{activeFilterCount}</em> : null}
              </button>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                aria-label="Sort products"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {productsLoading && !products.length ? (
            <div className="shop-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductSkeleton key={index} />
              ))}
            </div>
          ) : products.length ? (
            <>
              <div className={`shop-grid${productsLoading ? ' is-refreshing' : ''}`}>
                {products.map((product) => {
                  const image = resolveCategoryMediaUrl(
                    product.product_image_thumbnail_url || product.product_image
                  );
                  const variants = Array.isArray(product.variants) ? product.variants : [];
                  const hasVariants = variants.length > 0;
                  const inCart =
                    hasVariants ?
                      variants.reduce(
                        (sum, variant) => sum + (Number(cart[variant._id]?.qty) || 0),
                        0
                      )
                    : cart[product._id]?.qty || 0;
                  const categoryLabel = toShopTitleCase(
                    (Array.isArray(product.category_id) ?
                      product.category_id[0]?.name
                    : product.category_id?.name) || 'Products'
                  );

                  return (
                    <article className="shop-card" key={product._id}>
                      <div className="shop-card-media">
                        {image ? (
                          <img src={image} alt={product.product_name} loading="lazy" />
                        ) : (
                          <span className="shop-card-noimg">
                            <FaStore />
                          </span>
                        )}
                        {product.discount_percent ? (
                          <span className="shop-badge">-{product.discount_percent}%</span>
                        ) : null}
                        {!product.is_available ? (
                          <span className="shop-card-oos">Out of stock</span>
                        ) : null}
                        <div className="shop-card-actions">
                          <button
                            type="button"
                            className="shop-quick-view-btn"
                            onClick={() => openQuickView(product)}
                          >
                            <FaEye /> Quick view
                          </button>
                        </div>
                      </div>

                      <div className="shop-card-body">
                        <span className="shop-card-cat">{categoryLabel}</span>
                        <button
                          type="button"
                          className="shop-card-title"
                          onClick={() => openQuickView(product)}
                        >
                          {product.product_name}
                        </button>
                        <span className="shop-card-brand">
                          {product.brand_id?.name || 'Generic'}
                        </span>

                        <div className="shop-card-price">
                          <strong>{formatPrice(product.unit_price)}</strong>
                          {product.list_price ? <del>{formatPrice(product.list_price)}</del> : null}
                        </div>

                        <div className="shop-card-stock">
                          {product.is_available ? (
                            <span className="in">
                              <FaCheck /> In stock
                            </span>
                          ) : (
                            <span className="out">Unavailable</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`shop-add-btn ${inCart ? 'is-added' : ''}`}
                          disabled={!product.is_available}
                          onClick={() => {
                            if (hasVariants) {
                              openQuickView(product);
                              return;
                            }
                            addToCart(product);
                          }}
                        >
                          {product.is_available ?
                            <>
                              <FaCartShopping />
                              <span>
                                {hasVariants ?
                                  inCart ? `In cart (${inCart})`
                                  : 'Choose options'
                                : inCart ? `In cart (${inCart})`
                                : 'Add to cart'}
                              </span>
                            </>
                          : 'Out of stock'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="shop-infinite" aria-live="polite">
                {hasMore ? <div ref={loadMoreRef} className="shop-infinite-sentinel" /> : null}
                {loadingMore ? (
                  <div className="shop-infinite-status">
                    <span className="shop-results-inline-spinner" aria-hidden="true" />
                    Loading more products…
                  </div>
                ) : null}
                {!hasMore && products.length ? (
                  <div className="shop-infinite-status is-done">
                    You have reached the end · {total} products
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="shop-empty">
              <div className="shop-empty-icon">
                <FaMagnifyingGlass />
              </div>
              <h3>No products found</h3>
              <p>Try a different search term or clear your filters.</p>
              {activeFilterCount || search ? (
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    setSearchInput('');
                  }}
                >
                  Reset search & filters
                </button>
              ) : null}
            </div>
          )}
        </main>
      </div>

      <footer className="shop-footer">
        <div className="shop-container shop-footer-top">
          <div className="shop-footer-brand">
            <div className="shop-footer-logo">
              {logo ? <img src={logo} alt="" /> : initials}
            </div>
            <div>
              <strong>{store.company_name}</strong>
              {store.company_address ? <p>{store.company_address}</p> : null}
            </div>
          </div>

          <div className="shop-footer-contact">
            {store.company_phone ? (
              <a href={`tel:${store.company_phone}`}>
                <FaPhone /> {store.company_phone}
              </a>
            ) : null}
            {whatsappUrl ? (
              <a
                className="shop-footer-whatsapp"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp /> {whatsappLabel}
              </a>
            ) : null}
            {store.company_email ? (
              <a href={`mailto:${store.company_email}`}>
                <FaEnvelope /> {store.company_email}
              </a>
            ) : null}
          </div>
        </div>
        <div className="shop-container shop-footer-bottom">
          <span>
            © {new Date().getFullYear()} {store.company_name}. All rights reserved.
          </span>
          <span className="shop-footer-made">
            <svg
              className="shop-footer-flag"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 60 40"
              width="22"
              height="15"
              role="img"
              aria-label="Pakistan"
            >
              <title>Pakistan</title>
              <rect width="60" height="40" fill="#01411C" />
              <rect width="15" height="40" fill="#FFFFFF" />
              <circle cx="36" cy="20" r="9" fill="#FFFFFF" />
              <circle cx="39.2" cy="20" r="7.4" fill="#01411C" />
              <polygon
                fill="#FFFFFF"
                points="44.5,14.2 45.7,17.8 49.5,17.8 46.4,20.1 47.6,23.7 44.5,21.4 41.4,23.7 42.6,20.1 39.5,17.8 43.3,17.8"
              />
            </svg>
            Made in Pakistan
          </span>
          <span>Secure checkout · Cash on delivery available</span>
        </div>
      </footer>

      {cartCount ? (
        <button
          type="button"
          className="shop-mobile-cart"
          onClick={() => navigate(`/shop/${companySlug}/cart`)}
        >
          <FaCartShopping />
          {cartCount} item{cartCount > 1 ? 's' : ''}
          <em>{formatPrice(cartSubtotal)}</em>
        </button>
      ) : null}

      {quickView ? (
        (() => {
          const qvVariants = Array.isArray(quickView.variants) ? quickView.variants : [];
          const selectedVariant =
            qvVariants.find((variant) => String(variant._id) === quickVariantId) || null;
          const cartProduct =
            selectedVariant ?
              {
                ...selectedVariant,
                product_image:
                  selectedVariant.product_image || quickView.product_image || null,
                product_image_thumbnail_url:
                  selectedVariant.product_image_thumbnail_url ||
                  quickView.product_image_thumbnail_url ||
                  selectedVariant.product_image ||
                  quickView.product_image ||
                  null,
                unit_price:
                  Number(selectedVariant.unit_price) > 0 ?
                    selectedVariant.unit_price
                  : quickView.unit_price,
                list_price:
                  Number(selectedVariant.list_price) > 0 ?
                    selectedVariant.list_price
                  : quickView.list_price,
              }
            : quickView;
          const qvImage = resolveCategoryMediaUrl(
            cartProduct.product_image ||
              cartProduct.product_image_thumbnail_url ||
              quickView.product_image ||
              quickView.product_image_thumbnail_url
          );
          const qvCategory = toShopTitleCase(
            (Array.isArray(quickView.category_id) ?
              quickView.category_id[0]?.name
            : quickView.category_id?.name) || 'Products'
          );
          const qvInCart = cart[cartProduct._id]?.qty || 0;
          const qvDescription = stripShopHtml(quickView.product_description);

          return (
            <div className="shop-qv" role="dialog" aria-modal="true" aria-label="Quick view">
              <button
                type="button"
                className="shop-qv-backdrop"
                aria-label="Close quick view"
                onClick={closeQuickView}
              />
              <div className="shop-qv-panel">
                <button
                  type="button"
                  className="shop-qv-close"
                  aria-label="Close"
                  onClick={closeQuickView}
                >
                  <FaXmark />
                </button>

                <div className="shop-qv-media">
                  {qvImage ? (
                    <img src={qvImage} alt={quickView.product_name} />
                  ) : (
                    <span className="shop-card-noimg">
                      <FaStore />
                    </span>
                  )}
                </div>

                <div className="shop-qv-body">
                  <div className="shop-qv-head">
                    <span className="shop-card-cat">{qvCategory}</span>
                    <h2>{quickView.product_name}</h2>
                    <div className="shop-qv-meta">
                      <span>{quickView.brand_id?.name || 'Generic'}</span>
                      {cartProduct.sku || cartProduct.product_code ? (
                        <span className="shop-qv-sku">
                          SKU {cartProduct.sku || cartProduct.product_code}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shop-qv-pricing">
                    <div className="shop-card-price shop-qv-price">
                      <strong>{formatPrice(cartProduct.unit_price)}</strong>
                      {cartProduct.list_price ?
                        <del>{formatPrice(cartProduct.list_price)}</del>
                      : null}
                      {cartProduct.discount_percent ? (
                        <em className="shop-qv-discount">-{cartProduct.discount_percent}%</em>
                      ) : null}
                    </div>

                    <div className="shop-card-stock">
                      {cartProduct.is_available ? (
                        <span className="in">
                          <FaCheck /> In stock
                          {Number(cartProduct.available_qty) > 0 ?
                            ` · ${cartProduct.available_qty} available`
                          : ''}
                        </span>
                      ) : (
                        <span className="out">Unavailable</span>
                      )}
                    </div>
                  </div>

                  {qvVariants.length ? (
                    <div className="shop-qv-variants">
                      <div className="shop-qv-variants-head">
                        <strong>
                          {selectedVariant ?
                            <>
                              Variant:{' '}
                              <b>
                                {shopVariantLabel(
                                  quickView.product_name,
                                  selectedVariant.product_name
                                )}
                              </b>
                            </>
                          : 'Select a variant'}
                        </strong>
                        <span>{qvVariants.length} options</span>
                      </div>
                      <div className="shop-qv-variant-list" role="listbox">
                        {qvVariants.map((variant) => {
                          const selected = String(variant._id) === quickVariantId;
                          const label = shopVariantLabel(
                            quickView.product_name,
                            variant.product_name
                          );
                          return (
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              key={variant._id}
                              className={selected ? 'is-selected' : ''}
                              disabled={!variant.is_available}
                              title={
                                variant.is_available ? label : `${label} — out of stock`
                              }
                              onClick={() => {
                                setQuickVariantId(String(variant._id));
                                setQuickQty(1);
                              }}
                            >
                              {label}
                              {!variant.is_available ? <em>Sold out</em> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {qvDescription ? (
                    <p className="shop-qv-desc">{qvDescription}</p>
                  ) : (
                    <p className="shop-qv-desc is-muted">
                      No description available for this product.
                    </p>
                  )}

                  <div className="shop-qv-actions">
                    <div className="shop-qv-qty">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={quickQty <= 1}
                        onClick={() => setQuickQty((prev) => Math.max(1, prev - 1))}
                      >
                        <FaMinus />
                      </button>
                      <span>{quickQty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQuickQty((prev) => prev + 1)}
                      >
                        <FaPlus />
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`shop-add-btn shop-qv-add ${qvInCart ? 'is-added' : ''}`}
                      disabled={!cartProduct.is_available || (qvVariants.length > 0 && !selectedVariant)}
                      onClick={() => {
                        addToCart(cartProduct, quickQty, quickView);
                        closeQuickView();
                      }}
                    >
                      {cartProduct.is_available ?
                        <>
                          <FaCartShopping />
                          {qvInCart ?
                            `Add more · ${qvInCart} in cart`
                          : qvVariants.length ? 'Add variant to cart'
                          : 'Add to cart'}
                        </>
                      : 'Out of stock'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
