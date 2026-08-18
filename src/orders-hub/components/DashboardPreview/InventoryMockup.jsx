import { lowStock } from '../../data/mock.js';

export default function InventoryMockup() {
  return (
    <div className="oh-mock" aria-hidden="true" inert>
      <div className="oh-mock__chrome">
        <span />
        <span />
        <span />
        <p>Orders Hub · Inventory</p>
      </div>
      <div className="oh-kpi-row oh-kpi-row--4">
        <div className="oh-kpi">
          <p>SKUs tracked</p>
          <strong>2,244</strong>
        </div>
        <div className="oh-kpi">
          <p>Stock value</p>
          <strong>PKR 6.84M</strong>
        </div>
        <div className="oh-kpi">
          <p>Low stock</p>
          <strong>8</strong>
        </div>
        <div className="oh-kpi">
          <p>Warehouses</p>
          <strong>3</strong>
        </div>
      </div>
      <div className="oh-table-wrap">
        <table className="oh-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Warehouse</th>
              <th>On hand</th>
              <th>Reorder at</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.warehouse}</td>
                <td>{row.qty}</td>
                <td>{row.reorder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
