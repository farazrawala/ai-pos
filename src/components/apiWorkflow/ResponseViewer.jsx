function StepResponseBlock({ stepIndex, name, payload }) {
  const { ok, status, statusText, timeMs, data, errorMessage, headers } = payload;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
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
        <pre className="max-h-[240px] overflow-auto rounded-lg border border-slate-100 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-100">
          {(() => {
            try {
              return JSON.stringify(data ?? null, null, 2);
            } catch {
              return String(data);
            }
          })()}
        </pre>
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

const ResponseViewer = ({ steps = [], stepResults = [], loadingStepIndex = null }) => {
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
    <div className="flex h-full max-h-[min(70vh,720px)] min-h-[200px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Response</h2>
        <p className="mt-0.5 text-xs text-slate-500">One block per step; latest run for each index.</p>
        {loadingStepIndex != null && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900">
            <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            <span>
              Running{' '}
              <span className="font-semibold">{loadingName || `step ${loadingStepIndex + 1}`}</span>…
            </span>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
        {stepResults.map((payload, i) => {
          if (!payload) return null;
          const name = steps[i]?.name ?? `Step ${i + 1}`;
          return <StepResponseBlock key={i} stepIndex={i} name={name} payload={payload} />;
        })}
      </div>
    </div>
  );
};

export default ResponseViewer;
