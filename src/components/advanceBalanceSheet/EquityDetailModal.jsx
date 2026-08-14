import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppModal from '../AppModal.jsx';
import {
  buildBalanceSheetProfitUrl,
  buildBalanceSheetSalesReturnProfitUrl,
  fetchBalanceSheetProfitRequest,
  fetchBalanceSheetSalesReturnProfitRequest,
} from '../../features/balanceSheet/balanceSheetAPI.js';
import {
  buildProfitVsGlGapUrl,
  fetchProfitVsGlGapRequest,
} from '../../features/profitVsGlGap/profitVsGlGapAPI.js';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';

const DETAIL_META = {
  profit: {
    title: 'Profit details',
    subtitle: 'Order line profit used in Owner’s equity',
    sourceUrl: buildBalanceSheetProfitUrl(),
  },
  profit_vs_gl_gap: {
    title: 'Profit vs GL gap details',
    subtitle: 'Line profit method vs GL bridged equity',
    sourceUrl: buildProfitVsGlGapUrl(),
  },
  sales_return_profit: {
    title: 'Sales return profit details',
    subtitle: 'Sales return line profit used in Owner’s equity',
    sourceUrl: buildBalanceSheetSalesReturnProfitUrl(),
  },
};

const ID_PREVIEW_LIMIT = 40;

function DetailRow({ label, value }) {
  return (
    <div className="d-flex justify-content-between gap-3 border-bottom border-light py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-monospace text-end">{value}</span>
    </div>
  );
}

function ProfitSummaryBody({ data, fmt }) {
  const ids = Array.isArray(data?.orderItemIds) ? data.orderItemIds : [];
  const preview = ids.slice(0, ID_PREVIEW_LIMIT);
  return (
    <div>
      <DetailRow label="Total profit" value={fmt(data?.profit)} />
      <DetailRow label="Line count" value={String(data?.lineCount ?? 0)} />
      <DetailRow label="Source" value="order/profit-by-order-item" />
      {preview.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-uppercase text-muted mb-2">
            Order item IDs (showing {preview.length}
            {ids.length > preview.length ? ` of ${ids.length}` : ''})
          </p>
          <div
            className="rounded border bg-light p-2 text-xs font-monospace"
            style={{ maxHeight: '14rem', overflow: 'auto' }}
          >
            {preview.map((id) => (
              <div key={id} className="mb-1">
                {id}
              </div>
            ))}
            {ids.length > preview.length ? (
              <div className="text-muted mt-2">…and {ids.length - preview.length} more</div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted mt-3 mb-0">No order item IDs returned by the API.</p>
      )}
    </div>
  );
}

function SalesReturnSummaryBody({ data, fmt }) {
  return (
    <div>
      <DetailRow label="Total profit" value={fmt(data?.profit)} />
      <DetailRow label="Line count" value={String(data?.lineCount ?? 0)} />
      <DetailRow label="Source" value="sales_return/profit-by-sales-return-item" />
    </div>
  );
}

function ProfitVsGlGapBody({ data, fmt }) {
  const gap = Number(data?.profit_vs_gl_gap) || 0;
  const aligned = Boolean(data?.profit_reconciliation_aligned);
  const lineMethod = data?.line_profit_method ?? {};
  const glMethod = data?.gl_bridged_method ?? {};
  const formula = data?.formula ?? {};
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const hints = Array.isArray(data?.hints) ? data.hints : [];

  return (
    <div>
      <DetailRow label="Profit vs GL gap" value={fmt(gap)} />
      <DetailRow
        label="Formula"
        value={formula.expression || 'gl_bridged_equity − line_profit_total'}
      />
      <DetailRow label="Reconciliation" value={aligned ? 'Aligned' : 'Not aligned'} />

      <h6 className="text-sm font-weight-bold mt-3 mb-2">Line profit method</h6>
      <DetailRow label="Profit from orders" value={fmt(lineMethod.profit_from_orders)} />
      <DetailRow
        label="Profit from sales returns"
        value={fmt(lineMethod.profit_from_sales_returns)}
      />
      <DetailRow label="Line profit total" value={fmt(lineMethod.line_profit_total)} />
      <DetailRow label="Order lines" value={String(lineMethod.order_line_count ?? '—')} />
      <DetailRow
        label="Sales return lines"
        value={String(lineMethod.sales_return_line_count ?? '—')}
      />

      <h6 className="text-sm font-weight-bold mt-3 mb-2">GL bridged method</h6>
      <DetailRow label="Sales revenue (GL)" value={fmt(glMethod.sales_revenue_gl_balance)} />
      <DetailRow
        label="Purchase COGS net debit"
        value={fmt(glMethod.purchase_account_net_debit)}
      />
      <DetailRow label="Inventory value used" value={fmt(glMethod.inventory_value_used)} />
      <DetailRow label="Implied COGS sold" value={fmt(glMethod.implied_cogs_sold)} />
      <DetailRow label="GL bridged equity" value={fmt(glMethod.gl_bridged_equity)} />

      {steps.length > 0 ? (
        <div className="mt-3">
          <h6 className="text-sm font-weight-bold mb-2">Reconciliation steps</h6>
          <div className="table-responsive" style={{ maxHeight: '12rem', overflow: 'auto' }}>
            <table className="table table-sm table-bordered mb-0 text-xs">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Label</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={step.key || step.label || i}>
                    <td>{step.step ?? i + 1}</td>
                    <td>{step.label || step.key || '—'}</td>
                    <td className="text-end font-monospace">
                      {step.amount != null ? fmt(step.amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {hints.length > 0 ? (
        <ul className="list-unstyled mb-0 mt-3 text-sm text-muted">
          {hints.map((hint, i) => (
            <li key={i} className="mb-1">
              • {typeof hint === 'string' ? hint : hint?.message || JSON.stringify(hint)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <Link to="/profit-vs-gl-gap" className="btn btn-sm btn-outline-primary mb-0">
          Open full Profit vs GL gap page
        </Link>
      </div>
    </div>
  );
}

/**
 * Detail popup for Owner’s equity calculated lines on the advance balance sheet.
 * @param {{ open: boolean; detailKey: string | null; onClose: () => void }} props
 */
export default function EquityDetailModal({ open, detailKey, onClose }) {
  const meta = detailKey ? DETAIL_META[detailKey] : null;
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const fmt = (n) => formatCurrencyAccounting(n);

  useEffect(() => {
    if (!open || !detailKey || !DETAIL_META[detailKey]) return undefined;

    let cancelled = false;
    setStatus('loading');
    setError(null);
    setPayload(null);

    const load = async () => {
      try {
        let next = null;
        if (detailKey === 'profit') {
          next = await fetchBalanceSheetProfitRequest();
        } else if (detailKey === 'sales_return_profit') {
          next = await fetchBalanceSheetSalesReturnProfitRequest();
        } else if (detailKey === 'profit_vs_gl_gap') {
          const result = await fetchProfitVsGlGapRequest();
          next = result.report;
        }
        if (!cancelled) {
          setPayload(next);
          setStatus('succeeded');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load details');
          setStatus('failed');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, detailKey]);

  if (!meta) return null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      size="lg"
      footer={
        <button type="button" className="btn btn-sm btn-secondary mb-0" onClick={onClose}>
          Close
        </button>
      }
    >
      {status === 'loading' ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary spinner-border-sm" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <p className="text-sm text-muted mt-2 mb-0">Loading details…</p>
        </div>
      ) : null}

      {status === 'failed' ? (
        <div className="alert alert-danger mb-0 text-sm" role="alert">
          {error || 'Failed to load details'}
        </div>
      ) : null}

      {status === 'succeeded' && payload ? (
        <>
          {detailKey === 'profit' ? <ProfitSummaryBody data={payload} fmt={fmt} /> : null}
          {detailKey === 'sales_return_profit' ? (
            <SalesReturnSummaryBody data={payload} fmt={fmt} />
          ) : null}
          {detailKey === 'profit_vs_gl_gap' ? (
            <ProfitVsGlGapBody data={payload} fmt={fmt} />
          ) : null}
          <p className="text-xs text-muted mt-3 mb-0">API: GET {meta.sourceUrl}</p>
        </>
      ) : null}
    </AppModal>
  );
}
