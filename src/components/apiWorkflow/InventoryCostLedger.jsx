import { useMemo } from 'react';
import { buildLedgerFromSteps, formatLedgerMoney } from '../../utils/apiWorkflow/inventoryCost.js';

/**
 * @param {{ steps: object[]; statuses: string[] }} props
 */
export default function InventoryCostLedger({ steps, statuses }) {
  const rows = useMemo(() => buildLedgerFromSteps(steps), [steps]);
  const last = rows.length ? rows[rows.length - 1] : null;

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Inventory cost (WAC)
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Steps with a <code className="text-indigo-600">ledger</code> field show running qty, value,
          and average cost here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Inventory cost (WAC)
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-2 font-semibold">Step</th>
              <th className="py-2 pr-2 text-end font-semibold">Qty</th>
              <th className="py-2 pr-2 text-end font-semibold">Value</th>
              <th className="py-2 text-end font-semibold">Avg Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = statuses[row.stepIndex] ?? 'pending';
              const verified = status === 'success';
              return (
                <tr
                  key={row.stepIndex}
                  className={[
                    'border-b border-slate-100',
                    verified ? 'bg-emerald-50/60' : '',
                  ].join(' ')}
                >
                  <td className="py-2 pr-2">
                    <div className="font-medium text-slate-800">{row.stepName}</div>
                    <div className="text-[10px] capitalize text-slate-500">
                      {row.kind} · {row.detail}
                      {verified ? ' · done' : ''}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-end font-mono text-slate-800">{row.qty}</td>
                  <td className="py-2 pr-2 text-end font-mono text-slate-800">
                    Rs. {formatLedgerMoney(row.value)}
                  </td>
                  <td className="py-2 text-end font-mono font-semibold text-indigo-700">
                    Rs. {formatLedgerMoney(row.avgCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {last ? (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                <td className="py-2 pr-2">Final</td>
                <td className="py-2 pr-2 text-end font-mono">{last.qty}</td>
                <td className="py-2 pr-2 text-end font-mono">Rs. {formatLedgerMoney(last.value)}</td>
                <td className="py-2 text-end font-mono text-indigo-700">
                  Rs. {formatLedgerMoney(last.avgCost)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
