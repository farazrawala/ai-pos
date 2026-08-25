import { useMemo } from 'react';
import { DOCUMENT_TITLES, PRODUCT_COLUMNS, getPaperDimensions } from '../../features/printLayout/printLayoutDefaults.js';
import { usePrintLayout } from '../../features/printLayout/PrintLayoutContext.jsx';

const fmt = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const COLUMN_META = Object.fromEntries(PRODUCT_COLUMNS.map((c) => [c.id, c]));

function alignClass(align) {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-end';
  return 'text-start';
}

function PreviewLogo({ settings, company }) {
  const { logo, header } = settings;
  if (!header.showLogo) return null;

  const logoEl = logo.dataUrl ? (
    <img
      src={logo.dataUrl}
      alt="Company logo"
      style={{
        width: logo.width,
        height: logo.height,
        objectFit: 'contain',
      }}
    />
  ) : (
    <div
      className="pl-preview-logo-placeholder"
      style={{ width: logo.width, height: logo.height }}
    >
      LOGO
    </div>
  );

  return (
    <div className={`pl-preview-logo pl-preview-logo--${logo.position}`}>{logoEl}</div>
  );
}

function CompanyHeaderSection({ settings, company, design, page }) {
  const { header } = settings;
  const align = alignClass(header.alignment);

  return (
    <div className={`pl-preview-section pl-preview-header ${align}`} style={{ marginBottom: page.headerSpacing }}>
      <PreviewLogo settings={settings} company={company} />
      <div className={`pl-preview-header__info ${align}`}>
        {header.showCompanyName ? (
          <>
            <div
              className="pl-preview-tagline"
              style={{ color: design.secondaryColor, fontSize: page.baseFontSize - 1 }}
            >
              {company.tagline}
            </div>
            <div
              className="pl-preview-company-name"
              style={{
                fontSize: page.headingFontSize,
                fontWeight: design.boldHeadings ? 700 : 600,
                color: design.primaryColor,
              }}
            >
              {company.name}
            </div>
            {company.legalName && company.legalName !== company.name ? (
              <div className="pl-preview-legal" style={{ fontSize: page.baseFontSize - 1 }}>
                {company.legalName}
              </div>
            ) : null}
          </>
        ) : null}
        {header.showAddress ? (
          <div className="pl-preview-meta">
            {company.address}
            {company.city || company.country
              ? `, ${[company.city, company.country].filter(Boolean).join(', ')}`
              : ''}
          </div>
        ) : null}
        {header.showPhone ? <div className="pl-preview-meta">Tel: {company.phone}</div> : null}
        {header.showEmail ? <div className="pl-preview-meta">{company.email}</div> : null}
        {header.showWebsite ? <div className="pl-preview-meta">{company.website}</div> : null}
        {header.showTaxNumber ? (
          <div className="pl-preview-meta">
            Tax/VAT: {company.taxNumber} | NTN: {company.ntn}
            {company.strn ? ` | STRN: ${company.strn}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InvoiceInfoSection({ settings, invoice, user, posData, design, page }) {
  const { header, userInfo } = settings;
  const docTitle = DOCUMENT_TITLES[settings.documentType] || 'INVOICE';

  return (
    <div
      className="pl-preview-section pl-preview-invoice-info"
      style={{ marginBottom: page.sectionSpacing }}
    >
      <div className="pl-preview-invoice-info__grid">
        <div>
          {header.showInvoiceTitle ? (
            <div
              className="pl-preview-doc-title"
              style={{
                fontSize: page.headingFontSize - 2,
                fontWeight: design.boldHeadings ? 700 : 600,
                color: design.primaryColor,
                textTransform: design.uppercaseInvoiceTitle ? 'uppercase' : 'none',
              }}
            >
              {docTitle}
            </div>
          ) : null}
          {userInfo.showSalesperson || userInfo.showCashier ? (
            <div className="pl-preview-meta mt-1">
              {userInfo.showSalesperson ? `Salesperson: ${invoice.salesperson}` : null}
              {userInfo.showCashier && userInfo.showSalesperson ? ' · ' : null}
              {userInfo.showCashier ? `Served By: ${user.name}` : null}
            </div>
          ) : null}
          {userInfo.showBranch ? (
            <div className="pl-preview-meta">Branch: {user.branch}</div>
          ) : null}
          {userInfo.showWarehouse ? (
            <div className="pl-preview-meta">Warehouse: {user.warehouse}</div>
          ) : null}
        </div>
        <div className="text-end">
          {header.showInvoiceNumber ? (
            <div>
              <span className="pl-preview-label">Invoice #</span> {invoice.number}
            </div>
          ) : null}
          {header.showInvoiceDate ? (
            <div>
              <span className="pl-preview-label">Date</span> {invoice.date}
            </div>
          ) : null}
          {header.showDueDate ? (
            <div>
              <span className="pl-preview-label">Due Date</span> {invoice.dueDate}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CustomerInfoSection({ settings, customer, page }) {
  const { customerDisplay: cs } = settings;
  if (
    !cs.showName &&
    !cs.showPhone &&
    !cs.showEmail &&
    !cs.showAddress &&
    !cs.showTaxNumber &&
    !cs.showCustomerId
  ) {
    return null;
  }

  const isTwoCol = cs.layout === 'two-column';

  return (
    <div
      className={`pl-preview-section pl-preview-customer ${isTwoCol ? 'pl-preview-customer--two-col' : ''}`}
      style={{ marginBottom: page.sectionSpacing }}
    >
      <div className="pl-preview-block-title">Bill To</div>
      {cs.showName ? <div className="fw-semibold">{customer.name}</div> : null}
      {cs.showPhone ? <div className="pl-preview-meta">{customer.phone}</div> : null}
      {cs.showEmail ? <div className="pl-preview-meta">{customer.email}</div> : null}
      {cs.showAddress ? <div className="pl-preview-meta">{customer.address}</div> : null}
      {cs.showTaxNumber ? (
        <div className="pl-preview-meta">Tax #: {customer.taxNumber}</div>
      ) : null}
      {cs.showCustomerId ? (
        <div className="pl-preview-meta">Customer ID: {customer.customerId}</div>
      ) : null}
    </div>
  );
}

function ProductsSection({ settings, products, design, page }) {
  const { products: ps } = settings;
  const visibleCols = ps.columnOrder.filter((id) => ps.columnVisibility[id]);

  const colAlign = {
    index: ps.quantityAlignment,
    product: ps.productAlignment,
    sku: ps.productAlignment,
    barcode: ps.productAlignment,
    description: ps.productAlignment,
    qty: ps.quantityAlignment,
    unit: ps.quantityAlignment,
    unitPrice: ps.priceAlignment,
    discount: ps.priceAlignment,
    tax: ps.priceAlignment,
    total: ps.totalAlignment,
  };

  const borderStyle = ps.showBorders
    ? `${design.borderWidth}px ${ps.borderStyle} ${design.borderColor}`
    : 'none';

  return (
    <div className="pl-preview-section" style={{ marginBottom: page.sectionSpacing }}>
      <table
        className="pl-preview-table"
        style={{
          fontSize: ps.tableFontSize,
          border: borderStyle,
        }}
      >
        <thead>
          <tr
            style={{
              background: design.tableHeaderBg,
              color: design.tableHeaderText,
              fontSize: ps.headerFontSize,
            }}
          >
            {visibleCols.map((colId) => (
              <th
                key={colId}
                className={alignClass(colAlign[colId])}
                style={{ borderBottom: borderStyle, padding: `${ps.rowSpacing}px 6px` }}
              >
                {COLUMN_META[colId]?.label || colId}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((row) => (
            <tr key={row.index}>
              {visibleCols.map((colId) => (
                <td
                  key={colId}
                  className={alignClass(colAlign[colId])}
                  style={{
                    borderBottom: ps.showBorders ? `1px ${ps.borderStyle} ${design.borderColor}` : 'none',
                    padding: `${ps.rowSpacing}px 6px`,
                  }}
                >
                  {colId === 'unitPrice' ||
                  colId === 'discount' ||
                  colId === 'tax' ||
                  colId === 'total'
                    ? fmt(row[colId])
                    : row[colId]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalsSection({ settings, summary, invoice, design, page }) {
  const { totals: ts } = settings;
  const rows = [
    { key: 'showSubtotal', label: 'Subtotal', value: summary.subtotal },
    { key: 'showDiscount', label: 'Discount', value: -summary.discount },
    { key: 'showTax', label: 'Tax', value: summary.tax },
    { key: 'showShipping', label: 'Shipping', value: summary.shipping },
    { key: 'showOtherCharges', label: 'Other Charges', value: summary.otherCharges },
  ].filter((r) => ts[r.key]);

  return (
    <div
      className={`pl-preview-section pl-preview-totals ${alignClass(ts.grandTotalAlignment)}`}
      style={{ marginBottom: page.sectionSpacing }}
    >
      <div className="pl-preview-totals__box">
        {rows.map((r) => (
          <div key={r.key} className="pl-preview-totals__row">
            <span>{r.label}</span>
            <span>{fmt(Math.abs(r.value))}</span>
          </div>
        ))}
        {ts.showGrandTotal ? (
          <div
            className={`pl-preview-totals__grand ${ts.grandTotalHighlight ? 'is-highlighted' : ''}`}
            style={{
              fontSize: ts.grandTotalFontSize,
              fontWeight: ts.grandTotalBold ? 700 : 600,
              borderTop: ts.grandTotalBorder ? `2px solid ${design.primaryColor}` : 'none',
              color: design.primaryColor,
            }}
          >
            <span>Grand Total</span>
            <span>PKR {fmt(summary.grandTotal)}</span>
          </div>
        ) : null}
        {ts.showPaidAmount ? (
          <div className="pl-preview-totals__row">
            <span>Amount Paid</span>
            <span>PKR {fmt(summary.amountPaid)}</span>
          </div>
        ) : null}
        {ts.showBalance ? (
          <div className="pl-preview-totals__row fw-semibold">
            <span>Balance Due</span>
            <span>PKR {fmt(summary.balanceDue)}</span>
          </div>
        ) : null}
        {ts.showPaymentMethod ? (
          <div className="pl-preview-totals__row">
            <span>Payment Method</span>
            <span>{invoice.paymentMethod}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PaymentSection({ settings, invoice, page }) {
  const { payment: pm } = settings;
  const hasAny =
    pm.showPaymentMethod ||
    pm.showPaymentReference ||
    pm.showTransactionId ||
    pm.showBankDetails ||
    pm.showCashDetails ||
    pm.showCardDetails;
  if (!hasAny) return null;

  return (
    <div className="pl-preview-section pl-preview-payment" style={{ marginBottom: page.sectionSpacing }}>
      <div className="pl-preview-block-title">Payment Details</div>
      {pm.showPaymentMethod ? (
        <div className="pl-preview-meta">Method: {invoice.paymentMethod}</div>
      ) : null}
      {pm.showPaymentReference ? (
        <div className="pl-preview-meta">Reference: {invoice.paymentReference}</div>
      ) : null}
      {pm.showTransactionId ? (
        <div className="pl-preview-meta">Transaction ID: {invoice.transactionId}</div>
      ) : null}
      {pm.showBankDetails ? (
        <pre className="pl-preview-pre">{pm.bankDetails}</pre>
      ) : null}
      {pm.showCashDetails ? (
        <div className="pl-preview-meta">{pm.cashDetails}</div>
      ) : null}
      {pm.showCardDetails ? (
        <div className="pl-preview-meta">{pm.cardDetails}</div>
      ) : null}
    </div>
  );
}

function NotesSection({ settings, notes, page }) {
  const blocks = [
    { label: 'Notes', text: notes.invoiceNotes },
    { label: 'Customer Notes', text: notes.customerNotes },
    { label: 'Payment Terms', text: notes.paymentTerms },
    { label: 'Return Policy', text: notes.returnPolicy },
    { label: 'Warranty', text: notes.warrantyInformation },
  ].filter((b) => b.text);

  if (!blocks.length) return null;

  return (
    <div className="pl-preview-section pl-preview-notes" style={{ marginBottom: page.sectionSpacing }}>
      {blocks.map((b) => (
        <div key={b.label} className="mb-2">
          <div className="pl-preview-block-title">{b.label}</div>
          <div className="pl-preview-meta">{b.text}</div>
        </div>
      ))}
    </div>
  );
}

function SignatureSection({ settings, page }) {
  const { signature: sig } = settings;
  if (!sig.showAuthorized && !sig.showCustomer) return null;

  return (
    <div
      className={`pl-preview-section pl-preview-signature pl-preview-signature--${sig.position}`}
      style={{ marginBottom: page.sectionSpacing }}
    >
      {sig.showAuthorized ? (
        <div className="pl-preview-signature__block">
          <div className="pl-preview-signature__line" />
          <div className="pl-preview-meta">{sig.authorizedLabel}</div>
        </div>
      ) : null}
      {sig.showCustomer ? (
        <div className="pl-preview-signature__block">
          <div className="pl-preview-signature__line" />
          <div className="pl-preview-meta">{sig.customerLabel}</div>
        </div>
      ) : null}
    </div>
  );
}

function FooterSection({ settings, company, notes, design, page }) {
  const { footer: ft, qrBarcode: qr } = settings;
  if (!ft.showFooter && !qr.showQrCode && !qr.showBarcode) return null;

  return (
    <div
      className="pl-preview-section pl-preview-footer"
      style={{ marginTop: page.footerSpacing, borderTop: `1px ${design.dividerStyle} ${design.borderColor}` }}
    >
      <div className={`pl-preview-footer__inner pl-preview-footer__inner--${qr.position}`}>
        <div>
          {ft.showFooter && ft.footerText ? (
            <div className="pl-preview-footer__message">{ft.footerText || notes.footerMessage}</div>
          ) : null}
          {ft.showCompanyName ? <div className="pl-preview-meta">{company.name}</div> : null}
          {ft.showPhone ? <div className="pl-preview-meta">{company.phone}</div> : null}
          {ft.showEmail ? <div className="pl-preview-meta">{company.email}</div> : null}
          {ft.showWebsite ? <div className="pl-preview-meta">{company.website}</div> : null}
          {ft.showPageNumber ? <div className="pl-preview-meta mt-1">Page 1 of 1</div> : null}
        </div>
        {(qr.showQrCode || qr.showBarcode) && (
          <div className="pl-preview-codes">
            {qr.showQrCode ? (
              <div
                className="pl-preview-qr"
                style={{ width: qr.qrSize, height: qr.qrSize }}
                title={qr.showInvoiceQr ? 'Invoice QR' : 'QR Code'}
              >
                QR
              </div>
            ) : null}
            {qr.showBarcode ? (
              <div className="pl-preview-barcode" title={qr.barcodeType}>
                ||| {qr.barcodeType.toUpperCase()} |||
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

const SECTION_RENDERERS = {
  companyHeader: CompanyHeaderSection,
  invoiceInfo: InvoiceInfoSection,
  customerInfo: CustomerInfoSection,
  products: ProductsSection,
  totals: TotalsSection,
  payment: PaymentSection,
  notes: NotesSection,
  signature: SignatureSection,
  footer: FooterSection,
};

export default function A4Preview() {
  const { settings, posData } = usePrintLayout();
  const { page, design, sectionOrder } = settings;

  const company = useMemo(
    () => ({ ...posData.company, ...settings.company }),
    [posData.company, settings.company]
  );

  const paperStyle = useMemo(() => {
    const dims = getPaperDimensions(page);
    return {
      fontFamily: page.fontFamily,
      fontSize: page.baseFontSize,
      color: design.textColor,
      width: dims.width,
      minHeight: dims.height,
      padding: `${page.margins.top}px ${page.margins.right}px ${page.margins.bottom}px ${page.margins.left}px`,
      '--pl-primary': design.primaryColor,
      '--pl-border-radius': `${design.borderRadius}px`,
    };
  }, [page, design]);

  const sectionProps = {
    settings,
    company,
    invoice: { ...posData.invoice, ...settings.invoice },
    user: { ...posData.user, ...settings.user },
    customer: { ...posData.customer, ...settings.customer },
    products: posData.products,
    summary: posData.summary,
    notes: { ...posData.notes, ...settings.notes },
    design,
    page,
    posData,
  };

  return (
    <div className="pl-preview-workspace">
      <div className="pl-preview-paper" style={paperStyle}>
        {sectionOrder.map((sectionId) => {
          const Renderer = SECTION_RENDERERS[sectionId];
          if (!Renderer) return null;
          return <Renderer key={sectionId} {...sectionProps} />;
        })}
      </div>
    </div>
  );
}
