import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCartShopping,
  FaMinus,
  FaPlus,
  FaShieldHalved,
  FaTrash,
} from 'react-icons/fa6';
import { resolveCategoryMediaUrl } from '../../config/apiConfig.js';
import {
  cartLines,
  cartSubtotal,
  formatShopPrice,
  loadShopCart,
  saveShopCart,
  shopRequest,
} from './shopUtils.js';
import './shop-checkout.css';

export default function ShopCart() {
  const { companySlug } = useParams();
  const navigate = useNavigate();
  const slug = encodeURIComponent(companySlug || '');
  const [store, setStore] = useState(null);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    shopRequest(`shop/${slug}`)
      .then((body) => {
        if (cancelled) return;
        const loadedStore = body?.data || null;
        setStore(loadedStore);
        setCart(loadShopCart(loadedStore?._id));
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

  useEffect(() => {
    if (store?._id) saveShopCart(store._id, cart);
  }, [cart, store?._id]);

  const lines = useMemo(() => cartLines(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  const updateQty = (productId, nextQty) => {
    setCart((current) => {
      const next = { ...current };
      if (nextQty <= 0) delete next[productId];
      else next[productId] = { ...next[productId], qty: nextQty };
      return next;
    });
  };

  const proceed = async () => {
    if (!lines.length || validating) return;
    setValidating(true);
    setError('');
    try {
      const body = await shopRequest(`shop/${slug}/cart/validate`, {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map((line) => ({
            product_id: line.product_id,
            quantity: line.qty,
          })),
        }),
      });
      if (body?.data?.ok === false) {
        setError(
          body.message ||
            'Some products are currently unavailable. Please update your cart.'
        );
        return;
      }
      navigate(`/shop/${companySlug}/checkout`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return <div className="checkout-loading">Loading your cart…</div>;
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <div className="checkout-container checkout-header-inner">
          <button type="button" onClick={() => navigate(`/shop/${companySlug}`)}>
            <FaArrowLeft /> Continue shopping
          </button>
          <strong>{store?.company_name || 'Store'}</strong>
          <span>
            <FaShieldHalved /> Secure checkout
          </span>
        </div>
      </header>

      <main className="checkout-container checkout-main">
        <div className="checkout-title">
          <div>
            <span>Step 1 of 2</span>
            <h1>Shopping cart</h1>
          </div>
          <p>
            {lines.length} item{lines.length === 1 ? '' : 's'}
          </p>
        </div>

        {error ? <div className="checkout-alert">{error}</div> : null}

        {!lines.length ? (
          <section className="cart-empty">
            <FaCartShopping />
            <h2>Your cart is empty</h2>
            <p>Browse the store and add products to place an order.</p>
            <button type="button" onClick={() => navigate(`/shop/${companySlug}`)}>
              Browse products
            </button>
          </section>
        ) : (
          <div className="cart-layout">
            <section className="cart-lines">
              {lines.map((line) => {
                const image = resolveCategoryMediaUrl(line.image);
                return (
                  <article className="cart-line" key={line.product_id}>
                    <div className="cart-line-image">
                      {image ? <img src={image} alt={line.name} /> : <FaCartShopping />}
                    </div>
                    <div className="cart-line-info">
                      <h2>{line.name}</h2>
                      {line.sku ? <span>SKU: {line.sku}</span> : null}
                      <strong>{formatShopPrice(line.price)}</strong>
                    </div>
                    <div className="cart-qty">
                      <button
                        type="button"
                        onClick={() => updateQty(line.product_id, Number(line.qty) - 1)}
                        aria-label="Decrease quantity"
                      >
                        <FaMinus />
                      </button>
                      <span>{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(line.product_id, Number(line.qty) + 1)}
                        aria-label="Increase quantity"
                      >
                        <FaPlus />
                      </button>
                    </div>
                    <strong className="cart-line-total">
                      {formatShopPrice(Number(line.price) * Number(line.qty))}
                    </strong>
                    <button
                      type="button"
                      className="cart-remove"
                      onClick={() => updateQty(line.product_id, 0)}
                      aria-label={`Remove ${line.name}`}
                    >
                      <FaTrash />
                    </button>
                  </article>
                );
              })}
            </section>

            <aside className="cart-summary">
              <h2>Order summary</h2>
              <div>
                <span>Subtotal</span>
                <strong>{formatShopPrice(subtotal)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <span>Calculated next</span>
              </div>
              <div className="cart-summary-total">
                <span>Total</span>
                <strong>{formatShopPrice(subtotal)}</strong>
              </div>
              <button type="button" onClick={proceed} disabled={validating}>
                {validating ? 'Checking availability…' : 'Continue to billing'}
              </button>
              <p>
                <FaShieldHalved /> Products are validated before checkout.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
