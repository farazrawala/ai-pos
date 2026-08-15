import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FaCircleCheck } from 'react-icons/fa6';
import { formatShopPrice, shopRequest } from './shopUtils.js';
import './shop-checkout.css';

export default function ShopOrderSuccess() {
  const { companySlug, orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(location.state?.order || null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order) return;
    shopRequest(
      `shop/${encodeURIComponent(companySlug || '')}/orders/${encodeURIComponent(
        orderId || ''
      )}`
    )
      .then((body) => setOrder(body?.data || null))
      .catch((requestError) => setError(requestError.message));
  }, [companySlug, order, orderId]);

  return (
    <div className="checkout-page">
      <main className="order-success">
        <div className="order-success-icon">
          <FaCircleCheck />
        </div>
        <span>Order confirmed</span>
        <h1>Thank you for your order</h1>
        <p>We’ll contact you shortly regarding delivery and payment.</p>

        {error ? <div className="checkout-alert">{error}</div> : null}
        {order ? (
          <div className="order-success-details">
            <div>
              <span>Order number</span>
              <strong>{order.order_no || order._id}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatShopPrice(order.total_amount)}</strong>
            </div>
          </div>
        ) : !error ? (
          <p>Loading order details…</p>
        ) : null}

        <button type="button" onClick={() => navigate(`/shop/${companySlug}`)}>
          Continue shopping
        </button>
      </main>
    </div>
  );
}
