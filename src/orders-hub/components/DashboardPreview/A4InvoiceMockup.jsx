export default function A4InvoiceMockup() {
  return (
    <div className="oh-inv-card oh-inv-card--a4" aria-hidden="true" inert>
      <p className="oh-inv-card__label">A4 Invoice</p>
      <div className="oh-a4">
        <header className="oh-a4__top">
          <div>
            <strong className="oh-a4__brand">Noor Mart</strong>
            <p>Shop 12, Tariq Road · Karachi</p>
            <p>NTN 1234567-8</p>
          </div>
          <div className="oh-a4__doc">
            <span>TAX INVOICE</span>
            <strong>INV-1842</strong>
            <p>Date: 20 Aug 2026</p>
          </div>
        </header>

        <div className="oh-a4__parties">
          <div>
            <b>Bill to</b>
            <p>Ayesha Traders</p>
            <p>Gulshan-e-Iqbal, Karachi</p>
            <p>Phone: 0300-1234567</p>
          </div>
          <div>
            <b>Ship to</b>
            <p>Same as billing</p>
            <p>Terms: Net 7</p>
            <p>Due: 25 Aug 2026</p>
          </div>
        </div>

        <table className="oh-a4__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Earbuds Pro</td>
              <td>4</td>
              <td>2,999</td>
              <td>11,996</td>
            </tr>
            <tr>
              <td>2</td>
              <td>USB-C Fast Charger</td>
              <td>6</td>
              <td>1,199</td>
              <td>7,194</td>
            </tr>
          </tbody>
        </table>

        <div className="oh-a4__summary">
          <div className="oh-a4__notes">
            <b>Notes</b>
            <p>Partial payments supported. Thank you for your business.</p>
          </div>
          <div className="oh-a4__totals">
            <div>
              <span>Subtotal</span>
              <span>PKR 19,190</span>
            </div>
            <div>
              <span>Tax</span>
              <span>PKR 0</span>
            </div>
            <div className="oh-a4__grand">
              <span>Total</span>
              <span>PKR 19,190</span>
            </div>
            <div className="oh-a4__paid">Paid</div>
          </div>
        </div>
      </div>
    </div>
  );
}
