import { useMemo } from 'react';
import { buildQtyLedgerFromSteps } from '../../utils/apiWorkflow/inventoryQty.js';

/**
 * @param {{ steps: object[]; statuses: string[] }} props
 */
export default function TestCaseQtyLedger({ steps, statuses }) {
  const rows = useMemo(() => buildQtyLedgerFromSteps(steps), [steps]);
  const last = rows.length ? rows[rows.length - 1] : null;

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Expected quantity
        </h3>
        <p className="mt-2 text-xs text-slate-500">
          Complete setup steps, then run transactions from <code>test_case.rb</code> one at a time.
          Running qty and expected qty appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Expected quantity (test_case.rb)
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[300px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-2 font-semibold">Case</th>
              <th className="py-2 pr-2 text-end font-semibold">Running</th>
              <th className="py-2 text-end font-semibold">Expected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = statuses[row.stepIndex] ?? 'pending';
              const verified = status === 'success';
              const match =
                row.expectedQty != null && verified && row.qty === row.expectedQty;
              const mismatch =
                row.expectedQty != null && verified && row.qty !== row.expectedQty;
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
                    <div className="font-medium text-slate-800">
                      {row.caseNo != null ? `#${row.caseNo}` : ''} {row.stepName}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {row.detail}
                      {verified ? (match ? ' · OK' : mismatch ? ' · mismatch' : ' · done') : ''}
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-end font-mono font-semibold text-slate-800">
                    {row.qty}
                  </td>
                  <td className="py-2 text-end font-mono text-slate-600">
                    {row.expectedQty ?? '—'}
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
                <td className="py-2 text-end font-mono">{last.expectedQty ?? '—'}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
