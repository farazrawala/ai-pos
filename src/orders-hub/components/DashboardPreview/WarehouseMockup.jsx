import { warehouses } from '../../data/mock.js';
import { formatPKR } from '../../utils/format.js';

export default function WarehouseMockup() {
  return (
    <div className="oh-wh-grid" aria-hidden="true" inert>
      {warehouses.map((wh) => (
        <article key={wh.name} className="oh-mock oh-wh-card">
          <h3>{wh.name}</h3>
          <p>{wh.city}</p>
          <dl>
            <div>
              <dt>SKUs</dt>
              <dd>{wh.sku.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>{formatPKR(wh.value)}</dd>
            </div>
          </dl>
          <div className="oh-meter">
            <span style={{ width: `${wh.fill}%` }} />
          </div>
          <small>{wh.fill}% capacity</small>
        </article>
      ))}
    </div>
  );
}
