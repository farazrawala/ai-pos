import { Search, ScanBarcode } from 'lucide-react';
import { posCart, posCatalog } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';

const subtotal = posCart.reduce((sum, row) => sum + row.qty * row.price, 0);

export default function PosMockup() {
  return (
    <div className="oh-mock oh-mock--pos" aria-hidden="true" inert>
      <div className="oh-mock__chrome">
        <span />
        <span />
        <span />
        <p>Orders Hub · POS</p>
      </div>
      <div className="oh-pos">
        <div className="oh-pos__main">
          <div className="oh-pos__search">
            <Search size={16} />
            <span>Scan barcode or search products</span>
            <ScanBarcode size={16} />
          </div>
          <div className="oh-pos__grid">
            {posCatalog.map((p) => (
              <article key={p.sku}>
                <div className="oh-pos__thumb" />
                <h4>{p.name}</h4>
                <p>{p.sku}</p>
                <strong>{formatPKR(p.price)}</strong>
              </article>
            ))}
          </div>
        </div>
        <aside className="oh-pos__cart">
          <h4>Current ticket</h4>
          <ul>
            {posCart.map((row) => (
              <li key={row.name}>
                <span>
                  {row.name}
                  <small>
                    {row.qty} × {formatPKR(row.price)}
                  </small>
                </span>
                <b>{formatPKR(row.qty * row.price)}</b>
              </li>
            ))}
          </ul>
          <div className="oh-pos__total">
            <span>Total</span>
            <strong>{formatPKR(subtotal)}</strong>
          </div>
          <div className="oh-pos__pays">
            <button type="button">Cash</button>
            <button type="button">Card</button>
            <button type="button">Credit</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
