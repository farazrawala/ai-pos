import { useState } from 'react';
import MaximizedPanelOverlay from './MaximizedPanelOverlay.jsx';

const statusStyles = {
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  running: 'bg-amber-50 text-amber-800 border-amber-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-rose-50 text-rose-800 border-rose-200',
};

const methodStyles = {
  GET: 'text-sky-700 bg-sky-50',
  POST: 'text-violet-700 bg-violet-50',
  PUT: 'text-amber-700 bg-amber-50',
  PATCH: 'text-teal-700 bg-teal-50',
  DELETE: 'text-rose-700 bg-rose-50',
};

/**
 * @param {{
 *   steps: object[];
 *   statuses: string[];
 *   stepResults: object[];
 *   selectedIndex: number;
 *   checkedSteps: boolean[];
 *   onSelect: (index: number) => void;
 *   onToggleCheck: (index: number) => void;
 *   listClassName?: string;
 *   panelClassName?: string;
 *   disabled?: boolean;
 * }} props
 */
function TestCaseStepList({
  steps,
  statuses,
  stepResults,
  selectedIndex,
  checkedSteps,
  onSelect,
  onToggleCheck,
  listClassName = 'tc-step-list min-h-0 flex-1 overflow-y-auto p-2',
  panelClassName = 'flex min-h-0 flex-1 flex-col overflow-hidden',
  disabled,
}) {
  return (
    <div className={panelClassName}>
      <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="tc-step-select-col">Select</span>
        <span className="ms-1">Step</span>
      </div>
      <ul className={listClassName}>
        {steps.map((step, index) => {
          const status = statuses[index] ?? 'pending';
          const selected = index === selectedIndex;
          const isSetup = !step.caseNo;
          const checked = checkedSteps[index] ?? false;
          const qtyCheck = stepResults[index]?.qtyCheck;
          const qtyOk = qtyCheck?.triggered && qtyCheck.match;
          const qtyBad = qtyCheck?.triggered && !qtyCheck.match;
          return (
            <li key={index} className="mb-1">
              <div
                className={[
                  'tc-step-row flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 transition',
                  qtyBad ? 'border-rose-400 bg-rose-50 text-rose-900' : '',
                  qtyOk ? 'border-emerald-400 bg-emerald-50/80' : '',
                  !qtyBad && !qtyOk ? statusStyles[status] ?? statusStyles.pending : '',
                  selected ? 'ring-2 ring-indigo-400 ring-offset-1' : 'hover:opacity-90',
                  disabled ? 'opacity-60' : '',
                ].join(' ')}
              >
                <div className="form-check tc-step-check-wrap m-0 shrink-0">
                  <input
                    id={`tc-step-check-${index}`}
                    className="form-check-input tc-step-checkbox"
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggleCheck(index)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Include step ${index + 1}: ${step.name}`}
                  />
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(index)}
                  className={[
                    'flex min-w-0 flex-1 flex-col gap-1 border-0 bg-transparent p-0 text-left',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                        methodStyles[step.method] ?? 'bg-slate-100 text-slate-600',
                      ].join(' ')}
                    >
                      {step.method}
                    </span>
                    {step.caseNo != null ? (
                      <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                        #{step.caseNo}
                      </span>
                    ) : null}
                    {step.docRef ? (
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-white">
                        {step.docRef}
                      </span>
                    ) : null}
                    <span className="truncate text-sm font-medium text-slate-900">{step.name}</span>
                  </div>
                  {!isSetup && step.expectedQty != null ? (
                    <span className="text-[10px] font-medium text-slate-600">
                      Expected qty after step: <strong>{step.expectedQty}</strong>
                    </span>
                  ) : null}
                  {qtyCheck?.triggered ? (
                    <span
                      className={[
                        'inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        qtyCheck.match
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-rose-200 text-rose-900',
                      ].join(' ')}
                    >
                      {qtyCheck.match
                        ? `Qty OK (${qtyCheck.actual})`
                        : `Qty mismatch — expected ${qtyCheck.expected}, got ${qtyCheck.actual ?? '—'}`}
                    </span>
                  ) : null}
                  <span className="truncate font-mono text-[11px] text-slate-500">{step.url}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {status}
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   steps: object[];
 *   maximized: boolean;
 *   onToggleMaximize: () => void;
 *   checkedCount: number;
 *   disabled?: boolean;
 *   onSelectAllChecks: () => void;
 *   onClearAllChecks: () => void;
 *   onRunChecked: () => void;
 *   runningChecked?: boolean;
 * }} props
 */
function TestCaseListHeader({
  steps,
  maximized,
  onToggleMaximize,
  checkedCount,
  disabled,
  onSelectAllChecks,
  onClearAllChecks,
  onRunChecked,
  runningChecked,
}) {
  return (
    <div className="shrink-0 border-b border-slate-100 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Test cases</h2>
          <p className="text-xs text-slate-500">
            {steps.length} steps — check steps to run as a batch
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectAllChecks}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            All
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onClearAllChecks}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            None
          </button>
          <button
            type="button"
            onClick={onToggleMaximize}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
            title={maximized ? 'Restore panel size' : 'Maximize panel'}
          >
            {maximized ? 'Restore' : 'Maximize'}
          </button>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled || checkedCount === 0}
        onClick={onRunChecked}
        className="mt-3 w-full rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {runningChecked
          ? `Running ${checkedCount} step${checkedCount === 1 ? '' : 's'}…`
          : `Run selected steps${checkedCount > 0 ? ` (${checkedCount})` : ''}`}
      </button>
    </div>
  );
}

const TestCaseWorkflowList = ({
  steps,
  statuses,
  stepResults = [],
  selectedIndex,
  checkedSteps = [],
  onSelect,
  onToggleCheck,
  onSelectAllChecks,
  onClearAllChecks,
  onRunChecked,
  runningChecked,
  disabled,
}) => {
  const [maximized, setMaximized] = useState(false);
  const checkedCount = checkedSteps.filter(Boolean).length;

  const listProps = {
    steps,
    statuses,
    stepResults,
    selectedIndex,
    checkedSteps,
    onSelect,
    onToggleCheck,
    disabled,
  };

  const headerProps = {
    steps,
    checkedCount,
    disabled,
    onSelectAllChecks,
    onClearAllChecks,
    onRunChecked,
    runningChecked,
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <TestCaseListHeader
          {...headerProps}
          maximized={false}
          onToggleMaximize={() => setMaximized(true)}
        />
        <TestCaseStepList {...listProps} />
      </div>

      <MaximizedPanelOverlay
        open={maximized}
        onClose={() => setMaximized(false)}
        ariaLabel="Test cases list maximized"
        maxWidthClass="max-w-4xl"
      >
        <TestCaseListHeader
          {...headerProps}
          maximized
          onToggleMaximize={() => setMaximized(false)}
        />
        <TestCaseStepList
          {...listProps}
          listClassName="tc-step-list min-h-0 flex-1 overflow-y-auto p-3"
        />
      </MaximizedPanelOverlay>
    </>
  );
};

export default TestCaseWorkflowList;
