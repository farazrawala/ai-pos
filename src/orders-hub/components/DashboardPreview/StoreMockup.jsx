import { ShoppingCart } from 'lucide-react';
import { storeCategories, storeProducts } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';

export default function StoreMockup() {
  return (
    <div className="oh-mock oh-mock--store" aria-hidden="true" inert>
      <div className="oh-store-banner">
        <div>
          <p className="oh-eyebrow">Noor Mart</p>
          <h3>Summer essentials, in stock today.</h3>
        </div>
        <span className="oh-store-cart">
          <ShoppingCart size={16} /> Cart · 2
        </span>
      </div>
      <div className="oh-store-cats">
        {storeCategories.map((cat, i) => (
          <span key={cat} className={i === 0 ? 'is-active' : ''}>
            {cat}
          </span>
        ))}
      </div>
      <div className="oh-store-grid">
        {storeProducts.map((p) => (
          <article key={p.name}>
            <div className="oh-store-thumb" />
            <p className="oh-store-cat">{p.category}</p>
            <h4>{p.name}</h4>
            <div className="oh-store-row">
              <strong>{formatPKR(p.price)}</strong>
              <button type="button">Add to Cart</button>
            </div>
          </article>
        ))}
      </div>
      <div className="oh-store-checkout">Checkout · PKR 4,198</div>
    </div>
  );
}
