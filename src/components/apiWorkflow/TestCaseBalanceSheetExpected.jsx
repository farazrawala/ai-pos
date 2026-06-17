import { useMemo, useState } from 'react';
import {
  buildBalanceLedgerFromSteps,
  formatLedgerMoney,
} from '../../utils/apiWorkflow/testCaseBalance.js';
import MaximizedPanelOverlay from './MaximizedPanelOverlay.jsx';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const formatted = formatLedgerMoney(Math.abs(x));
  if (x < 0) return `(Rs. ${formatted})`;
  return `Rs. ${formatted}`;
}

function BalanceSheetPanel({ sheet, compact = false }) {
  if (!sheet) return null;

  const sectionTitle = compact
    ? 'text-[10px] font-bold uppercase tracking-wide'
    : 'text-[11px] font-bold uppercase tracking-wide';

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5">
        <p className={`${sectionTitle} text-emerald-900`}>Assets</p>
        <div className="mt-2 space-y-2 text-[11px]">
          <div>
            <p className="font-semibold text-slate-800">Current assets</p>
            <div className="mt-1 flex justify-between text-slate-700">
              <span>Cash</span>
              <span className="font-mono">{formatMoney(sheet.currentAssets.cash)}</span>
            </div>
            <div className="flex justify-between border-t border-emerald-100 pt-1 font-medium text-slate-800">
              <span>Total current assets</span>
              <span className="font-mono">{formatMoney(sheet.currentAssets.total)}</span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Inventory</p>
            <div className="mt-1 flex justify-between text-slate-700">
              <span>Inventory (avg cost)</span>
              <span className="font-mono">
                {formatMoney(sheet.inventory.atCost ?? sheet.inventory.total)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-slate-700">
              <span>Inventory (stock × wholesale)</span>
              <span className="font-mono">{formatMoney(sheet.inventory.wholesaleTotal)}</span>
            </div>
            {sheet.inventory.qty > 0 ? (
              <p className="text-[10px] text-slate-500">
                {sheet.inventory.qty} units × Rs.{' '}
                {formatLedgerMoney(sheet.inventory.wholesaleUnitPrice ?? 250)}
              </p>
            ) : null}
            <div className="flex justify-between border-t border-emerald-100 pt-1 font-medium text-slate-800">
              <span>Total inventory (avg cost)</span>
              <span className="font-mono">
                {formatMoney(sheet.inventory.atCost ?? sheet.inventory.total)}
              </span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Fixed assets</p>
            <div className="flex justify-between border-t border-emerald-100 pt-1 font-medium text-slate-800">
              <span>Total fixed assets</span>
              <span className="font-mono">{formatMoney(sheet.fixedAssets.total)}</span>
            </div>
          </div>
          <div className="flex justify-between border-t-2 border-emerald-200 pt-1 text-xs font-bold text-emerald-900">
            <span>Total assets</span>
            <span className="font-mono">{formatMoney(sheet.totalAssets)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-2.5">
        <p className={`${sectionTitle} text-amber-900`}>Liabilities &amp; equity</p>
        <div className="mt-2 space-y-2 text-[11px]">
          <div>
            <p className="font-semibold text-slate-800">Liabilities</p>
            <div className="mt-1 flex justify-between text-slate-700">
              <span>Current liabilities · Accounts payable</span>
              <span className="font-mono">{formatMoney(sheet.currentLiabilities.accountsPayable)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Total current liabilities</span>
              <span className="font-mono">{formatMoney(sheet.currentLiabilities.total)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Long-term liabilities</span>
              <span className="font-mono">{formatMoney(sheet.longTermLiabilities.total)}</span>
            </div>
            <div className="flex justify-between border-t border-amber-100 pt-1 font-medium text-slate-800">
              <span>Total liabilities</span>
              <span className="font-mono">{formatMoney(sheet.totalLiabilities)}</span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Equity</p>
            <div className="mt-1 flex justify-between text-slate-700">
              <span>Owner&apos;s equity</span>
              <span className="font-mono">{formatMoney(sheet.equity.ownersEquity)}</span>
            </div>
            <div className="flex justify-between border-t border-amber-100 pt-1 font-medium text-slate-800">
              <span>Total equity</span>
              <span className="font-mono">{formatMoney(sheet.equity.total)}</span>
            </div>
          </div>
          <div className="flex justify-between border-t-2 border-amber-200 pt-1 text-xs font-bold text-amber-900">
            <span>Total liabilities &amp; equity</span>
            <span className="font-mono">{formatMoney(sheet.totalLiabilitiesAndEquity)}</span>
          </div>
        </div>
      </div>
      <div
        className={`sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
          sheet.balanced
            ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
            : 'border-rose-200 bg-rose-50/80 text-rose-900'
        }`}
      >
        <span className="font-semibold">{sheet.balanced ? 'Balanced' : 'Out of balance'}</span>
        <span className="font-mono">
          Assets − (Liabilities + Equity) = {formatMoney(sheet.outOfBalance)}
        </span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   rows: ReturnType<typeof buildBalanceLedgerFromSteps>;
 *   statuses: string[];
 *   scrollMaxHeight?: string;
 * }} props
 */
function BalanceSheetStepsList({ rows, statuses, scrollMaxHeight }) {
  return (
    <div
      className="space-y-3 overflow-y-auto pr-1"
      style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
    >
      {rows.map((row) => {
        const status = statuses[row.stepIndex] ?? 'pending';
        const verified = status === 'success';
        return (
          <div
            key={row.stepIndex}
            className={[
              'rounded-lg border border-slate-200 p-2.5',
              verified ? 'bg-white' : 'bg-slate-50/50',
            ].join(' ')}
          >
            <div className="mb-2">
              <div className="font-medium text-slate-800">
                {row.caseNo != null ? `#${row.caseNo}` : ''} {row.stepName}
              </div>
              <div className="text-[10px] text-slate-500">
                {row.detail}
                {verified ? ' · done' : ''}
              </div>
            </div>
            <BalanceSheetPanel sheet={row.balanceSheet} compact />
          </div>
        );
      })}
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
  const finalSheet = last?.balanceSheet ?? null;

  const header = (onToggle) => (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Expected balance sheet
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Current assets · Inventory (avg cost &amp; stock × wholesale) · Liabilities · Equity
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
          Run inventory transactions to see the expected balance sheet after each step.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {header(() => setMaximized(true))}
        {finalSheet ? (
          <div className="mt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Final expected
            </p>
            <BalanceSheetPanel sheet={finalSheet} />
          </div>
        ) : null}
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            After each step
          </p>
          <div className="max-h-72">
            <BalanceSheetStepsList rows={rows} statuses={statuses} scrollMaxHeight="18rem" />
          </div>
        </div>
      </div>

      <MaximizedPanelOverlay
        open={maximized}
        onClose={() => setMaximized(false)}
        ariaLabel="Expected balance sheet maximized"
        maxWidthClass="max-w-6xl"
      >
        <div className="border-b border-slate-200 px-4 py-3">{header(() => setMaximized(false))}</div>
        <div className="min-h-0 flex-1 overflow-hidden p-4 pt-2">
          <BalanceSheetStepsList
            rows={rows}
            statuses={statuses}
            scrollMaxHeight="calc(100vh - 8rem)"
          />
        </div>
      </MaximizedPanelOverlay>
    </>
  );
}
