import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaLocationDot,
  FaMoneyBillWave,
  FaShieldHalved,
  FaTruck,
} from 'react-icons/fa6';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import { buildCheckoutThemeStyle } from '../../config/themes.js';
import {
  cartLines,
  cartSubtotal,
  createClientOrderId,
  formatShopPrice,
  loadShopCart,
  saveShopCart,
  shopRequest,
} from './shopUtils.js';
import './shop-checkout.css';

const PHONE_PREFIX = '92';
const PHONE_MAX_LENGTH = 12;

/** Digits only, always starts with 92, max 12 characters. */
function normalizeCheckoutPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith(PHONE_PREFIX)) {
    return digits.slice(0, PHONE_MAX_LENGTH);
  }
  if (!digits || PHONE_PREFIX.startsWith(digits)) {
    return PHONE_PREFIX;
  }
  return `${PHONE_PREFIX}${digits.replace(/^0+/, '')}`.slice(0, PHONE_MAX_LENGTH);
}

const EMPTY_FORM = {
  customer_name: '',
  phone: PHONE_PREFIX,
  email: '',
  address: '',
  area: '',
  city: '',
  postal_code: '',
  delivery_instructions: '',
};

export default function ShopCheckout() {
  const { companySlug } = useParams();
  const navigate = useNavigate();
  const slug = encodeURIComponent(companySlug || '');
  const submittingRef = useRef(false);

  const [store, setStore] = useState(null);
  const [cart, setCart] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientOrderId] = useState(createClientOrderId);

  useEffect(() => {
    let cancelled = false;
    shopRequest(`shop/${slug}`)
      .then((body) => {
        if (cancelled) return;
        const loadedStore = body?.data || null;
        const paymentMethods = (loadedStore?.payment_methods || []).filter(
          (method) =>
            method?.account_type !== 'account_receivable' &&
            !/accounts?\s*receivable/i.test(String(method?.name || ''))
        );
        const preferredPayment =
          paymentMethods.find((method) => /cash/i.test(String(method?.name || ''))) ||
          paymentMethods[0];
        setStore({ ...loadedStore, payment_methods: paymentMethods });
        setCart(loadShopCart(loadedStore?._id));
        setDeliveryMethod(String(loadedStore?.delivery_methods?.[0]?.id || ''));
        setPaymentMethod(String(preferredPayment?.id || ''));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const lines = useMemo(() => cartLines(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
  const selectedDelivery = store?.delivery_methods?.find(
    (method) => String(method.id) === deliveryMethod
  );
  const deliveryCharge = Number(selectedDelivery?.charge) || 0;
  const total = subtotal + deliveryCharge;

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const next = {};
    if (!form.customer_name.trim()) next.customer_name = 'Full name is required.';
    if (!form.phone.trim() || form.phone === PHONE_PREFIX) {
      next.phone = 'Mobile number is required.';
    } else if (!/^92\d{1,10}$/.test(form.phone) || form.phone.length < 11) {
      next.phone = 'Enter a valid mobile number starting with 92 (max 12 digits).';
    }
    if (!form.address.trim()) next.address = 'Delivery address is required.';
    if (!form.area.trim()) next.area = 'Area / locality is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email address.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !validate()) return;
    if (!lines.length) {
      setError('Your cart is empty.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    try {
      const body = await shopRequest(`shop/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          client_order_id: clientOrderId,
          customer: form,
          delivery_method: deliveryMethod,
          payment_method_id: paymentMethod || undefined,
          items: lines.map((line) => ({
            product_id: line.product_id,
            quantity: Number(line.qty),
          })),
        }),
      });

      const order = body?.data;
      if (!order?._id && !order?.order_no) {
        throw new Error('The order was saved but no order reference was returned.');
      }
      saveShopCart(store._id, {});
      setCart({});
      navigate(
        `/shop/${companySlug}/order-success/${encodeURIComponent(order._id || order.order_no)}`,
        { replace: true, state: { order } }
      );
    } catch (requestError) {
      setError(requestError.message);
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="checkout-loading">Loading checkout…</div>;
  }

  if (!lines.length) {
    return (
      <div
        className="checkout-page"
        style={buildCheckoutThemeStyle(store?.theme_color) || undefined}
      >
        <main className="checkout-container cart-empty standalone">
          <h1>Your cart is empty</h1>
          <p>Add products before opening billing details.</p>
          <button type="button" onClick={() => navigate(`/shop/${companySlug}`)}>
            Return to store
          </button>
        </main>
      </div>
    );
  }

  const logoUrl = resolveCategoryMediaUrl(store?.company_logo);
  const brandInitial = String(store?.company_name || 'S')
    .trim()
    .charAt(0)
    .toUpperCase();
  const checkoutThemeStyle = buildCheckoutThemeStyle(store?.theme_color);

  return (
    <div className="checkout-page" style={checkoutThemeStyle || undefined}>
      <header className="checkout-header">
        <div className="checkout-container checkout-header-inner">
          <button type="button" onClick={() => navigate(`/shop/${companySlug}/cart`)}>
            <FaArrowLeft /> Back to cart
          </button>
          <div className="checkout-brand">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="checkout-brand-logo" />
            ) : (
              <span className="checkout-brand-fallback" aria-hidden="true">
                {brandInitial}
              </span>
            )}
            <strong>{store?.company_name || 'Checkout'}</strong>
          </div>
          <span>
            <FaShieldHalved /> Secure checkout
          </span>
        </div>
      </header>

      <main className="checkout-container checkout-main">
        <div className="checkout-title">
          <div>
            <span>Step 2 of 2</span>
            <h1>Billing & delivery details</h1>
          </div>
          <p>Review your details before placing the order.</p>
        </div>

        {error ? <div className="checkout-alert">{error}</div> : null}

        <form className="billing-layout" onSubmit={placeOrder}>
          <div className="billing-forms">
            <section className="billing-card">
              <div className="billing-card-title">
                <FaLocationDot />
                <div>
                  <h2>Customer information</h2>
                  <p>Required for delivery and order updates.</p>
                </div>
              </div>

              <div className="billing-fields">
                <label>
                  <span>Full name *</span>
                  <input
                    value={form.customer_name}
                    onChange={(event) => updateField('customer_name', event.target.value)}
                    className={fieldErrors.customer_name ? 'is-invalid' : ''}
                    autoComplete="name"
                  />
                  {fieldErrors.customer_name ? <small>{fieldErrors.customer_name}</small> : null}
                </label>

                <label>
                  <span>Mobile number *</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={PHONE_MAX_LENGTH}
                    value={form.phone}
                    onChange={(event) =>
                      updateField('phone', normalizeCheckoutPhone(event.target.value))
                    }
                    onBlur={() => updateField('phone', normalizeCheckoutPhone(form.phone))}
                    className={fieldErrors.phone ? 'is-invalid' : ''}
                    autoComplete="tel"
                    placeholder="923001234567"
                  />
                  {fieldErrors.phone ? <small>{fieldErrors.phone}</small> : null}
                </label>

                <label className="full">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    className={fieldErrors.email ? 'is-invalid' : ''}
                    autoComplete="email"
                  />
                  {fieldErrors.email ? <small>{fieldErrors.email}</small> : null}
                </label>

                <label className="full">
                  <span>Delivery address *</span>
                  <input
                    value={form.address}
                    onChange={(event) => updateField('address', event.target.value)}
                    className={fieldErrors.address ? 'is-invalid' : ''}
                    autoComplete="street-address"
                  />
                  {fieldErrors.address ? <small>{fieldErrors.address}</small> : null}
                </label>

                <label>
                  <span>Area / locality *</span>
                  <input
                    value={form.area}
                    onChange={(event) => updateField('area', event.target.value)}
                    className={fieldErrors.area ? 'is-invalid' : ''}
                    autoComplete="address-level2"
                  />
                  {fieldErrors.area ? <small>{fieldErrors.area}</small> : null}
                </label>

                <label>
                  <span>City *</span>
                  <input
                    value={form.city}
                    onChange={(event) => updateField('city', event.target.value)}
                    className={fieldErrors.city ? 'is-invalid' : ''}
                    autoComplete="address-level1"
                  />
                  {fieldErrors.city ? <small>{fieldErrors.city}</small> : null}
                </label>

                <label>
                  <span>Postal code</span>
                  <input
                    value={form.postal_code}
                    onChange={(event) => updateField('postal_code', event.target.value)}
                    autoComplete="postal-code"
                  />
                </label>

                <label className="full">
                  <span>Delivery instructions</span>
                  <textarea
                    rows="3"
                    value={form.delivery_instructions}
                    onChange={(event) => updateField('delivery_instructions', event.target.value)}
                    placeholder="Landmark, floor, gate instructions, etc."
                  />
                </label>
              </div>
            </section>

            {store?.delivery_methods?.length ? (
              <section className="billing-card">
                <div className="billing-card-title">
                  <FaTruck />
                  <div>
                    <h2>Delivery method</h2>
                    <p>Choose how you want to receive your order.</p>
                  </div>
                </div>
                <div className="checkout-options">
                  {store.delivery_methods.map((method) => (
                    <label
                      key={method.id}
                      className={deliveryMethod === String(method.id) ? 'selected' : ''}
                    >
                      <input
                        type="radio"
                        name="delivery_method"
                        value={String(method.id)}
                        checked={deliveryMethod === String(method.id)}
                        onChange={(event) => setDeliveryMethod(event.target.value)}
                      />
                      <span>{method.label}</span>
                      <strong>{method.charge ? formatShopPrice(method.charge) : 'Free'}</strong>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {store?.payment_methods?.length ? (
              <section className="billing-card">
                <div className="billing-card-title">
                  <FaMoneyBillWave />
                  <div>
                    <h2>Payment method</h2>
                    <p>Only methods enabled by the store are shown.</p>
                  </div>
                </div>
                <div className="checkout-options">
                  {store.payment_methods.map((method) => (
                    <label
                      key={method.id}
                      className={paymentMethod === String(method.id) ? 'selected' : ''}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={String(method.id)}
                        checked={paymentMethod === String(method.id)}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      />
                      <span>{method.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="billing-summary">
            <h2>Your order</h2>
            <div className="billing-summary-lines">
              {lines.map((line) => (
                <div key={line.product_id}>
                  <span>
                    {line.name} <em>× {line.qty}</em>
                  </span>
                  <strong>{formatShopPrice(Number(line.price) * Number(line.qty))}</strong>
                </div>
              ))}
            </div>
            <div className="billing-totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatShopPrice(subtotal)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{deliveryCharge ? formatShopPrice(deliveryCharge) : 'Free'}</strong>
              </div>
              <div className="grand">
                <span>Total</span>
                <strong>{formatShopPrice(total)}</strong>
              </div>
            </div>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Placing order…' : `Place order · ${formatShopPrice(total)}`}
            </button>
            <p>By placing the order, you confirm the details entered above are correct.</p>
          </aside>
        </form>
      </main>
    </div>
  );
}
