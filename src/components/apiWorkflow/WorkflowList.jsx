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
  DELETE: 'text-rose-700 bg-rose-50',
};

const WorkflowList = ({ steps, statuses, selectedIndex, onSelect, disabled }) => (
  <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-4 py-3">
      <h2 className="text-sm font-semibold text-slate-800">Workflow</h2>
      <p className="text-xs text-slate-500">{steps.length} step{steps.length !== 1 ? 's' : ''}</p>
    </div>
    <ul className="min-h-0 flex-1 overflow-y-auto p-2">
      {steps.map((step, index) => {
        const status = statuses[index] ?? 'pending';
        const selected = index === selectedIndex;
        return (
          <li key={index}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(index)}
              className={[
                'mb-1 flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition',
                statusStyles[status] ?? statusStyles.pending,
                selected ? 'ring-2 ring-indigo-400 ring-offset-1' : 'hover:opacity-90',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
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
                <span className="truncate text-sm font-medium text-slate-900">{step.name}</span>
              </div>
              <span className="truncate font-mono text-[11px] text-slate-500">{step.url}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {status}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </div>
);

export default WorkflowList;
