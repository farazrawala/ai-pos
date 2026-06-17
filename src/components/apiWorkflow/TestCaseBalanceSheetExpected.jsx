import { useEffect, useMemo, useState } from 'react';
import {
  buildBalanceLedgerFromSteps,
  formatLedgerMoney,
} from '../../utils/apiWorkflow/testCaseBalance.js';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const formatted = formatLedgerMoney(Math.abs(x));
  if (x < 0) return `(Rs. ${formatted})`;
  return `Rs. ${formatted}`;
}

/**
 * @param {{
 *   rows: ReturnType<typeof buildBalanceLedgerFromSteps>;
 *   statuses: string[];
 *   scrollMaxHeight?: string;
 * }} props
 */
function BalanceSheetTable({ rows, statuses, scrollMaxHeight }) {
  const last = rows.length ? rows[rows.length - 1] : null;

  return (
    <div
      className="overflow-x-auto overflow-y-auto"
      style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
    >
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-[1] bg-white">
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-2 font-semibold" rowSpan={2}>
              Case
            </th>
            <th
              className="border-b border-slate-100 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-emerald-800"
              colSpan={3}
            >
              Current assets
            </th>
            <th
              className="border-b border-slate-100 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-amber-800"
              colSpan={2}
            >
              Current liabilities
            </th>
          </tr>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-2 text-end font-semibold">Cash</th>
            <th className="py-2 pr-2 text-end font-semibold">Inventory</th>
            <th className="py-2 pr-2 text-end font-semibold">Total</th>
            <th className="py-2 pr-2 text-end font-semibold">Payable</th>
            <th className="py-2 text-end font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = statuses[row.stepIndex] ?? 'pending';
            const verified = status === 'success';
            return (
              <tr
                key={row.stepIndex}
                className={['border-b border-slate-100', verified ? 'bg-slate-50/50' : ''].join(' ')}
              >
                <td className="py-2 pr-2">
                  <div className="font-medium text-slate-800">
                    {row.caseNo != null ? `#${row.caseNo}` : ''} {row.stepName}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {row.detail}
                    {verified ? ' · done' : ''}
                  </div>
                </td>
                <td className="py-2 pr-2 text-end font-mono text-emerald-800">
                  {formatMoney(row.cash)}
                </td>
                <td className="py-2 pr-2 text-end font-mono text-indigo-800">
                  {formatMoney(row.inventoryValue)}
                </td>
                <td className="py-2 pr-2 text-end font-mono font-semibold text-emerald-900">
                  {formatMoney(row.totalCurrentAssets)}
                </td>
                <td className="py-2 pr-2 text-end font-mono text-amber-800">
                  {formatMoney(row.ap)}
                </td>
                <td className="py-2 text-end font-mono font-semibold text-amber-900">
                  {formatMoney(row.totalCurrentLiabilities)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {last ? (
          <tfoot className="sticky bottom-0 z-[1] bg-slate-50">
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-800">
              <td className="py-2 pr-2">Final (expected)</td>
              <td className="py-2 pr-2 text-end font-mono">{formatMoney(last.cash)}</td>
              <td className="py-2 pr-2 text-end font-mono">{formatMoney(last.inventoryValue)}</td>
              <td className="py-2 pr-2 text-end font-mono text-emerald-900">
                {formatMoney(last.totalCurrentAssets)}
              </td>
              <td className="py-2 pr-2 text-end font-mono">{formatMoney(last.ap)}</td>
              <td className="py-2 text-end font-mono text-amber-900">
                {formatMoney(last.totalCurrentLiabilities)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      <p className="mt-2 text-[10px] text-slate-500">
        Current assets: <code>default_cash_account</code> + inventory (WAC). Current liabilities:{' '}
        <code>default_account_payable_account</code>. Parentheses = credit / negative balance.
      </p>
    </div>
  );
}

/**
 * @param {{ steps: object[]; statuses: string[] }} props
 */
export default function TestCaseBalanceSheetExpected({ steps, statuses }) {
  const [maximized, setMaximized] = useState(false);
  const rows = useMemo(() => buildBalanceLedgerFromSteps(steps), [steps]);
  const last = rows.length ? rows[rows.length - 1] : null;

  useEffect(() => {
    if (!maximized) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMaximized(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [maximized]);

  const header = (onToggle) => (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Expected balance sheet
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Current assets vs current liabilities after each step
        </p>
      </div>
      {rows.length > 0 ? (
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
          title={maximized ? 'Restore panel size' : 'Maximize panel'}
        >
          {maximized ? 'Restore' : 'Maximize'}
        </button>
      ) : null}
    </div>
  );

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Expected balance sheet
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Run inventory transactions to see expected current assets and liabilities.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {header(() => setMaximized(true))}
        {last ? (
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-[11px] sm:grid-cols-2">
            <div>
              <p className="font-bold uppercase tracking-wide text-emerald-800">Current assets</p>
              <div className="mt-1 flex justify-between text-slate-700">
                <span>Cash</span>
                <span className="font-mono">{formatMoney(last.cash)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Inventory</span>
                <span className="font-mono">{formatMoney(last.inventoryValue)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-emerald-900">
                <span>Total</span>
                <span className="font-mono">{formatMoney(last.totalCurrentAssets)}</span>
              </div>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide text-amber-800">Current liabilities</p>
              <div className="mt-1 flex justify-between text-slate-700">
                <span>Accounts payable</span>
                <span className="font-mono">{formatMoney(last.ap)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-amber-900">
                <span>Total</span>
                <span className="font-mono">{formatMoney(last.totalCurrentLiabilities)}</span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="mt-2 max-h-64">
          <BalanceSheetTable rows={rows} statuses={statuses} scrollMaxHeight="16rem" />
        </div>
      </div>

      {maximized ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-slate-900/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Expected balance sheet maximized"
          onClick={() => setMaximized(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3">{header(() => setMaximized(false))}</div>
            <div className="min-h-0 flex-1 overflow-hidden p-4 pt-2">
              <BalanceSheetTable
                rows={rows}
                statuses={statuses}
                scrollMaxHeight="calc(100vh - 8rem)"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
