import { useMemo, useState } from 'react';
import { buildQtyLedgerFromSteps } from '../../utils/apiWorkflow/inventoryQty.js';
import { formatLedgerMoney } from '../../utils/apiWorkflow/inventoryCost.js';
import MaximizedPanelOverlay from './MaximizedPanelOverlay.jsx';

function formatAvgCost(avgCost, qty) {
  const avg = Number(avgCost);
  const q = Number(qty);
  // WAC is meaningful whenever stock is non-zero (including negative / oversold).
  if (!Number.isFinite(avg) || avg <= 0 || !Number.isFinite(q) || q === 0) return '—';
  return `Rs. ${formatLedgerMoney(avg)}`;
}

/** Inventory value after the step = qty × WAC (the "actual value after transaction"). */
function formatInventoryValue(value, qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q === 0) return 'Rs. 0.00';
  const v = Number(value);
  if (!Number.isFinite(v)) return '—';
  return `Rs. ${formatLedgerMoney(v)}`;
}

/** Step change: running qty after this step minus running qty before. */
function stepQtyChange(row, rowIndex, rows) {
  const prev = priorRunningQty(rowIndex, rows);
  const curr = Number(row?.qty);
  if (!Number.isFinite(curr)) return null;
  return curr - prev;
}

function priorRunningQty(rowIndex, rows) {
  if (rowIndex <= 0) return 0;
  const prev = rows[rowIndex - 1]?.qty;
  return Number.isFinite(Number(prev)) ? Number(prev) : 0;
}

function formatDifference(diff) {
  if (diff == null || !Number.isFinite(diff)) return '—';
  if (diff === 0) return '0';
  return diff > 0 ? `+${diff}` : String(diff);
}

function formatRecalcLine(prior, change, running) {
  if (change == null || !Number.isFinite(change)) return '';
  const ch = change === 0 ? '0' : change > 0 ? `+${change}` : String(change);
  return `${prior} ${ch} = ${running}`;
}

/**
 * @param {{
 *   rows: ReturnType<typeof buildQtyLedgerFromSteps>;
 *   statuses: string[];
 *   scrollMaxHeight?: string;
 * }} props
 */
function QtyLedgerTable({ rows, statuses, scrollMaxHeight }) {
  const last = rows.length ? rows[rows.length - 1] : null;
  const finalStepChange = last ? stepQtyChange(last, rows.length - 1, rows) : null;

  return (
    <div
      className="overflow-x-auto overflow-y-auto"
      style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
    >
      <table className="w-full min-w-[480px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-[1] bg-white">
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-2 font-semibold">Case</th>
            <th className="py-2 pr-2 text-end font-semibold">Prior</th>
            <th className="py-2 pr-2 text-end font-semibold">Change</th>
            <th className="py-2 pr-2 text-end font-semibold">Running</th>
            <th className="py-2 pr-2 text-end font-semibold">Expected</th>
            <th className="py-2 pr-2 text-end font-semibold">Avg cost</th>
            <th className="py-2 text-end font-semibold">Inventory value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const status = statuses[row.stepIndex] ?? 'pending';
            const verified = status === 'success';
            const stepChange = stepQtyChange(row, rowIndex, rows);
            const priorQty = priorRunningQty(rowIndex, rows);
            const recalcLine = formatRecalcLine(priorQty, stepChange, row.qty);
            const match = row.expectedQty != null && verified && row.qty === row.expectedQty;
            const mismatch = row.expectedQty != null && verified && row.qty !== row.expectedQty;
            const isPurchase = row.kind === 'purchase';
            return (
              <tr
                key={row.stepIndex}
                className={[
                  'border-b border-slate-100',
                  match ? 'bg-emerald-50/70' : '',
                  mismatch ? 'bg-rose-50/70' : verified ? 'bg-slate-50/50' : '',
                ].join(' ')}
              >
                <td className="py-2 pr-2">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-800">
                    {row.caseNo != null ? (
                      <span className="text-slate-500">#{row.caseNo}</span>
                    ) : null}
                    {row.docRef ? (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-white">
                        {row.docRef}
                      </span>
                    ) : null}
                    <span>{row.stepName.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {row.detail}
                    {recalcLine ? ` · ${recalcLine}` : ''}
                    {verified ? (match ? ' · OK' : mismatch ? ' · mismatch' : ' · done') : ''}
                  </div>
                </td>
                <td className="py-2 pr-2 text-end font-mono text-slate-600">{priorQty}</td>
                <td
                  className={[
                    'py-2 pr-2 text-end font-mono font-semibold',
                    stepChange == null ? 'text-slate-400' : '',
                    stepChange > 0 ? 'text-emerald-700' : '',
                    stepChange < 0 ? 'text-rose-700' : '',
                    stepChange === 0 ? 'text-slate-600' : '',
                  ].join(' ')}
                >
                  {formatDifference(stepChange)}
                </td>
                <td className="py-2 pr-2 text-end font-mono font-semibold text-slate-800">
                  {row.qty}
                </td>
                <td className="py-2 pr-2 text-end font-mono text-slate-600">
                  {row.expectedQty ?? '—'}
                </td>
                <td
                  className={[
                    'py-2 pr-2 text-end font-mono font-semibold',
                    isPurchase ? 'text-indigo-700' : 'text-slate-600',
                  ].join(' ')}
                >
                  {formatAvgCost(row.avgCost, row.qty)}
                </td>
                <td
                  className={[
                    'py-2 text-end font-mono font-semibold',
                    Number(row.value) < 0 ? 'text-rose-700' : 'text-slate-800',
                  ].join(' ')}
                >
                  {formatInventoryValue(row.value, row.qty)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {last ? (
          <tfoot className="sticky bottom-0 z-[1] bg-slate-50">
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-800">
              <td className="py-2 pr-2">Final</td>
              <td className="py-2 pr-2 text-end font-mono">
                {rows.length > 1 ? priorRunningQty(rows.length - 1, rows) : 0}
              </td>
              <td
                className={[
                  'py-2 pr-2 text-end font-mono',
                  finalStepChange == null ? 'text-slate-400' : '',
                  finalStepChange > 0 ? 'text-emerald-700' : '',
                  finalStepChange < 0 ? 'text-rose-700' : '',
                  finalStepChange === 0 ? 'text-slate-600' : '',
                ].join(' ')}
              >
                {formatDifference(finalStepChange)}
              </td>
              <td className="py-2 pr-2 text-end font-mono">{last.qty}</td>
              <td className="py-2 pr-2 text-end font-mono">{last.expectedQty ?? '—'}</td>
              <td className="py-2 pr-2 text-end font-mono text-indigo-700">
                {formatAvgCost(last.avgCost, last.qty)}
              </td>
              <td
                className={[
                  'py-2 text-end font-mono',
                  Number(last.value) < 0 ? 'text-rose-700' : 'text-slate-900',
                ].join(' ')}
              >
                {formatInventoryValue(last.value, last.qty)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/**
 * @param {{ steps: object[]; statuses: string[]; cases?: Array<{ n: number; replayQty?: boolean; expected?: number }> }} props
 */
export default function TestCaseQtyLedger({ steps, statuses, cases = null }) {
  const [maximized, setMaximized] = useState(false);
  const rows = useMemo(() => buildQtyLedgerFromSteps(steps, cases), [steps, cases]);

  const header = (onToggle) => (
    <div className="flex items-start justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Expected quantity (test_case.rb)
      </h3>
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
          Expected quantity
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Complete setup steps, then run transactions from <code>test_case.rb</code> one at a time.
          Running qty, expected qty, per-step change, and weighted average cost appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {header(() => setMaximized(true))}
        <div className="mt-2 max-h-64">
          <QtyLedgerTable rows={rows} statuses={statuses} scrollMaxHeight="16rem" />
        </div>
      </div>

      <MaximizedPanelOverlay
        open={maximized}
        onClose={() => setMaximized(false)}
        ariaLabel="Expected quantity ledger maximized"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          {header(() => setMaximized(false))}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4 pt-2">
          <QtyLedgerTable rows={rows} statuses={statuses} scrollMaxHeight="calc(100vh - 8rem)" />
        </div>
      </MaximizedPanelOverlay>
    </>
  );
}
