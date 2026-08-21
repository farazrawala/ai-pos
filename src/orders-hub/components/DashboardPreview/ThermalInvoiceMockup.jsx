export default function ThermalInvoiceMockup() {
  return (
    <div className="oh-inv-card oh-inv-card--thermal" aria-hidden="true" inert>
      <p className="oh-inv-card__label">Thermal</p>
      <div className="oh-thermal">
        <div className="oh-thermal__shop">
          <strong>Noor Mart</strong>
          <span>Main Store · Karachi</span>
          <span>Tel: 021-1234567</span>
        </div>
        <div className="oh-thermal__rule" />
        <div className="oh-thermal__meta">
          <span>INV-1842</span>
          <span>20 Aug 2026 14:32</span>
          <span>Cash</span>
        </div>
        <div className="oh-thermal__rule" />
        <div className="oh-thermal__lines">
          <div className="oh-thermal__line">
            <span>Earbuds Pro x4</span>
            <span>11,996</span>
          </div>
          <div className="oh-thermal__line">
            <span>USB-C Charger x6</span>
            <span>7,194</span>
          </div>
        </div>
        <div className="oh-thermal__rule oh-thermal__rule--dash" />
        <div className="oh-thermal__totals">
          <div>
            <span>Subtotal</span>
            <span>19,190</span>
          </div>
          <div className="oh-thermal__total">
            <span>TOTAL</span>
            <span>PKR 19,190</span>
          </div>
          <div>
            <span>Paid</span>
            <span>19,190</span>
          </div>
        </div>
        <div className="oh-thermal__rule" />
        <p className="oh-thermal__thanks">Thank you for shopping</p>
        <div className="oh-thermal__barcode" />
      </div>
    </div>
  );
}
