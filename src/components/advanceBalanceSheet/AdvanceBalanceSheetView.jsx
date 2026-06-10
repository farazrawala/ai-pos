import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAdvanceBalanceSheet } from '../../features/advanceBalanceSheet/advanceBalanceSheetSlice.js';
import { buildAdvanceBalanceSheetUrl } from '../../features/advanceBalanceSheet/advanceBalanceSheetAPI.js';
import { formatCurrencyAccounting } from '../balanceSheet/formatCurrency.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import SearchInputIcon from '../SearchInputIcon.jsx';
import NavIcon from '../NavIcon.jsx';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import '../common/devApiSources.css';
import {
  FaArrowsRotate,
  FaChevronDown,
  FaFileInvoice,
  FaChevronRight,
  FaChartLine,
  FaCoins,
  FaFileExport,
  FaMoneyBillTransfer,
  FaTriangleExclamation,
} from 'react-icons/fa6';

function formatCompactMillions(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(x / 1_000).toFixed(2)}K`;
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getProfitVsGlGap(summary) {
  return Number(summary?.profit_vs_gl_gap) || 0;
}

function findAccountBalance(accounts, nameIncludes) {
  if (!Array.isArray(accounts)) return 0;
  const match = accounts.find((acc) =>
    String(acc?.name || '')
      .toLowerCase()
      .includes(nameIncludes)
  );
  return Number(match?.balance) || 0;
}

function getAccountsReceivableBalance(report) {
  return findAccountBalance(report?.assets?.current_assets?.accounts, 'receivable');
}

function getAccountsPayableBalance(report) {
  return findAccountBalance(
    report?.liabilities_and_equity?.current_liabilities?.accounts,
    'payable'
  );
}

/** Totals after Profit vs GL gap is included in equity (should match total assets). */
function getReconciledTotals(report) {
  const summary = report?.summary ?? {};
  const le = report?.liabilities_and_equity ?? {};
  const equity = le.owners_equity ?? {};
  const gap = getProfitVsGlGap(summary);
  const totalAssets = Number(summary.total_assets) || Number(report?.assets?.total) || 0;
  const equitySubtotal =
    Number(equity.gl_bridged_equity) || Number(equity.subtotal_line_profit_method) + gap;
  const totalLe =
    Number(le.total_gl_bridged_method) || Number(le.total_line_profit_method) + gap;
  const outOfBalance = totalAssets - totalLe;
  const balanced =
    Boolean(summary.gl_bridged_balanced) || Math.abs(outOfBalance) < 0.01;
  const profitOrders = Number(equity.profit_from_orders?.amount) || 0;
  const profitReturns = Number(equity.profit_from_sales_returns?.amount) || 0;
  const netLineProfit = profitOrders + profitReturns;
  const profitAligned = Boolean(summary.profit_reconciliation_aligned);

  return {
    gap,
    totalAssets,
    equitySubtotal,
    totalLe,
    outOfBalance,
    balanced,
    profitOrders,
    profitReturns,
    netLineProfit,
    profitAligned,
    accountsReceivable: getAccountsReceivableBalance(report),
    accountsPayable: getAccountsPayableBalance(report),
  };
}

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

function subtotalRowVariant(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('total assets') || l.includes('total liabilities')) return 'net';
  if (l.includes('total')) return 'section';
  return 'section';
}

function AccountLinesStatement({ rows, expanded, onToggleSection, fmt }) {
  if (!rows.length) {
    return (
      <div className="text-center py-5 text-muted">
        <p className="mb-0 text-sm">No lines match your filter.</p>
      </div>
    );
  }

  return (
    <div className="income-statement-lines">
      <div className="income-statement-lines-head d-none d-md-flex">
        <span>Description</span>
        <span>Amount</span>
      </div>
      <ul className="list-unstyled mb-0">
        {rows.map((row, idx) => {
          if (row.type === 'group') {
            const open = expanded.has(row.id);
            return (
              <li key={row.id} className="income-statement-lines-group">
                <button
                  type="button"
                  className="income-statement-lines-group-btn"
                  onClick={() => onToggleSection(row.id)}
                  aria-expanded={open}
                >
                  <span className="income-statement-lines-group-label">
                    <NavIcon
                      icon={open ? FaChevronDown : FaChevronRight}
                      size={12}
                      className="text-secondary me-2"
                    />
                    {row.title}
                  </span>
                </button>
              </li>
            );
          }

          if (row.type === 'leaf') {
            return (
              <li
                key={`leaf-${row.label}-${idx}`}
                className="income-statement-lines-row income-statement-lines-row--leaf"
              >
                <span className="income-statement-lines-desc">
                  {row.label}
                  {row.hint ? (
                    <span className="d-block text-xs text-muted mt-0">{row.hint}</span>
                  ) : null}
                </span>
                <span className="income-statement-lines-amt">{fmt(row.amount)}</span>
              </li>
            );
          }

          const variant = subtotalRowVariant(row.label);
          const variantClass =
            variant === 'net'
              ? 'income-statement-lines-row--net'
              : 'income-statement-lines-row--section-total';

          return (
            <li
              key={`sub-${row.label}-${idx}`}
              className={`income-statement-lines-row income-statement-lines-row--subtotal ${variantClass}`}
            >
              <span className="income-statement-lines-desc">{row.label}</span>
              <span className="income-statement-lines-amt">{fmt(row.amount)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryStatCard({ title, value, subtitle, gradient, icon }) {
  return (
    <div className="col-lg-3 col-md-6 col-12">
      <div className="card mb-3">
        <div className="card-body p-3">
          <div className="row">
            <div className="col-8">
              <div className="numbers">
                <p className="text-sm mb-0 text-uppercase font-weight-bold">{title}</p>
                <h5 className="font-weight-bolder mb-0">{value}</h5>
                {subtitle ? (
                  <p className="mb-0 mt-1 text-sm text-muted">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="col-4 text-end">
              <div
                className={`icon icon-shape bg-gradient-${gradient} shadow text-center rounded-circle d-inline-flex align-items-center justify-content-center`}
              >
                <NavIcon icon={icon} className="text-white opacity-10" size={22} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceStatusBanner({ summary, reconciled }) {
  if (!summary || typeof summary !== 'object') return null;

  const { balanced, outOfBalance, totalAssets, totalLe } = reconciled;
  const profitGap = getProfitVsGlGap(summary);
  const lineProfitGap = Number(summary.out_of_balance) || 0;

  return (
    <div className="card mb-3 border-0 shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span
            className={`badge ${balanced ? 'bg-gradient-success' : 'bg-gradient-danger'} mb-0`}
          >
            {balanced ? 'Balanced' : 'Out of balance'}
          </span>
          {balanced ? (
            <span className="text-sm text-muted mb-0">
              Assets {formatCurrencyAccounting(totalAssets)} = Liabilities &amp; Equity{' '}
              {formatCurrencyAccounting(totalLe)}
              {profitGap !== 0 ? ' (includes Profit vs GL gap)' : ''}
            </span>
          ) : (
            <span className="text-sm text-muted mb-0">
              Difference: {formatCurrencyAccounting(outOfBalance)}
            </span>
          )}
          {!Boolean(summary.balanced) && lineProfitGap !== 0 ? (
            <span className="text-sm text-muted mb-0 d-inline-flex align-items-center gap-1">
              <NavIcon icon={FaTriangleExclamation} size={12} className="text-warning" />
              Line profit gap closed by Profit vs GL gap: {formatCurrencyAccounting(profitGap)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildAssetsRows(assets, expanded, filter) {
  if (!assets || typeof assets !== 'object') return [];
  const q = filter.trim().toLowerCase();
  const match = (label) => !q || String(label).toLowerCase().includes(q);
  const rows = [];

  const pushGroup = (id, title) => {
    rows.push({ type: 'group', id, title });
  };
  const pushLeaf = (label, amount, hint = '') => {
    if (!match(label) && !match(hint)) return;
    rows.push({ type: 'leaf', label, amount: Number(amount) || 0, hint });
  };
  const pushSubtotal = (label, amount) => {
    if (!match(label)) return;
    rows.push({ type: 'subtotal', label, amount: Number(amount) || 0 });
  };

  const current = assets.current_assets;
  if (current) {
    pushGroup('current_assets', current.label || 'Current Assets');
    if (expanded.has('current_assets')) {
      (current.accounts || []).forEach((acc) => {
        pushLeaf(acc.name || 'Account', acc.balance);
      });
      pushSubtotal(`Total ${current.label || 'Current Assets'}`, current.subtotal);
    }
  }

  const inventory = assets.inventory;
  if (inventory) {
    pushGroup('inventory', inventory.label || 'Inventory');
    if (expanded.has('inventory')) {
      (inventory.lines || []).forEach((line) => {
        const qty = Number(line.total_qty) || 0;
        const price = Number(line.wholesale_price) || 0;
        const hint = `${qty} × ${formatCurrencyAccounting(price)}`;
        pushLeaf(line.product_name || 'Product', line.inventory_value, hint);
      });
      pushSubtotal(`Total ${inventory.label || 'Inventory'}`, inventory.subtotal);
    }
  }

  const fixed = assets.fixed_assets;
  if (fixed) {
    pushGroup('fixed_assets', fixed.label || 'Fixed Assets');
    if (expanded.has('fixed_assets')) {
      (fixed.accounts || []).forEach((acc) => {
        pushLeaf(acc.name || 'Account', acc.balance);
      });
      pushSubtotal(`Total ${fixed.label || 'Fixed Assets'}`, fixed.subtotal);
    }
  }

  pushSubtotal('Total Assets', assets.total);

  return rows;
}

function buildLiabilitiesEquityRows(le, expanded, filter, summary = {}) {
  if (!le || typeof le !== 'object') return [];
  const q = filter.trim().toLowerCase();
  const match = (label) => !q || String(label).toLowerCase().includes(q);
  const rows = [];

  const pushGroup = (id, title) => {
    rows.push({ type: 'group', id, title });
  };
  const pushLeaf = (label, amount, hint = '') => {
    if (!match(label) && !match(hint)) return;
    rows.push({ type: 'leaf', label, amount: Number(amount) || 0, hint });
  };
  const pushSubtotal = (label, amount) => {
    if (!match(label)) return;
    rows.push({ type: 'subtotal', label, amount: Number(amount) || 0 });
  };

  const current = le.current_liabilities;
  if (current) {
    pushGroup('current_liabilities', current.label || 'Current Liabilities');
    if (expanded.has('current_liabilities')) {
      (current.accounts || []).forEach((acc) => {
        pushLeaf(acc.name || 'Account', acc.balance);
      });
      pushSubtotal(`Total ${current.label || 'Current Liabilities'}`, current.subtotal);
    }
  }

  const longTerm = le.long_term_liabilities;
  if (longTerm) {
    pushGroup('long_term_liabilities', longTerm.label || 'Long-Term Liabilities');
    if (expanded.has('long_term_liabilities')) {
      (longTerm.accounts || []).forEach((acc) => {
        pushLeaf(acc.name || 'Account', acc.balance);
      });
      pushSubtotal(`Total ${longTerm.label || 'Long-Term Liabilities'}`, longTerm.subtotal);
    }
  }

  const equity = le.owners_equity;
  if (equity) {
    pushGroup('owners_equity', equity.label || "Owner's Equity");
    if (expanded.has('owners_equity')) {
      const profitOrders = equity.profit_from_orders;
      if (profitOrders) {
        const hint = profitOrders.line_count
          ? `${profitOrders.line_count} lines · ${profitOrders.source || ''}`
          : profitOrders.source || '';
        pushLeaf(profitOrders.label || 'Profit', profitOrders.amount, hint);
      }

      if (summary.profit_vs_gl_gap != null) {
        const aligned = Boolean(summary.profit_reconciliation_aligned);
        const hint = aligned ? 'Reconciliation aligned' : 'Line profit vs GL bridged equity';
        pushLeaf('Profit vs GL gap', summary.profit_vs_gl_gap, hint);
      }

      const profitReturns = equity.profit_from_sales_returns;
      if (profitReturns) {
        const hint = profitReturns.line_count
          ? `${profitReturns.line_count} lines · ${profitReturns.source || ''}`
          : profitReturns.source || '';
        pushLeaf(profitReturns.label || 'Sales Return Profit', profitReturns.amount, hint);
      }

      const otherAccounts = equity.other_accounts || [];
      if (otherAccounts.length > 0) {
        pushGroup('other_accounts', 'Other accounts');
        if (expanded.has('other_accounts')) {
          otherAccounts.forEach((acc) => {
            const hint = acc.account_type ? String(acc.account_type).replace(/_/g, ' ') : '';
            pushLeaf(acc.name || 'Account', acc.balance, hint);
          });
        }
      }

      const glPool = equity.gl_pool_accounts || [];
      if (glPool.length > 0) {
        pushGroup('gl_pool', 'GL pool accounts');
        if (expanded.has('gl_pool')) {
          glPool.forEach((acc) => {
            const hint = acc.account_type ? String(acc.account_type).replace(/_/g, ' ') : '';
            pushLeaf(acc.name || 'Account', acc.balance, hint);
          });
        }
      }

      const profitGap = getProfitVsGlGap(summary);
      const reconciledEquitySubtotal =
        Number(equity.gl_bridged_equity) ||
        Number(equity.subtotal_line_profit_method) + profitGap;
      pushSubtotal("Subtotal (Owner's Equity)", reconciledEquitySubtotal);

      const bridge = equity.gl_bridge;
      if (bridge) {
        pushGroup('gl_bridge', 'GL bridge detail');
        if (expanded.has('gl_bridge')) {
          pushLeaf('Sales revenue GL balance', bridge.sales_revenue_gl_balance);
          pushLeaf('Purchase account net debit', bridge.purchase_account_net_debit);
          pushLeaf('Implied COGS sold', bridge.implied_cogs_sold);
          pushLeaf('GL bridged equity', bridge.gl_bridged_equity);
        }
      }
    }
  }

  const profitGap = getProfitVsGlGap(summary);
  const reconciledTotal =
    Number(le.total_gl_bridged_method) || Number(le.total_line_profit_method) + profitGap;
  pushSubtotal('Total Liabilities & Equity', reconciledTotal);

  return rows;
}

export default function AdvanceBalanceSheetView() {
  useRequireModuleAccess('advance-balance-sheet');
  const dispatch = useDispatch();
  const { status, error, report } = useSelector((state) => state.advanceBalanceSheet);

  const fmt = useCallback((n) => formatCurrencyAccounting(n), []);

  const [tableFilter, setTableFilter] = useState('');
  const [expandedAssets, setExpandedAssets] = useState(
    () => new Set(['current_assets', 'inventory', 'fixed_assets'])
  );
  const [expandedLe, setExpandedLe] = useState(
    () =>
      new Set([
        'current_liabilities',
        'long_term_liabilities',
        'owners_equity',
        'other_accounts',
        'gl_pool',
        'gl_bridge',
      ])
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    dispatch(fetchAdvanceBalanceSheet());
  }, [dispatch]);

  useEffect(() => {
    if (status === 'failed' && error) {
      console.error('[Advance balance sheet] Failed to load report', error);
    }
  }, [status, error]);

  const loading = status === 'loading';
  const showData = status === 'succeeded' && report != null;

  const summary = report?.summary ?? {};
  const diagnostics = report?.diagnostics ?? {};
  const reconciled = useMemo(() => getReconciledTotals(report), [report]);

  const assetsRows = useMemo(
    () => buildAssetsRows(report?.assets, expandedAssets, tableFilter),
    [report?.assets, expandedAssets, tableFilter]
  );

  const leRows = useMemo(
    () => buildLiabilitiesEquityRows(report?.liabilities_and_equity, expandedLe, tableFilter, summary),
    [report?.liabilities_and_equity, expandedLe, tableFilter, summary]
  );

  const toggleAssetsSection = (id) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLeSection = (id) => {
    setExpandedLe((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refresh = () => {
    dispatch(fetchAdvanceBalanceSheet());
  };

  const exportCsv = () => {
    const lines = [['Section', 'Description', 'Amount']];
    const addRows = (section, rows) => {
      rows.forEach((r) => {
        if (r.type === 'leaf' || r.type === 'subtotal') {
          lines.push([section, r.label, String(r.amount)]);
        }
      });
    };
    addRows('Assets', assetsRows);
    addRows('Liabilities & Equity', leRows);
    const blob = new Blob(
      [lines.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')],
      { type: 'text/csv;charset=utf-8' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'advance-balance-sheet.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const apiSources = useMemo(
    () => [{ label: 'Advance balance sheet', url: `GET ${buildAdvanceBalanceSheetUrl()}` }],
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
                  <h5 className="mb-1">Advance Balance Sheet</h5>
                  <p className="text-sm text-muted mb-1">
                    As of {formatAsOf(report?.as_of)}
                  </p>
                  <p className="text-sm text-muted mb-0">
                    Assets, liabilities, owner&apos;s equity, GL bridge reconciliation, and
                    diagnostics from a single consolidated API.
                  </p>
                </div>
                <div className="col-lg-4">
                  <div className="d-flex justify-content-lg-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mb-0"
                      onClick={refresh}
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
            <p className="text-sm text-muted mt-3 mb-0">Loading balance sheet…</p>
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
          <div className="row">
            <SummaryStatCard
              title="Accounts receivable"
              value={formatCompactMillions(reconciled.accountsReceivable)}
              subtitle={formatCurrencyAccounting(reconciled.accountsReceivable)}
              gradient="primary"
              icon={FaFileInvoice}
            />
            <SummaryStatCard
              title="Accounts payable"
              value={formatCompactMillions(reconciled.accountsPayable)}
              subtitle={formatCurrencyAccounting(reconciled.accountsPayable)}
              gradient="info"
              icon={FaMoneyBillTransfer}
            />
            <SummaryStatCard
              title="Owner's equity"
              value={formatCompactMillions(reconciled.equitySubtotal)}
              subtitle={formatCurrencyAccounting(reconciled.equitySubtotal)}
              gradient="success"
              icon={FaCoins}
            />
            <SummaryStatCard
              title="Net profit"
              value={formatCompactMillions(reconciled.netLineProfit)}
              subtitle={
                reconciled.profitAligned
                  ? formatCurrencyAccounting(reconciled.netLineProfit)
                  : `${formatCurrencyAccounting(reconciled.netLineProfit)} · GL gap ${formatCurrencyAccounting(reconciled.gap)}`
              }
              gradient={reconciled.profitAligned ? 'success' : 'warning'}
              icon={FaChartLine}
            />
          </div>

          <div className="row">
            <div className="col-12">
              <BalanceStatusBanner summary={summary} reconciled={reconciled} />
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-header pb-3 border-bottom">
                  <div className="row align-items-center g-3">
                    <div className="col-md-5 col-lg-4">
                      <h6 className="mb-1">Statement lines</h6>
                      <p className="text-sm text-muted mb-0">
                        Expand sections to view accounts, inventory, and GL bridge detail.
                      </p>
                    </div>
                    <div className="col-md-7 col-lg-8">
                      <div className="d-flex flex-wrap align-items-center justify-content-md-end gap-2">
                        <div
                          className="input-group input-group-sm flex-grow-1"
                          style={{ maxWidth: '320px', minWidth: '200px' }}
                        >
                          <span className="input-group-text text-body">
                            <SearchInputIcon />
                          </span>
                          <input
                            type="search"
                            className="form-control"
                            placeholder="Filter lines…"
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                            aria-label="Filter lines"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary mb-0 flex-shrink-0"
                          aria-label="Export CSV"
                          title="Export CSV"
                          onClick={exportCsv}
                        >
                          <NavIcon icon={FaFileExport} className="me-1" size={14} />
                          Export
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-body pt-3">
                  <div className="row g-4">
                    <div className="col-lg-6">
                      <h6 className="text-uppercase text-xs text-muted font-weight-bold mb-3">
                        Assets
                      </h6>
                      <AccountLinesStatement
                        rows={assetsRows}
                        expanded={expandedAssets}
                        onToggleSection={toggleAssetsSection}
                        fmt={fmt}
                      />
                    </div>
                    <div className="col-lg-6">
                      <h6 className="text-uppercase text-xs text-muted font-weight-bold mb-3">
                        Liabilities &amp; Equity
                      </h6>
                      <AccountLinesStatement
                        rows={leRows}
                        expanded={expandedLe}
                        onToggleSection={toggleLeSection}
                        fmt={fmt}
                      />
                    </div>
                  </div>

                  <div className="card mt-4 shadow-sm border-0 bg-gray-100">
                    <div className="card-header pb-0 bg-transparent d-flex align-items-center justify-content-between">
                      <div>
                        <h6 className="mb-0">Diagnostics</h6>
                        <p className="text-sm text-muted mb-0">
                          Inventory reconciliation and line subtotal checks.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mb-0"
                        onClick={() => setShowDiagnostics((v) => !v)}
                      >
                        {showDiagnostics ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {showDiagnostics ? (
                      <div className="card-body pt-3">
                        <div className="row g-3 text-sm">
                          <div className="col-md-4">
                            <span className="text-muted d-block text-xs text-uppercase">
                              Inventory value
                            </span>
                            <span className="font-weight-bold">
                              {fmt(diagnostics.inventory_value)}
                            </span>
                          </div>
                          <div className="col-md-4">
                            <span className="text-muted d-block text-xs text-uppercase">
                              Purchase order GL debit total
                            </span>
                            <span className="font-weight-bold">
                              {fmt(diagnostics.purchase_order_gl_debit_total)}
                            </span>
                          </div>
                          <div className="col-md-4">
                            <span className="text-muted d-block text-xs text-uppercase">
                              Inventory vs purchase GL debit
                            </span>
                            <span className="font-weight-bold">
                              {fmt(diagnostics.inventory_vs_purchase_gl_debit)}
                            </span>
                          </div>
                          <div className="col-md-4">
                            <span className="text-muted d-block text-xs text-uppercase">
                              Inventory vs accounts payable
                            </span>
                            <span className="font-weight-bold">
                              {fmt(diagnostics.inventory_vs_accounts_payable)}
                            </span>
                          </div>
                          <div className="col-md-4">
                            <span className="text-muted d-block text-xs text-uppercase">
                              Line subtotal mismatches
                            </span>
                            <span className="font-weight-bold">
                              {Number(diagnostics.line_subtotal_vs_qty_price_mismatch_count) || 0}
                            </span>
                          </div>
                        </div>
                        {(diagnostics.notes || []).length > 0 ? (
                          <ul className="list-unstyled mb-0 mt-3 text-sm text-muted">
                            {diagnostics.notes.map((note, i) => (
                              <li key={i} className="mb-1">
                                • {note}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <DevApiSourcesFooter sources={apiSources} className="mt-3" />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
