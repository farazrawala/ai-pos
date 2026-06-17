import { useMemo, useState } from 'react';
import {
  buildBalanceLedgerFromSteps,
  formatLedgerMoney,
} from '../../utils/apiWorkflow/testCaseBalance.js';
import MaximizedPanelOverlay from './MaximizedPanelOverlay.jsx';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `Rs. ${formatLedgerMoney(x)}`;
}

/**
 * @param {{
 *   rows: ReturnType<typeof buildBalanceLedgerFromSteps>;
 *   statuses: string[];
 *   scrollMaxHeight?: string;
 * }} props
 */
function BalanceLedgerTable({ rows, statuses, scrollMaxHeight }) {
  const last = rows.length ? rows[rows.length - 1] : null;

  return (
    <div
      className="overflow-x-auto overflow-y-auto"
      style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
    >
      <table className="w-full min-w-[520px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-[1] bg-white">
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-2 font-semibold">Case</th>
            <th className="py-2 pr-2 text-end font-semibold">Payable</th>
            <th className="py-2 pr-2 text-end font-semibold">Cash</th>
            <th className="py-2 text-end font-semibold">Inventory</th>
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
                <td className="py-2 pr-2 text-end font-mono text-amber-800">
                  {formatMoney(row.ap)}
                </td>
                <td className="py-2 pr-2 text-end font-mono text-emerald-800">
                  {formatMoney(row.cash)}
                </td>
                <td className="py-2 text-end font-mono text-indigo-800">
                  {formatMoney(row.inventoryValue)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {last ? (
          <tfoot className="sticky bottom-0 z-[1] bg-slate-50">
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-800">
              <td className="py-2 pr-2">Final (expected)</td>
              <td className="py-2 pr-2 text-end font-mono text-amber-900">{formatMoney(last.ap)}</td>
              <td className="py-2 pr-2 text-end font-mono text-emerald-900">{formatMoney(last.cash)}</td>
              <td className="py-2 text-end font-mono text-indigo-900">
                {formatMoney(last.inventoryValue)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      <p className="mt-2 text-[10px] text-slate-500">
        Payable = <code>default_account_payable_account</code> · Cash ={' '}
        <code>default_cash_account</code> · Inventory at weighted average cost.
      </p>
    </div>
  );
}

/**
 * @param {{ steps: object[]; statuses: string[] }} props
 */
export default function TestCaseBalanceLedger({ steps, statuses }) {
  const [maximized, setMaximized] = useState(false);
  const rows = useMemo(() => buildBalanceLedgerFromSteps(steps), [steps]);

  const header = (onToggle) => (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Expected balance (after test case)
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Purchases on payable · Sales on cash · Full payment amounts
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
          Expected balance
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Run inventory transactions to see expected payable, cash, and inventory balances.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {header(() => setMaximized(true))}
        <div className="mt-2 max-h-64">
          <BalanceLedgerTable rows={rows} statuses={statuses} scrollMaxHeight="16rem" />
        </div>
      </div>

      <MaximizedPanelOverlay
        open={maximized}
        onClose={() => setMaximized(false)}
        ariaLabel="Expected balance ledger maximized"
      >
        <div className="border-b border-slate-200 px-4 py-3">{header(() => setMaximized(false))}</div>
        <div className="min-h-0 flex-1 overflow-hidden p-4 pt-2">
          <BalanceLedgerTable
            rows={rows}
            statuses={statuses}
            scrollMaxHeight="calc(100vh - 8rem)"
          />
        </div>
      </MaximizedPanelOverlay>
    </>
  );
}
