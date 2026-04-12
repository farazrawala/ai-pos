import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
  createCustomerUserRequest,
  pickCreatedUserFromResponse,
  POS_DEFAULT_CUSTOMER_PASSWORD,
  resolvePosCustomerEmail,
  digitsOnlyFromPhone,
} from '../../features/users/usersAPI.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import PosProducts from './PosProducts.jsx';

const ADD_CUSTOMER_INITIAL = { name: '', email: '', phone: '' };

const parsePosUnitPrice = (product) => {
  const v = product?.price ?? product?.product_price;
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const Pos = () => {
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerPickerRef = useRef(null);

  const [productQuery, setProductQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const [categoriesError, setCategoriesError] = useState(null);
  const [shipping, setShipping] = useState('');
  const [extraDiscount, setExtraDiscount] = useState('');
  const [cartLines, setCartLines] = useState([]);

  const [addCustomerForm, setAddCustomerForm] = useState(ADD_CUSTOMER_INITIAL);
  const [addCustomerErrors, setAddCustomerErrors] = useState({});
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState('');

  const loadUsers = useCallback(async (selectAfter) => {
    setUsersStatus('loading');
    setUsersError(null);
    try {
      const list = await fetchUsersListRequest({ limit: 2000, skip: 0 });
      const arr = Array.isArray(list) ? list : [];
      setUsers(arr);
      setUsersStatus('succeeded');
      if (selectAfter?.preferId) {
        setSelectedCustomerId(String(selectAfter.preferId));
      } else if (selectAfter?.fallbackEmail) {
        const em = selectAfter.fallbackEmail.trim().toLowerCase();
        const match = arr.find((u) => (u.email || '').toLowerCase() === em);
        if (match) {
          setSelectedCustomerId(getUserOptionValue(match));
        }
      }
    } catch (err) {
      console.error('[POS] Failed to load users for customer dropdown', err);
      setUsers([]);
      setUsersError(err?.message || 'Could not load users');
      setUsersStatus('failed');
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesStatus('loading');
    setCategoriesError(null);
    try {
      const result = await fetchCategoriesRequest({ page: 1, limit: 2000 });
      const arr = Array.isArray(result?.data) ? result.data : [];
      setCategories(arr);
      setCategoriesStatus('succeeded');
    } catch (err) {
      console.error('[POS] Failed to load categories', err);
      setCategories([]);
      setCategoriesError(err?.message || 'Could not load categories');
      setCategoriesStatus('failed');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!customerPickerRef.current?.contains(e.target)) {
        setCustomerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredCustomers = useMemo(() => {
    const withId = users.filter((u) => getUserOptionValue(u));
    const q = customerFilter.trim().toLowerCase();
    const qDigits = digitsOnlyFromPhone(customerFilter);
    let list = withId;
    if (q || qDigits) {
      list = withId.filter((u) => {
        const label = formatUserOptionLabel(u).toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const phoneDigits = digitsOnlyFromPhone(u.mobile || u.phone || u.phoneNumber || '');
        if (label.includes(q)) return true;
        if (email && email.includes(q)) return true;
        if (qDigits && phoneDigits.includes(qDigits)) return true;
        return false;
      });
    }
    const cap = 150;
    return { rows: list.slice(0, cap), capped: list.length > cap };
  }, [users, customerFilter]);

  const addToCart = useCallback((product) => {
    if (!product || typeof product !== 'object') return;
    const productId = String(product._id ?? product.id ?? product.product_id ?? '');
    if (!productId) return;
    const name = product.name || product.product_name || 'Product';
    const unitPrice = parsePosUnitPrice(product);

    setCartLines((prev) => {
      const i = prev.findIndex((l) => l.productId === productId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { productId, name, unitPrice, quantity: 1 }];
    });
  }, []);

  const bumpCartQty = useCallback((productId, delta) => {
    setCartLines((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l];
        const next = l.quantity + delta;
        if (next < 1) return [];
        return [{ ...l, quantity: next }];
      })
    );
  }, []);

  const setCartQty = useCallback((productId, raw) => {
    const q = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(q) || q < 1) {
      setCartLines((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setCartLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: q } : l))
    );
  }, []);

  const setCartUnitPrice = useCallback((productId, raw) => {
    const n = parseFloat(String(raw).replace(/,/g, ''));
    const unitPrice = Number.isFinite(n) && n >= 0 ? n : 0;
    setCartLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  }, []);

  const cartSubtotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [cartLines]
  );

  const shippingNum = useMemo(() => {
    const n = parseFloat(String(shipping).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [shipping]);

  const extraDiscountNum = useMemo(() => {
    const n = parseFloat(String(extraDiscount).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [extraDiscount]);

  const grandTotal = useMemo(() => {
    const v = cartSubtotal + shippingNum - extraDiscountNum;
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }, [cartSubtotal, shippingNum, extraDiscountNum]);

  const openAddCustomerModal = () => {
    setAddCustomerForm(ADD_CUSTOMER_INITIAL);
    setAddCustomerErrors({});
    setCreateCustomerError('');
    const el = document.getElementById('posAddCustomerModal');
    if (el && window.bootstrap?.Modal) {
      const M = window.bootstrap.Modal;
      const instance =
        typeof M.getOrCreateInstance === 'function'
          ? M.getOrCreateInstance(el)
          : M.getInstance(el) || new M(el);
      instance.show();
    }
  };

  const closeAddCustomerModal = () => {
    const el = document.getElementById('posAddCustomerModal');
    if (el && window.bootstrap?.Modal) {
      const instance = window.bootstrap.Modal.getInstance(el);
      instance?.hide();
    }
  };

  const validateAddCustomer = () => {
    const next = {};
    if (!addCustomerForm.name.trim()) {
      next.name = 'Name is required';
    }
    const emailTrim = addCustomerForm.email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      next.email = 'Enter a valid email';
    }
    if (!addCustomerForm.phone.trim()) {
      next.phone = 'Phone is required';
    } else if (!emailTrim && !/\d/.test(addCustomerForm.phone)) {
      next.phone = 'Phone must include digits (used as name@gmail.com when email is empty)';
    }
    setAddCustomerErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddCustomerFieldChange = (e) => {
    const { name, value } = e.target;
    setAddCustomerForm((prev) => ({ ...prev, [name]: value }));
    if (addCustomerErrors[name]) {
      setAddCustomerErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setCreateCustomerError('');
  };

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    setCreateCustomerError('');
    if (!validateAddCustomer()) {
      return;
    }
    setCreateCustomerSubmitting(true);
    try {
      const resolvedEmail = resolvePosCustomerEmail(addCustomerForm.email, addCustomerForm.phone);
      const json = await createCustomerUserRequest({
        name: addCustomerForm.name,
        email: addCustomerForm.email,
        phone: addCustomerForm.phone,
        password: POS_DEFAULT_CUSTOMER_PASSWORD,
      });
      const created = pickCreatedUserFromResponse(json);
      const newId = getUserOptionValue(created);
      await loadUsers({
        preferId: newId || undefined,
        fallbackEmail: newId ? undefined : resolvedEmail,
      });
      setAddCustomerForm(ADD_CUSTOMER_INITIAL);
      closeAddCustomerModal();
    } catch (err) {
      console.error('[POS] Create customer failed', err);
      setCreateCustomerError(err?.message || 'Could not create customer');
    } finally {
      setCreateCustomerSubmitting(false);
    }
  };

  return (
    <div className="pos-page container-fluid py-3 px-2">
      <style>{`
        .pos-page {
          --pos-purple: #6f42c1;
          --pos-purple-dark: #5a32a3;
          --pos-teal: #11cdef;
          --pos-teal-dark: #0ea5c6;
          --pos-footer-h: 64px;
          font-family: 'Open Sans', sans-serif;
        }
        .pos-topbar {
          background: #fff;
          border-radius: 0.5rem;
          box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,.075);
        }
        .pos-cart-header {
          background: linear-gradient(135deg, var(--pos-purple) 0%, var(--pos-purple-dark) 100%);
          color: #fff;
          font-weight: 600;
          font-size: 0.8rem;
          letter-spacing: 0.02em;
        }
        .pos-grand-total {
          font-size: 1.35rem;
          font-weight: 700;
          color: #2152ff;
        }
        .pos-product-card {
          border: 1px solid #e9ecef;
          border-radius: 0.375rem;
          background: #fff;
          transition: box-shadow 0.15s ease;
          cursor: pointer;
          min-height: 118px;
        }
        .pos-product-card:hover {
          box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,.08);
        }
        .pos-product-img {
          height: 64px;
          object-fit: contain;
          background: #f8f9fa;
        }
        .pos-product-grid {
          max-height: calc(100vh - 280px);
          overflow-y: auto;
        }
        .pos-footer-actions .btn-draft {
          background: #fb8c00;
          border-color: #fb8c00;
          color: #fff;
          font-weight: 600;
        }
        .pos-footer-actions .btn-pay {
          background: #2dce89;
          border-color: #2dce89;
          color: #fff;
          font-weight: 600;
        }
        .pos-footer-actions .btn-card {
          background: #11cdef;
          border-color: #11cdef;
          color: #fff;
          font-weight: 600;
        }
        .pos-icon-btn {
          width: 2.25rem;
          height: 2.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          border: 1px solid #dee2e6;
          background: #fff;
          color: #67748e;
        }
        .pos-register-btn {
          background: #5e72e4;
          border-color: #5e72e4;
          color: #fff;
          font-weight: 600;
        }
        .pos-exit-btn {
          background: #f5365c;
          border-color: #f5365c;
          color: #fff;
        }
        .pos-add-customer {
          background: #11cdef;
          border-color: #11cdef;
          color: #fff;
        }
        .pos-product-name {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.25;
        }
      `}</style>

      {/* Top bar */}
      <div className="pos-topbar d-flex align-items-center justify-content-between px-3 py-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="pos-icon-btn" title="Fullscreen">
            <i className="fas fa-expand"></i>
          </button>
          <span
            className="d-inline-flex align-items-center justify-content-center rounded"
            style={{ width: 36, height: 36, background: '#ffd600', color: '#5c4f00' }}
            title="Gauge"
          >
            <i className="fas fa-tachometer-alt"></i>
          </span>
          <button type="button" className="btn btn-sm px-3 pos-register-btn">
            Register
          </button>
          <button type="button" className="btn btn-sm px-3 pos-exit-btn">
            <i className="fas fa-times me-1"></i>
          </button>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="pos-icon-btn" title="Keyboard">
            <i className="fas fa-keyboard"></i>
          </button>
          <button type="button" className="pos-icon-btn position-relative" title="Notifications">
            <i className="fas fa-bell"></i>
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
              0
            </span>
          </button>
          <button type="button" className="pos-icon-btn position-relative" title="Messages">
            <i className="fas fa-envelope"></i>
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-secondary">
              0
            </span>
          </button>
          <span className="text-sm text-muted me-2">
            <i className="far fa-clock me-1"></i>Off
          </span>
          <div className="dropdown">
            <button
              className="btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center"
              type="button"
              data-bs-toggle="dropdown"
            >
              <i className="fas fa-user-circle me-2 text-lg"></i>
              Account
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <span className="dropdown-item-text text-xs text-muted">POS user</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Left: checkout */}
        <div className="col-lg-5 col-xl-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3">
              <label className="form-label text-xs text-muted mb-1">Customer</label>
              <div className="d-flex gap-2 align-items-start mb-1">
                <div className="flex-grow-1 position-relative" ref={customerPickerRef}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0 text-muted">
                      <i className="fas fa-search" aria-hidden="true"></i>
                    </span>
                    <input
                      type="search"
                      className="form-control border-start-0"
                      placeholder="Search name, phone, or email…"
                      value={customerFilter}
                      onChange={(e) => {
                        setCustomerFilter(e.target.value);
                        setCustomerMenuOpen(true);
                      }}
                      onFocus={() => setCustomerMenuOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setCustomerMenuOpen(false);
                      }}
                      disabled={usersStatus === 'loading'}
                      autoComplete="off"
                      aria-label="Search customers"
                      aria-expanded={customerMenuOpen}
                      aria-controls="pos-customer-picker-list"
                    />
                  </div>
                  {customerMenuOpen && usersStatus !== 'loading' && (
                    <div
                      id="pos-customer-picker-list"
                      className="list-group position-absolute w-100 mt-1 shadow-sm border rounded overflow-hidden bg-white"
                      style={{ zIndex: 1050, maxHeight: 240, overflowY: 'auto' }}
                      role="listbox"
                    >
                      <button
                        type="button"
                        className={`list-group-item list-group-item-action py-2 px-3 border-0 rounded-0 text-start small ${
                          !selectedCustomerId ? 'active' : ''
                        }`}
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerFilter('');
                          setCustomerMenuOpen(false);
                        }}
                      >
                        Walk In (no customer)
                      </button>
                      {filteredCustomers.rows.map((u) => {
                        const value = getUserOptionValue(u);
                        const selected = selectedCustomerId === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`list-group-item list-group-item-action py-2 px-3 border-0 border-top rounded-0 text-start small ${
                              selected ? 'active' : ''
                            }`}
                            onClick={() => {
                              setSelectedCustomerId(value);
                              setCustomerFilter('');
                              setCustomerMenuOpen(false);
                            }}
                          >
                            {formatUserOptionLabel(u)}
                          </button>
                        );
                      })}
                      {filteredCustomers.rows.length === 0 && (
                        <div className="px-3 py-2 text-muted small">No matching customers</div>
                      )}
                      {filteredCustomers.capped && (
                        <div className="px-3 py-2 text-muted small border-top bg-light">
                          Showing first {filteredCustomers.rows.length} — type to narrow results
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn pos-add-customer px-3"
                  type="button"
                  title="Add new customer"
                  onClick={openAddCustomerModal}
                >
                  Add
                </button>
              </div>
              {usersStatus === 'loading' && (
                <p className="text-xs text-muted mb-2">
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Loading customers…
                </p>
              )}
              {usersError && (
                <p className="text-xs text-warning mb-2" role="alert">
                  {usersError}. Check API route in <code className="text-xs">usersAPI.js</code>.
                </p>
              )}
              <p className="text-xs text-muted mb-3">
                {(() => {
                  if (!selectedCustomerId) return 'Default: Walk In';
                  const u = users.find((row) => getUserOptionValue(row) === selectedCustomerId);
                  return u ? `Selected: ${formatUserOptionLabel(u)}` : 'Customer selected';
                })()}
              </p>

              <div className="pos-cart-header rounded-top px-3 py-2 d-flex align-items-center text-xs fw-semibold">
                <div className="flex-grow-1">Product</div>
                <div style={{ width: 112 }} className="text-center flex-shrink-0">
                  Qty
                </div>
                <div style={{ width: '22%' }} className="text-end">
                  Price
                </div>
                <div style={{ width: '22%' }} className="text-end">
                  Total
                </div>
              </div>
              <div
                className="border border-top-0 rounded-bottom bg-white mb-3 pos-cart-body"
                style={{ minHeight: 140, maxHeight: 280, overflowY: 'auto' }}
              >
                {cartLines.length === 0 ? (
                  <div className="text-center text-muted text-sm py-5">No products in cart</div>
                ) : (
                  cartLines.map((line) => {
                    const lineTotal = line.quantity * line.unitPrice;
                    return (
                      <div
                        key={line.productId}
                        className="d-flex align-items-center gap-1 px-2 py-2 border-bottom"
                      >
                        <div className="flex-grow-1 text-sm text-truncate" title={line.name}>
                          {line.name}
                        </div>
                        <div
                          className="d-flex align-items-center justify-content-center gap-0 flex-shrink-0"
                          style={{ width: 112 }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-2 py-0"
                            aria-label="Decrease quantity"
                            onClick={() => bumpCartQty(line.productId, -1)}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="form-control form-control-sm text-center px-1"
                            style={{ width: 44 }}
                            value={line.quantity}
                            onChange={(e) => setCartQty(line.productId, e.target.value)}
                            aria-label={`Quantity for ${line.name}`}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-2 py-0"
                            aria-label="Increase quantity"
                            onClick={() => bumpCartQty(line.productId, 1)}
                          >
                            +
                          </button>
                        </div>
                        <div style={{ width: '22%' }} className="flex-shrink-0">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            value={line.unitPrice}
                            onChange={(e) => setCartUnitPrice(line.productId, e.target.value)}
                            aria-label={`Unit price for ${line.name}`}
                          />
                        </div>
                        <div style={{ width: '22%' }} className="text-end text-sm flex-shrink-0">
                          PKR {lineTotal.toFixed(2)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="d-flex align-items-center gap-2 mb-2">
                <label className="text-xs text-nowrap mb-0" style={{ width: 110 }}>
                  Shipping
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                />
                <span className="text-xs text-nowrap text-muted">( Tax PKR 0 )</span>
              </div>
              <div className="d-flex justify-content-between text-sm mb-1">
                <span>Total Tax</span>
                <span>PKR 0</span>
              </div>
              <div className="d-flex justify-content-between text-sm mb-2">
                <span>Total Discount</span>
                <span>PKR 0 (Products)</span>
              </div>
              <div className="d-flex justify-content-between align-items-baseline mb-3">
                <span className="font-weight-bold">Grand Total</span>
                <span className="pos-grand-total">PKR {grandTotal.toFixed(2)}</span>
              </div>

              <div className="d-flex align-items-center gap-2 mb-3">
                <label className="text-xs text-nowrap mb-0" style={{ width: 110 }}>
                  Extra Discount
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(e.target.value)}
                />
                <span className="text-xs text-nowrap text-muted">( PKR 0 )</span>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <button type="button" className="btn btn-outline-info btn-sm w-100 py-2">
                    <i className="fas fa-trophy me-1"></i> Coupon
                  </button>
                </div>
                <div className="col-6">
                  <button type="button" className="btn btn-outline-secondary btn-sm w-100 py-2">
                    <i className="fas fa-shopping-bag me-1"></i> POS Settings
                  </button>
                </div>
                <div className="col-6">
                  <button type="button" className="btn btn-outline-danger btn-sm w-100 py-2">
                    <i className="fas fa-file-alt me-1"></i> Draft(s)
                  </button>
                </div>
                <div className="col-6">
                  <button type="button" className="btn btn-outline-info btn-sm w-100 py-2">
                    <i className="fas fa-sliders-h me-1"></i> Invoice Properties
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PosProducts
          productQuery={productQuery}
          setProductQuery={setProductQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          categoriesStatus={categoriesStatus}
          categoriesError={categoriesError}
          onAddToCart={addToCart}
          orderTotal={grandTotal}
        />
      </div>

      <div
        className="modal fade"
        id="posAddCustomerModal"
        tabIndex="-1"
        aria-labelledby="posAddCustomerModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="posAddCustomerModalLabel">
                Add customer
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleAddCustomerSubmit}>
              <div className="modal-body">
                <input type="hidden" name="role" value="customer" readOnly />
                <input
                  type="hidden"
                  name="password"
                  value={POS_DEFAULT_CUSTOMER_PASSWORD}
                  readOnly
                  autoComplete="new-password"
                />
                <div className="mb-3">
                  <label htmlFor="pos_customer_name" className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pos_customer_name"
                    name="name"
                    type="text"
                    className={`form-control ${addCustomerErrors.name ? 'is-invalid' : ''}`}
                    value={addCustomerForm.name}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="name"
                  />
                  {addCustomerErrors.name && (
                    <div className="invalid-feedback">{addCustomerErrors.name}</div>
                  )}
                </div>
                <div className="mb-0">
                  <label htmlFor="pos_customer_phone" className="form-label">
                    Phone <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pos_customer_phone"
                    name="phone"
                    type="tel"
                    className={`form-control ${addCustomerErrors.phone ? 'is-invalid' : ''}`}
                    value={addCustomerForm.phone}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="tel"
                  />
                  {addCustomerErrors.phone && (
                    <div className="invalid-feedback">{addCustomerErrors.phone}</div>
                  )}
                </div>
                <div className="mb-3">
                  <label htmlFor="pos_customer_email" className="form-label">
                    Email <span className="text-muted font-weight-normal">(optional)</span>
                  </label>
                  <input
                    id="pos_customer_email"
                    name="email"
                    type="email"
                    className={`form-control ${addCustomerErrors.email ? 'is-invalid' : ''}`}
                    value={addCustomerForm.email}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="email"
                    placeholder="Leave empty to use phone@gmail.com"
                  />
                  <small className="text-muted text-xs">
                    If empty, the saved email is your phone digits + @gmail.com (e.g.
                    03001234567@gmail.com).
                  </small>
                  {addCustomerErrors.email && (
                    <div className="invalid-feedback d-block">{addCustomerErrors.email}</div>
                  )}
                </div>

                {createCustomerError && (
                  <div className="alert alert-danger text-sm mt-3 mb-0 py-2" role="alert">
                    {createCustomerError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn pos-add-customer"
                  disabled={createCustomerSubmitting}
                >
                  {createCustomerSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Saving…
                    </>
                  ) : (
                    'Create customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pos;
