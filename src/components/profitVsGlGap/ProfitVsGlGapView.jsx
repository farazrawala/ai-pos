import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfitVsGlGap } from '../../features/profitVsGlGap/profitVsGlGapSlice.js';
import { buildProfitVsGlGapUrl } from '../../features/profitVsGlGap/profitVsGlGapAPI.js';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import NavIcon from '../NavIcon.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import '../common/devApiSources.css';
import { FaArrowsRotate, FaChartLine, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';

function formatAsOf(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function fmtAmount(n, fmt) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return fmt(x);
}

function MethodCard({ title, description, children }) {
  return (
    <div className="card h-100">
      <div className="card-header pb-2 pt-3">
        <h6 className="mb-1">{title}</h6>
        {description ? <p className="text-xs text-muted mb-0">{description}</p> : null}
      </div>
      <div className="card-body pt-2">{children}</div>
    </div>
  );
}

function KeyValueRow({ label, value, mono = true }) {
  return (
    <div className="d-flex justify-content-between gap-3 border-bottom border-light py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'font-monospace text-end' : 'text-end'}>{value}</span>
    </div>
  );
}

function StepDetailBlock({ step, fmt }) {
  if (Array.isArray(step.accounts) && step.accounts.length > 0) {
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="table table-sm table-bordered mb-0 text-xs">
          <thead>
            <tr>
              <th>Account</th>
              <th className="text-end">Signed balance</th>
              <th className="text-end">Lines</th>
            </tr>
          </thead>
          <tbody>
            {step.accounts.map((acc) => (
              <tr key={acc.account_id || acc.name}>
                <td>{acc.name}</td>
                <td className="text-end font-monospace">{fmt(acc.signed_balance)}</td>
                <td className="text-end">{acc.transactions_sum?.line_count ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (Array.isArray(step.lines) && step.lines.length > 0) {
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="table table-sm table-bordered mb-0 text-xs">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-end">Qty</th>
              <th className="text-end">Wholesale</th>
              <th className="text-end">Value</th>
            </tr>
          </thead>
          <tbody>
            {step.lines.map((line) => (
              <tr key={line.product_id || line.product_name}>
                <td>{line.product_name}</td>
                <td className="text-end">{line.total_qty}</td>
                <td className="text-end font-monospace">{fmt(line.wholesale_price)}</td>
                <td className="text-end font-monospace">{fmt(line.inventory_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (step.inputs && typeof step.inputs === 'object') {
    return (
      <div className="mt-2 rounded border bg-light p-2 text-xs">
        {Object.entries(step.inputs).map(([key, val]) => (
          <div key={key} className="d-flex justify-content-between gap-2">
            <span className="text-muted">{key}</span>
            <span className="font-monospace">{fmt(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function ProfitVsGlGapView() {
  useRequireModuleAccess('profit-vs-gl-gap');
  const dispatch = useDispatch();
  const { status, error, report } = useSelector((state) => state.profitVsGlGap);
  const fmt = useCallback((n) => formatCurrencyAccounting(n), []);

  useEffect(() => {
    dispatch(fetchProfitVsGlGap());
  }, [dispatch]);

  const loading = status === 'loading';
  const showData = status === 'succeeded' && report != null;
  const aligned = Boolean(report?.profit_reconciliation_aligned);
  const gap = Number(report?.profit_vs_gl_gap) || 0;

  const lineMethod = report?.line_profit_method ?? {};
  const glMethod = report?.gl_bridged_method ?? {};
  const formula = report?.formula ?? {};

  const apiSources = useMemo(
    () => [{ label: 'Profit vs GL gap', url: `GET ${buildProfitVsGlGapUrl()}` }],
    []
  );

  return (
    <div className="container-fluid py-3">
      <div className="row">
        <div className="col-12">
          <div className="card mb-3">
            <div className="card-header pb-3 pt-3">
              <div className="row align-items-lg-center w-100 g-3">
                <div className="col-lg-8">
                  <h5 className="mb-1">Profit vs GL gap</h5>
                  <p className="text-sm text-muted mb-1">
                    As of {formatAsOf(report?.as_of)}
                  </p>
                  <p className="text-sm text-muted mb-0">
                    Compares line-level order profit (method A) with GL-bridged equity (method B).
                  </p>
                </div>
                <div className="col-lg-4">
                  <div className="d-flex justify-content-lg-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mb-0"
                      onClick={() => dispatch(fetchProfitVsGlGap())}
                      disabled={loading}
                    >
                      <NavIcon icon={FaArrowsRotate} className="me-1" size={14} />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="row">
          <div className="col-12 text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
            <p className="text-sm text-muted mt-3 mb-0">Loading profit vs GL gap…</p>
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="row">
          <div className="col-12">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          </div>
        </div>
      ) : null}

      {showData ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="card h-100 bg-gradient-dark">
                <div className="card-body text-white">
                  <p className="text-xs text-uppercase opacity-8 mb-1">Profit vs GL gap</p>
                  <h4 className="font-weight-bolder mb-0">{fmt(gap)}</h4>
                  <p className="text-xs opacity-8 mb-0 mt-2">
                    {formula.expression || 'gl_bridged_equity − line_profit_total'}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <p className="text-xs text-uppercase text-muted mb-1">Method A — line profit</p>
                  <h5 className="mb-0">{fmt(lineMethod.line_profit_total)}</h5>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <p className="text-xs text-uppercase text-muted mb-1">Method B — GL bridged</p>
                  <h5 className="mb-0">{fmt(glMethod.gl_bridged_equity)}</h5>
                </div>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-12">
              <div
                className={`alert mb-0 d-flex align-items-center gap-2 ${
                  aligned ? 'alert-success' : 'alert-warning'
                }`}
                role="status"
              >
                <NavIcon icon={aligned ? FaCircleCheck : FaTriangleExclamation} size={18} />
                <span>
                  {aligned
                    ? 'Profit reconciliation aligned — gap is within tolerance.'
                    : 'Profit reconciliation not aligned — review steps and hints below.'}
                </span>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <MethodCard
                title="Line profit method (A)"
                description={lineMethod.description}
              >
                <KeyValueRow label="Profit from orders" value={fmt(lineMethod.profit_from_orders)} />
                <KeyValueRow
                  label="Profit from sales returns"
                  value={fmt(lineMethod.profit_from_sales_returns)}
                />
                <KeyValueRow
                  label="Line profit total"
                  value={fmt(lineMethod.line_profit_total)}
                />
                <KeyValueRow
                  label="Order lines"
                  value={lineMethod.order_line_count ?? '—'}
                  mono={false}
                />
                <KeyValueRow
                  label="Sales return lines"
                  value={lineMethod.sales_return_line_count ?? '—'}
                  mono={false}
                />
              </MethodCard>
            </div>
            <div className="col-lg-6">
              <MethodCard
                title="GL bridged method (B)"
                description={glMethod.description}
              >
                <KeyValueRow
                  label="Sales revenue (GL)"
                  value={fmt(glMethod.sales_revenue_gl_balance)}
                />
                <KeyValueRow
                  label="Purchase COGS net debit"
                  value={fmt(glMethod.purchase_account_net_debit)}
                />
                <KeyValueRow
                  label="Inventory asset used"
                  value={fmt(glMethod.inventory_value_used)}
                />
                <KeyValueRow label="Implied COGS sold" value={fmt(glMethod.implied_cogs_sold)} />
                <KeyValueRow
                  label="GL bridged equity"
                  value={fmt(glMethod.gl_bridged_equity)}
                />
              </MethodCard>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-12">
              <div className="card">
                <div className="card-header pb-2 pt-3">
                  <h6 className="mb-0">
                    <NavIcon icon={FaChartLine} className="me-2" size={16} />
                    Reconciliation steps
                  </h6>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 text-sm">
                      <thead className="bg-light">
                        <tr>
                          <th className="ps-3">Step</th>
                          <th>Label</th>
                          <th>Source / formula</th>
                          <th className="text-end pe-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.steps || []).map((step) => (
                          <tr key={step.key || step.step}>
                            <td className="ps-3 font-monospace">{step.step}</td>
                            <td>
                              <div className="font-weight-bold">{step.label}</div>
                              {step.formula ? (
                                <div className="text-xs text-muted">{step.formula}</div>
                              ) : null}
                              <StepDetailBlock step={step} fmt={fmt} />
                            </td>
                            <td className="text-muted text-xs">{step.source || '—'}</td>
                            <td className="text-end pe-3 font-monospace">
                              {fmtAmount(step.amount, fmt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {report.hints?.length > 0 ? (
            <div className="row mb-3">
              <div className="col-12">
                <div className="card">
                  <div className="card-header pb-2 pt-3">
                    <h6 className="mb-0">Hints</h6>
                  </div>
                  <ul className="list-group list-group-flush">
                    {report.hints.map((hint, i) => (
                      <li key={i} className="list-group-item text-sm">
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <DevApiSourcesFooter sources={apiSources} className="mb-3" />
        </>
      ) : null}
    </div>
  );
}
