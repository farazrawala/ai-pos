export default function InvoiceMockup() {
  return (
    <div className="oh-inv-card oh-inv-card--digital" aria-hidden="true" inert>
      <p className="oh-inv-card__label">Digital</p>
      <div className="oh-invoice">
        <header>
          <div>
            <p className="oh-eyebrow">Invoice</p>
            <strong>INV-1842</strong>
          </div>
          <div className="oh-invoice__status">Paid</div>
        </header>
        <div className="oh-invoice__meta">
          <p>
            <b>Bill to</b>
            Ayesha Traders
            <br />
            Karachi
          </p>
          <p>
            <b>Due</b>
            25 Aug 2026
            <br />
            Terms: Net 7
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Earbuds Pro</td>
              <td>4</td>
              <td>PKR 11,996</td>
            </tr>
            <tr>
              <td>USB-C Fast Charger</td>
              <td>6</td>
              <td>PKR 7,194</td>
            </tr>
          </tbody>
        </table>
        <footer>
          <span>Partial payments supported</span>
          <strong>Total PKR 19,190</strong>
        </footer>
      </div>
    </div>
  );
}
