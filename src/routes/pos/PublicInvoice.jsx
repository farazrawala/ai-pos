import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicInvoiceRequest } from '../../features/orders/ordersAPI.js';
import {
  mapOrderToInvoiceView,
  resolvePaymentMethodLabel,
  shopName,
} from '../../features/orders/invoiceViewMapper.js';
import {
  extractPrinterSettingsFromCompanyBody,
  mergePrinterSettings,
  pickCompanyLogoUrl,
  resolveBillCurrentUserName,
} from '../../features/company/companyAPI.js';
import { buildPublicInvoiceUrl } from '../../utils/publicInvoiceUrl.js';
import PublicInvoiceView from '../../components/invoice/PublicInvoiceView.jsx';
import { openNormalInvoicePrint } from '../../components/NormalInvoicePrint/index.js';

const PUBLIC_INVOICE_STYLES = `
  .pub-inv-page {
    --pub-accent: #5e72e4;
    --pub-accent-2: #11cdef;
    --pub-ink: #1e293b;
    --pub-muted: #64748b;
    --pub-border: #e2e8f0;
    --pub-surface: #ffffff;
    min-height: 100vh;
    font-family: 'Segoe UI', 'Open Sans', system-ui, sans-serif;
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(94, 114, 228, 0.18), transparent),
      linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%);
    color: var(--pub-ink);
    padding: 1.5rem 1rem 2.5rem;
  }

  .pub-inv-shell {
    max-width: 920px;
    margin: 0 auto;
  }

  .pub-inv-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .pub-inv-topbar-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--pub-muted);
    margin-bottom: 0.15rem;
  }

  .pub-inv-topbar-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--pub-ink);
    margin: 0;
  }

  .pub-inv-print-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1.15rem;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--pub-accent) 0%, #4c63d2 100%);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(94, 114, 228, 0.35);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .pub-inv-print-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(94, 114, 228, 0.45);
    color: #fff;
  }

  .pub-inv-card {
    background: var(--pub-surface);
    border-radius: 1.25rem;
    box-shadow:
      0 4px 6px -1px rgba(15, 23, 42, 0.06),
      0 20px 40px -12px rgba(15, 23, 42, 0.12);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.8);
  }

  .pub-inv-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1.75rem 1.75rem 1.5rem;
    background: linear-gradient(135deg, var(--pub-accent) 0%, #4c63d2 55%, #3b52c4 100%);
    color: #fff;
    flex-wrap: wrap;
  }

  .pub-inv-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 0;
    flex: 1;
  }

  .pub-inv-logo {
    width: 72px;
    height: 72px;
    border-radius: 0.75rem;
    object-fit: contain;
    background: #fff;
    padding: 0.35rem;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .pub-inv-logo-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--pub-accent);
  }

  .pub-inv-company-name {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0 0 0.35rem;
    line-height: 1.25;
    color: #fff;
  }

  .pub-inv-company-meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.8rem;
    opacity: 0.92;
    line-height: 1.4;
  }

  .pub-inv-head-right {
    text-align: right;
    flex-shrink: 0;
  }

  .pub-inv-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.85;
    margin-bottom: 0.35rem;
  }

  .pub-inv-order-no {
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 0.5rem;
  }

  .pub-inv-order-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
    margin-bottom: 0.1rem;
  }

  .pub-inv-status {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.35);
  }

  .pub-inv-status-paid {
    background: rgba(45, 206, 137, 0.25);
    border-color: rgba(45, 206, 137, 0.5);
  }

  .pub-inv-body {
    padding: 1.75rem;
  }

  .pub-inv-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }

  @media (max-width: 640px) {
    .pub-inv-meta-grid {
      grid-template-columns: 1fr;
    }
    .pub-inv-meta-block-end {
      text-align: left !important;
    }
  }

  .pub-inv-meta-block {
    background: #f8fafc;
    border: 1px solid var(--pub-border);
    border-radius: 0.85rem;
    padding: 1rem 1.15rem;
  }

  .pub-inv-meta-block-end {
    text-align: right;
  }

  .pub-inv-section-label {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--pub-muted);
    margin: 0 0 0.5rem;
  }

  .pub-inv-customer-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--pub-accent-2);
    margin: 0 0 0.35rem;
  }

  .pub-inv-meta-line {
    margin: 0;
    font-size: 0.875rem;
    color: var(--pub-muted);
  }

  .pub-inv-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    padding: 0.3rem 0;
  }

  .pub-inv-meta-row span:first-child {
    color: var(--pub-muted);
  }

  .pub-inv-pay-pill {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: rgba(17, 205, 239, 0.12);
    color: #0ea5c9;
    font-size: 0.8rem;
  }

  .pub-inv-gross-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 1.15rem;
    margin-bottom: 1.25rem;
    border-radius: 0.75rem;
    background: linear-gradient(90deg, rgba(94, 114, 228, 0.08) 0%, rgba(17, 205, 239, 0.08) 100%);
    border: 1px solid rgba(94, 114, 228, 0.15);
    font-size: 0.95rem;
  }

  .pub-inv-gross-banner strong {
    font-size: 1.15rem;
    color: var(--pub-accent);
  }

  .pub-inv-table-wrap {
    border-radius: 0.85rem;
    overflow: hidden;
    border: 1px solid var(--pub-border);
    margin-bottom: 1.5rem;
  }

  .pub-inv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .pub-inv-table thead {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .pub-inv-table th {
    padding: 0.75rem 1rem;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pub-muted);
    border-bottom: 1px solid var(--pub-border);
  }

  .pub-inv-table td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .pub-inv-table tbody tr:last-child td {
    border-bottom: none;
  }

  .pub-inv-table tbody tr:hover {
    background: #fafbfc;
  }

  .pub-inv-line-num {
    color: var(--pub-muted);
    font-weight: 600;
    width: 2.5rem;
    text-align: center;
  }

  .pub-inv-line-desc {
    font-weight: 600;
    color: var(--pub-ink);
  }

  .pub-inv-line-amt {
    font-weight: 700;
    color: var(--pub-accent);
  }

  .pub-inv-bottom {
    display: grid;
    grid-template-columns: 1fr min(320px, 100%);
    gap: 1.5rem;
    align-items: start;
  }

  @media (max-width: 768px) {
    .pub-inv-bottom {
      grid-template-columns: 1fr;
    }
  }

  .pub-inv-note {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 0.75rem;
    padding: 1rem 1.15rem;
  }

  .pub-inv-note p {
    margin: 0;
    font-size: 0.875rem;
    color: #78350f;
    line-height: 1.5;
  }

  .pub-inv-summary-box {
    background: #f8fafc;
    border: 1px solid var(--pub-border);
    border-radius: 0.85rem;
    padding: 1rem 1.15rem;
  }

  .pub-inv-sum-row {
    display: flex;
    justify-content: space-between;
    padding: 0.35rem 0;
    font-size: 0.875rem;
    color: var(--pub-muted);
  }

  .pub-inv-sum-row span:last-child {
    color: var(--pub-ink);
    font-weight: 600;
  }

  .pub-inv-sum-total {
    margin-top: 0.5rem;
    padding-top: 0.65rem;
    border-top: 2px solid var(--pub-border);
    font-size: 1rem;
    font-weight: 700;
  }

  .pub-inv-sum-total span {
    color: var(--pub-ink) !important;
    font-weight: 800 !important;
  }

  .pub-inv-sum-total span:last-child {
    color: var(--pub-accent) !important;
    font-size: 1.15rem;
  }

  .pub-inv-sum-paid span:last-child {
    color: #dc3545 !important;
  }

  .pub-inv-sum-due span:last-child {
    font-weight: 800 !important;
  }

  .pub-inv-footer {
    margin-top: 1.75rem;
    padding-top: 1.5rem;
    border-top: 1px dashed var(--pub-border);
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    align-items: flex-start;
    justify-content: space-between;
  }

  .pub-inv-qr {
    text-align: center;
  }

  .pub-inv-qr-img {
    border-radius: 0.65rem !important;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  }

  .pub-inv-qr p {
    margin: 0.65rem 0 0;
    font-size: 0.75rem;
    color: var(--pub-muted);
  }

  .pub-inv-terms ol {
    margin: 0;
    padding-left: 1.15rem;
    font-size: 0.8rem;
    color: var(--pub-muted);
    line-height: 1.6;
  }

  .pub-inv-terms li {
    margin-bottom: 0.35rem;
  }

  .pub-inv-page-foot {
    text-align: center;
    margin-top: 1.5rem;
    font-size: 0.75rem;
    color: var(--pub-muted);
  }

  .pub-inv-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }

  .pub-inv-loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(94, 114, 228, 0.2);
    border-top-color: var(--pub-accent);
    border-radius: 50%;
    animation: pub-inv-spin 0.8s linear infinite;
  }

  @keyframes pub-inv-spin {
    to { transform: rotate(360deg); }
  }

  .pub-inv-error {
    max-width: 480px;
    margin: 4rem auto;
    padding: 1.25rem 1.5rem;
    border-radius: 0.85rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    text-align: center;
  }

  @media print {
    .pub-inv-no-print { display: none !important; }
    .pub-inv-page {
      background: #fff;
      padding: 0;
    }
    .pub-inv-card {
      box-shadow: none;
      border: none;
    }
    .pub-inv-print-btn { display: none; }
  }
`;

export default function PublicInvoice() {
  const { token: tokenParam } = useParams();
  const token = tokenParam ? decodeURIComponent(tokenParam) : '';
  const [fetchStatus, setFetchStatus] = useState('loading');
  const [fetchError, setFetchError] = useState('');
  const [order, setOrder] = useState(null);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    if (!token) {
      setFetchStatus('failed');
      setFetchError('Invalid invoice link.');
      return undefined;
    }

    let cancelled = false;
    setFetchStatus('loading');
    setFetchError('');

    (async () => {
      try {
        const result = await fetchPublicInvoiceRequest(token);
        if (cancelled) return;
        setOrder(result.order);
        setCompany(result.company);
        setFetchStatus('succeeded');
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setCompany(null);
          setFetchError(e?.message || 'Could not load this invoice.');
          setFetchStatus('failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const view = useMemo(() => {
    if (!order) return null;
    const mapped = mapOrderToInvoiceView(order, {
      origin: window.location.origin,
      company,
    });
    return {
      ...mapped,
      publicUrl: buildPublicInvoiceUrl(token, window.location.origin),
    };
  }, [order, token, company]);

  const printerSettings = useMemo(() => {
    const parsed = extractPrinterSettingsFromCompanyBody({ data: company });
    return mergePrinterSettings(parsed);
  }, [company]);

  const companyBrand = useMemo(() => {
    const name = company?.company_name || company?.name || shopName;
    return {
      name: String(name || shopName).trim() || shopName,
      phone: String(company?.company_phone || company?.phone || '').trim(),
      email: String(company?.company_email || company?.email || '').trim(),
      address: String(company?.company_address || company?.address || '').trim(),
      logoUrl: pickCompanyLogoUrl(company),
    };
  }, [company]);

  const paymentMethodDisplay = useMemo(
    () => resolvePaymentMethodLabel(order, [], '', company),
    [order, company]
  );

  const billCurrentUserName = useMemo(
    () => resolveBillCurrentUserName(null, order),
    [order]
  );

  const handlePrint = () => {
    if (!view) return;
    openNormalInvoicePrint(
      {
        printerSettings,
        companyBrand,
        invoiceNo: view.invoiceNo,
        invoiceDate: view.invoiceDate,
        terms: view.terms,
        note: view.note,
        termsBody: view.termsBody,
        publicUrl: view.publicUrl,
        billTo: view.billTo,
        lines: view.lines,
        currentUserName: billCurrentUserName,
        summary: view.summary,
        grossAmount: view.grossAmount,
        paymentMethod: paymentMethodDisplay,
        amountReceived: order?.amount_received,
        changeGiven: order?.change_given,
      },
      { documentTitlePrefix: 'Invoice POS' }
    );
  };

  if (fetchStatus === 'loading') {
    return (
      <div className="pub-inv-page">
        <style>{PUBLIC_INVOICE_STYLES}</style>
        <div className="pub-inv-loading">
          <div className="pub-inv-loading-spinner" role="status" aria-label="Loading" />
          <p className="text-muted mb-0">Loading your invoice…</p>
        </div>
      </div>
    );
  }

  if (fetchStatus === 'failed' || !view) {
    return (
      <div className="pub-inv-page">
        <style>{PUBLIC_INVOICE_STYLES}</style>
        <div className="pub-inv-error" role="alert">
          {fetchError || 'This invoice is unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="pub-inv-page">
      <style>{PUBLIC_INVOICE_STYLES}</style>
      <div className="pub-inv-shell">
        <div className="pub-inv-topbar pub-inv-no-print">
          <div>
            <div className="pub-inv-topbar-label">Digital receipt</div>
            <p className="pub-inv-topbar-title">{companyBrand.name}</p>
          </div>
          <button type="button" className="pub-inv-print-btn" onClick={handlePrint}>
            <i className="fas fa-print" aria-hidden="true" />
            Print invoice
          </button>
        </div>

        <PublicInvoiceView
          data={view}
          printerSettings={printerSettings}
          companyBrand={companyBrand}
          billTo={view.billTo}
          summary={view.summary}
          grossAmount={view.grossAmount}
          paymentMethod={paymentMethodDisplay}
          sourceOrder={order}
          currentUserName={billCurrentUserName}
          showQrCode
        />

        <p className="pub-inv-page-foot pub-inv-no-print">
          Thank you for your business
        </p>
      </div>
    </div>
  );
}
