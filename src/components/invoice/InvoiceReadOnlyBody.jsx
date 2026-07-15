import InvoiceQrCode from './InvoiceQrCode.jsx';
import { formatInvoiceMoney } from '../../features/orders/invoiceViewMapper.js';

const fmt = formatInvoiceMoney;

/**
 * Read-only invoice body (header, lines, summary, footer) respecting printer toggles.
 */
export default function InvoiceReadOnlyBody({
  data,
  printerSettings,
  companyBrand,
  billTo,
  summary,
  grossAmount,
  paymentMethod,
  sourceOrder = null,
  currentUserName = '',
  showPublicUrl = false,
  showQrCode = true,
}) {
  const ps = printerSettings || {};
  const brand = companyBrand || { name: '' };
  const billToDisplay = billTo || data?.billTo || { name: '—' };
  const summaryDisplay = summary || data?.summary || {};
  const grossDisplay = grossAmount ?? data?.grossAmount ?? summaryDisplay.total ?? 0;
  const lines = Array.isArray(data?.lines) ? data.lines : [];
  const termsBody = Array.isArray(data?.termsBody) ? data.termsBody : [];

  return (
    <div className="pos-inv-paper p-4 p-md-5 mb-4">
      <div className="row align-items-start mb-4 pb-3 border-bottom">
        <div className="col-md-6 mb-3 mb-md-0">
          <div className="d-flex align-items-center gap-3">
            {ps.show_logo ? (
              brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.name} logo`}
                  className="rounded border bg-white flex-shrink-0"
                  style={{ width: 72, height: 72, objectFit: 'contain' }}
                />
              ) : (
                <div
                  className="rounded border bg-light d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 72, height: 72 }}
                >
                  <span className="text-muted small text-center px-1">LOGO</span>
                </div>
              )
            ) : null}
            <div>
              {ps.show_company_name ? (
                <>
                  <div
                    className="fw-bold text-uppercase text-secondary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {brand.name}
                  </div>
                  <div className="h5 mb-0 fw-semibold">{brand.name}</div>
                </>
              ) : null}
              {ps.show_phone && brand.phone ? (
                <div className="small text-secondary mt-1">{brand.phone}</div>
              ) : null}
              {ps.show_email && brand.email ? (
                <div className="small text-secondary">{brand.email}</div>
              ) : null}
              {ps.show_address && brand.address ? (
                <div className="small text-secondary">{brand.address}</div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col-md-6 text-md-end">
          <div className="pos-inv-title mb-2">INVOICE</div>
          {ps.show_invoice_no ? (
            <div className="mb-1">
              <span className="text-muted">POS# </span>
              <span className="fw-bold">{data?.invoiceNo}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6 mb-3 mb-md-0">
          <div className="text-uppercase text-muted small fw-bold mb-2">Bill To</div>
          <div className="pos-inv-client-name mb-1">{billToDisplay.name}</div>
          {ps.show_customer_phone && billToDisplay.phone ? (
            <div className="small text-secondary">{billToDisplay.phone}</div>
          ) : null}
          {ps.show_customer_email && billToDisplay.email ? (
            <div className="small text-secondary">{billToDisplay.email}</div>
          ) : null}
        </div>
        <div className="col-md-6 text-md-end">
          {ps.show_invoice_date ? (
            <div className="small mb-2">
              <span className="text-muted me-2">Invoice Date:</span>
              <span className="fw-semibold">{data?.invoiceDate}</span>
            </div>
          ) : null}
          {ps.show_current_user && currentUserName ? (
            <div className="small mb-2">
              <span className="text-muted me-2">User:</span>
              <span className="fw-semibold">{currentUserName}</span>
            </div>
          ) : null}
          <div className="small">
            <span className="text-muted me-2">Terms:</span>
            <span className="fw-semibold">{data?.terms}</span>
          </div>
        </div>
      </div>

      {ps.show_gross_amount ? (
        <div className="row mb-3">
          <div className="col-12 text-md-end">
            <div className="pos-inv-gross">Gross Amount: {fmt(grossDisplay)}</div>
          </div>
        </div>
      ) : null}

      <div className="table-responsive mb-4">
        <table className="table table-bordered pos-inv-table mb-0">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>#</th>
              <th>Description</th>
              <th className="text-end" style={{ width: '120px' }}>
                Rate
              </th>
              <th className="text-end" style={{ width: '120px' }}>
                Qty
              </th>
              <th className="text-end" style={{ width: '120px' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="text-center">{i + 1}</td>
                <td>{line.description}</td>
                <td className="text-end">{fmt(line.rate)}</td>
                <td className="text-end">{line.qtyLabel}</td>
                <td className="text-end fw-semibold">{fmt(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row mb-4">
        <div className="col-md-6 mb-4 mb-md-0">
          {ps.show_payment_method ? (
            <div className="small mb-3">
              <span className="text-muted">Payment Method: </span>
              <span className="pos-inv-underline fw-semibold">{paymentMethod || data?.paymentMethod}</span>
            </div>
          ) : null}
          {data?.note ? (
            <>
              <label className="form-label small text-muted mb-1">Note</label>
              <div className="form-control form-control-sm bg-white" style={{ minHeight: '6rem' }}>
                {data.note}
              </div>
            </>
          ) : null}
        </div>
        <div className="col-md-6">
          <div className="text-uppercase text-muted small fw-bold mb-2">Summary</div>
          <div className="border rounded p-3 bg-light">
            <div className="pos-inv-summary-row">
              <span className="text-muted">Sub Total</span>
              <span className="fw-semibold">{fmt(summaryDisplay.subTotal)}</span>
            </div>
            <div className="pos-inv-summary-row">
              <span className="text-muted">Tax</span>
              <span>{fmt(summaryDisplay.tax)}</span>
            </div>
            {ps.show_discount ? (
              <div className="pos-inv-summary-row">
                <span className="text-muted">Discount</span>
                <span>{fmt(summaryDisplay.discount)}</span>
              </div>
            ) : null}
            {ps.show_shipping ? (
              <div className="pos-inv-summary-row">
                <span className="text-muted">Shipping</span>
                <span>{fmt(summaryDisplay.shipping)}</span>
              </div>
            ) : null}
            <div className="pos-inv-summary-row pos-inv-summary-total">
              <span>Total</span>
              <span>{fmt(summaryDisplay.total)}</span>
            </div>
            {ps.show_payment_made ? (
              <div className="pos-inv-summary-row pos-inv-payment-made">
                <span>Payment Made</span>
                <span>(-) {fmt(summaryDisplay.paymentMade)}</span>
              </div>
            ) : null}
            {ps.show_balance_due ? (
              <div className="pos-inv-summary-row fw-bold">
                <span>Balance Due</span>
                <span>{fmt(summaryDisplay.balanceDue)}</span>
              </div>
            ) : null}
            {ps.show_change_return && sourceOrder ? (
              <>
                {sourceOrder.amount_received != null && sourceOrder.amount_received !== '' ? (
                  <div className="pos-inv-summary-row">
                    <span className="text-muted">Amount received</span>
                    <span>{fmt(sourceOrder.amount_received)}</span>
                  </div>
                ) : null}
                {sourceOrder.change_given != null && sourceOrder.change_given !== '' ? (
                  <div className="pos-inv-summary-row">
                    <span className="text-muted">Change return</span>
                    <span>{fmt(sourceOrder.change_given)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-top pt-4">
        {showQrCode && ps.show_qrcode && data?.publicUrl ? (
          <div className="mb-4 d-flex flex-column align-items-center text-center">
            <InvoiceQrCode value={data.publicUrl} size={96} />
            <small className="text-muted mt-2">Scan invoice QR code</small>
          </div>
        ) : null}
        <div className="fw-semibold mb-2">Terms &amp; Condition</div>
        <ol className="small text-secondary ps-3 mb-4">
          {termsBody.map((t, i) => (
            <li key={i} className="mb-1">
              {t}
            </li>
          ))}
        </ol>
        {showPublicUrl && data?.publicUrl ? (
          <>
            <div className="mb-2 small text-muted">Public Access URL</div>
            <input
              type="text"
              className="form-control form-control-sm mb-4 font-monospace"
              readOnly
              value={data.publicUrl}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
