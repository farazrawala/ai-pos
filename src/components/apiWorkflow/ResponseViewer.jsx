import { useState } from 'react';
import MaximizedPanelOverlay from './MaximizedPanelOverlay.jsx';

function formatBody(data) {
  try {
    return JSON.stringify(data ?? null, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * @param {{
 *   stepIndex: number;
 *   name: string;
 *   payload: object;
 *   bodyMaxHeight?: string;
 *   balanceSheetMaxHeight?: string;
 * }} props
 */
function StepResponseBlock({
  stepIndex,
  name,
  payload,
  bodyMaxHeight = '240px',
  balanceSheetMaxHeight = '180px',
}) {
  const { ok, status, statusText, timeMs, data, errorMessage, headers, balanceSheetCheck, qtyCheck } =
    payload;

  const qtyBanner =
    qtyCheck?.triggered && qtyCheck.match
      ? 'border-emerald-300 bg-emerald-50/90'
      : qtyCheck?.triggered && !qtyCheck.match
        ? 'border-rose-300 bg-rose-50/90'
        : '';

  return (
    <div className={`border-b border-slate-100 last:border-b-0 ${qtyBanner ? `border-l-4 ${qtyBanner}` : ''}`}>
      <div className="bg-slate-50/90 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">
          <span className="font-mono text-slate-500">{stepIndex + 1}.</span> {name || `Step ${stepIndex + 1}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {status ?? '—'} {statusText ? `· ${statusText}` : ''}
          </span>
          {timeMs != null && (
            <span className="text-slate-600">
              <span className="text-slate-400">Time</span> {timeMs.toFixed(0)} ms
            </span>
          )}
        </div>
        {errorMessage && <p className="mt-1 text-[11px] text-rose-600">{errorMessage}</p>}
      </div>
      <div className="p-3">
        <p className="mb-1 text-xs font-medium text-slate-500">Body</p>
        <pre
          className="overflow-auto rounded-lg border border-slate-100 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-100"
          style={{ maxHeight: bodyMaxHeight }}
        >
          {formatBody(data)}
        </pre>
        {balanceSheetCheck?.triggered ? (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/80 p-3">
            <p className="text-xs font-semibold text-violet-900">Balance sheet check</p>
            <p className="mt-1 text-[11px] text-violet-800">
              {balanceSheetCheck.ok ? 'OK' : 'Failed'} — HTTP {balanceSheetCheck.status ?? '—'}{' '}
              {balanceSheetCheck.statusText ? `· ${balanceSheetCheck.statusText}` : ''}
            </p>
            {balanceSheetCheck.errorMessage ? (
              <p className="mt-1 text-[11px] text-rose-600">{balanceSheetCheck.errorMessage}</p>
            ) : null}
            <pre
              className="mt-2 overflow-auto rounded border border-violet-100 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-100"
              style={{ maxHeight: balanceSheetMaxHeight }}
            >
              {JSON.stringify(balanceSheetCheck.summary ?? null, null, 2)}
            </pre>
          </div>
        ) : null}
        {qtyCheck?.triggered ? (
          <div
            className={`mt-3 rounded-lg border p-3 ${
              qtyCheck.match
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-rose-300 bg-rose-50'
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                qtyCheck.match ? 'text-emerald-900' : 'text-rose-900'
              }`}
            >
              {qtyCheck.match ? 'Qty check — OK' : 'Qty check — mismatch'}
            </p>
            <p
              className={`mt-1 text-[11px] ${
                qtyCheck.match ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              Expected <strong className="font-mono">{qtyCheck.expected}</strong>
              {' · '}
              Actual <strong className="font-mono">{qtyCheck.actual ?? '—'}</strong>
              {qtyCheck.ok === false ? (
                <>
                  {' '}
                  — HTTP {qtyCheck.status ?? '—'}
                  {qtyCheck.statusText ? ` · ${qtyCheck.statusText}` : ''}
                </>
              ) : null}
            </p>
            {qtyCheck.errorMessage ? (
              <p className="mt-1 text-[11px] text-rose-600">{qtyCheck.errorMessage}</p>
            ) : null}
            {!qtyCheck.match && qtyCheck.actual != null ? (
              <p className="mt-1 text-[11px] font-medium text-rose-700">
                Difference: {qtyCheck.actual - qtyCheck.expected > 0 ? '+' : ''}
                {qtyCheck.actual - qtyCheck.expected}
              </p>
            ) : null}
          </div>
        ) : null}
        {headers && Object.keys(headers).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Headers</summary>
            <pre className="mt-2 max-h-32 overflow-auto rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] text-slate-700">
              {JSON.stringify(headers, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   steps: object[];
 *   stepResults: object[];
 *   loadingStepIndex: number | null;
 *   bodyMaxHeight?: string;
 *   balanceSheetMaxHeight?: string;
 *   className?: string;
 * }} props
 */
function ResponseStepList({
  steps,
  stepResults,
  loadingStepIndex,
  bodyMaxHeight,
  balanceSheetMaxHeight,
  className = 'min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto',
}) {
  return (
    <div className={className}>
      {stepResults.map((payload, i) => {
        if (!payload) return null;
        const name = steps[i]?.name ?? `Step ${i + 1}`;
        return (
          <StepResponseBlock
            key={i}
            stepIndex={i}
            name={name}
            payload={payload}
            bodyMaxHeight={bodyMaxHeight}
            balanceSheetMaxHeight={balanceSheetMaxHeight}
          />
        );
      })}
      {loadingStepIndex != null && stepResults[loadingStepIndex] == null ? (
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs text-indigo-900">
          <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span>
            Running{' '}
            <span className="font-semibold">
              {steps[loadingStepIndex]?.name || `step ${loadingStepIndex + 1}`}
            </span>
            …
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   maximized: boolean;
 *   onToggleMaximize: () => void;
 *   loadingStepIndex: number | null;
 *   loadingName: string | null;
 * }} props
 */
function ResponseHeader({ maximized, onToggleMaximize, loadingStepIndex, loadingName }) {
  return (
    <div className="shrink-0 border-b border-slate-100 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Response</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            One block per step; latest run for each index.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMaximize}
          className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
          title={maximized ? 'Restore panel size' : 'Maximize panel'}
        >
          {maximized ? 'Restore' : 'Maximize'}
        </button>
      </div>
      {loadingStepIndex != null && !maximized ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900">
          <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span>
            Running <span className="font-semibold">{loadingName || `step ${loadingStepIndex + 1}`}</span>…
          </span>
        </div>
      ) : null}
    </div>
  );
}

const ResponseViewer = ({ steps = [], stepResults = [], loadingStepIndex = null }) => {
  const [maximized, setMaximized] = useState(false);
  const hasAnyResult = stepResults.some((p) => p != null);
  const loadingName =
    loadingStepIndex != null && steps[loadingStepIndex] ? steps[loadingStepIndex].name : null;

  if (loadingStepIndex != null && !hasAnyResult) {
    return (
      <div className="flex h-full min-h-[160px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Response</h2>
        <div className="mt-4 flex flex-col items-center gap-2 text-slate-500">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm text-center">
            {loadingName ? (
              <>
                Sending <span className="font-medium text-slate-700">{loadingName}</span>…
              </>
            ) : (
              'Sending request…'
            )}
          </span>
        </div>
      </div>
    );
  }

  if (!hasAnyResult && loadingStepIndex == null) {
    return (
      <div className="flex h-full min-h-[160px] flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Response</h2>
        <p className="mt-4 text-sm text-slate-500">Run a step to see status, timing, and body.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full max-h-[min(70vh,720px)] min-h-[200px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <ResponseHeader
          maximized={false}
          onToggleMaximize={() => setMaximized(true)}
          loadingStepIndex={loadingStepIndex}
          loadingName={loadingName}
        />
        <ResponseStepList
          steps={steps}
          stepResults={stepResults}
          loadingStepIndex={loadingStepIndex}
          bodyMaxHeight="240px"
          balanceSheetMaxHeight="180px"
        />
      </div>

      <MaximizedPanelOverlay
        open={maximized}
        onClose={() => setMaximized(false)}
        ariaLabel="Response viewer maximized"
        maxWidthClass="max-w-6xl"
      >
        <ResponseHeader
          maximized
          onToggleMaximize={() => setMaximized(false)}
          loadingStepIndex={loadingStepIndex}
          loadingName={loadingName}
        />
        <ResponseStepList
          steps={steps}
          stepResults={stepResults}
          loadingStepIndex={loadingStepIndex}
          bodyMaxHeight="min(50vh, 480px)"
          balanceSheetMaxHeight="min(40vh, 360px)"
          className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-1"
        />
      </MaximizedPanelOverlay>
    </>
  );
};

export default ResponseViewer;
