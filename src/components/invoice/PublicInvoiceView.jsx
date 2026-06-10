import InvoiceQrCode from './InvoiceQrCode.jsx';
import { formatInvoiceMoney } from '../../features/orders/invoiceViewMapper.js';

const fmt = formatInvoiceMoney;

export default function PublicInvoiceView({
  data,
  printerSettings,
  companyBrand,
  billTo,
  summary,
  grossAmount,
  paymentMethod,
  sourceOrder = null,
  showQrCode = false,
}) {
  const ps = printerSettings || {};
  const brand = companyBrand || { name: '' };
  const billToDisplay = billTo || data?.billTo || { name: '—' };
  const summaryDisplay = summary || data?.summary || {};
  const grossDisplay = grossAmount ?? data?.grossAmount ?? summaryDisplay.total ?? 0;
  const lines = Array.isArray(data?.lines) ? data.lines : [];
  const termsBody = Array.isArray(data?.termsBody) ? data.termsBody : [];
  const statusLabel = String(data?.paymentStatus || sourceOrder?.order_status || 'active').trim();
  const isPaid =
    summaryDisplay.balanceDue <= 0 ||
    ['paid', 'completed', 'active'].includes(statusLabel.toLowerCase());

  return (
    <article className="pub-inv-card">
      <header className="pub-inv-card-header">
        <div className="pub-inv-brand">
          {ps.show_logo ? (
            brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="pub-inv-logo" />
            ) : (
              <div className="pub-inv-logo pub-inv-logo-fallback">
                {(brand.name || 'S').charAt(0).toUpperCase()}
              </div>
            )
          ) : null}
          <div className="pub-inv-brand-text">
            {ps.show_company_name ? (
              <h1 className="pub-inv-company-name">{brand.name}</h1>
            ) : null}
            <div className="pub-inv-company-meta">
              {ps.show_phone && brand.phone ? <span>{brand.phone}</span> : null}
              {ps.show_email && brand.email ? <span>{brand.email}</span> : null}
              {ps.show_address && brand.address ? <span>{brand.address}</span> : null}
            </div>
          </div>
        </div>
        <div className="pub-inv-head-right">
          <div className="pub-inv-badge">Invoice</div>
          {ps.show_invoice_no ? (
            <div className="pub-inv-order-no">
              <span className="pub-inv-order-label">Order</span>
              <strong>{data?.invoiceNo}</strong>
            </div>
          ) : null}
          <span className={`pub-inv-status ${isPaid ? 'pub-inv-status-paid' : ''}`}>
            {isPaid ? 'Paid' : statusLabel}
          </span>
        </div>
      </header>

      <div className="pub-inv-body">
        <div className="pub-inv-meta-grid">
          <section className="pub-inv-meta-block">
            <h2 className="pub-inv-section-label">Bill to</h2>
            <p className="pub-inv-customer-name">{billToDisplay.name}</p>
            {ps.show_customer_phone && billToDisplay.phone && billToDisplay.phone !== '—' ? (
              <p className="pub-inv-meta-line">{billToDisplay.phone}</p>
            ) : null}
            {ps.show_customer_email && billToDisplay.email && billToDisplay.email !== '—' ? (
              <p className="pub-inv-meta-line">{billToDisplay.email}</p>
            ) : null}
          </section>
          <section className="pub-inv-meta-block pub-inv-meta-block-end">
            {ps.show_invoice_date ? (
              <div className="pub-inv-meta-row">
                <span>Invoice date</span>
                <strong>{data?.invoiceDate}</strong>
              </div>
            ) : null}
            <div className="pub-inv-meta-row">
              <span>Terms</span>
              <strong>{data?.terms}</strong>
            </div>
            {ps.show_payment_method ? (
              <div className="pub-inv-meta-row">
                <span>Payment</span>
                <strong className="pub-inv-pay-pill">
                  {paymentMethod || data?.paymentMethod || '—'}
                </strong>
              </div>
            ) : null}
          </section>
        </div>

        {ps.show_gross_amount ? (
          <div className="pub-inv-gross-banner">
            <span>Gross amount</span>
            <strong>{fmt(grossDisplay)}</strong>
          </div>
        ) : null}

        <div className="pub-inv-table-wrap">
          <table className="pub-inv-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th className="text-end">Rate</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="pub-inv-line-num">{i + 1}</td>
                  <td className="pub-inv-line-desc">{line.description}</td>
                  <td className="text-end">{fmt(line.rate)}</td>
                  <td className="text-end">{line.qtyLabel}</td>
                  <td className="text-end pub-inv-line-amt">{fmt(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pub-inv-bottom">
          {data?.note ? (
            <section className="pub-inv-note">
              <h2 className="pub-inv-section-label">Note</h2>
              <p>{data.note}</p>
            </section>
          ) : (
            <div />
          )}

          <aside className="pub-inv-summary">
            <h2 className="pub-inv-section-label">Summary</h2>
            <div className="pub-inv-summary-box">
              <div className="pub-inv-sum-row">
                <span>Sub total</span>
                <span>{fmt(summaryDisplay.subTotal)}</span>
              </div>
              <div className="pub-inv-sum-row">
                <span>Tax</span>
                <span>{fmt(summaryDisplay.tax)}</span>
              </div>
              {ps.show_discount ? (
                <div className="pub-inv-sum-row">
                  <span>Discount</span>
                  <span>{fmt(summaryDisplay.discount)}</span>
                </div>
              ) : null}
              {ps.show_shipping ? (
                <div className="pub-inv-sum-row">
                  <span>Shipping</span>
                  <span>{fmt(summaryDisplay.shipping)}</span>
                </div>
              ) : null}
              <div className="pub-inv-sum-row pub-inv-sum-total">
                <span>Total</span>
                <span>{fmt(summaryDisplay.total)}</span>
              </div>
              {ps.show_payment_made ? (
                <div className="pub-inv-sum-row pub-inv-sum-paid">
                  <span>Payment made</span>
                  <span>(-) {fmt(summaryDisplay.paymentMade)}</span>
                </div>
              ) : null}
              {ps.show_balance_due ? (
                <div className="pub-inv-sum-row pub-inv-sum-due">
                  <span>Balance due</span>
                  <span>{fmt(summaryDisplay.balanceDue)}</span>
                </div>
              ) : null}
              {ps.show_change_return && sourceOrder ? (
                <>
                  {sourceOrder.amount_received != null && sourceOrder.amount_received !== '' ? (
                    <div className="pub-inv-sum-row">
                      <span>Amount received</span>
                      <span>{fmt(sourceOrder.amount_received)}</span>
                    </div>
                  ) : null}
                  {sourceOrder.change_given != null && sourceOrder.change_given !== '' ? (
                    <div className="pub-inv-sum-row">
                      <span>Change return</span>
                      <span>{fmt(sourceOrder.change_given)}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </aside>
        </div>

        {(showQrCode && ps.show_qrcode && data?.publicUrl) || termsBody.length > 0 ? (
          <footer className="pub-inv-footer">
            {showQrCode && ps.show_qrcode && data?.publicUrl ? (
              <div className="pub-inv-qr">
                <InvoiceQrCode value={data.publicUrl} size={108} className="pub-inv-qr-img" />
                <p>Scan to view this invoice online</p>
              </div>
            ) : null}
            {termsBody.length > 0 ? (
              <div className="pub-inv-terms">
                <h2 className="pub-inv-section-label">Terms &amp; conditions</h2>
                <ol>
                  {termsBody.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
