import { useEffect, useState } from 'react';

const ApiEditor = ({ step, stepIndex, bodyText, onBodyChange, disabled }) => {
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    setLocalError(null);
  }, [stepIndex, bodyText]);

  const handleChange = (value) => {
    onBodyChange(value);
    try {
      if (value.trim()) JSON.parse(value);
      setLocalError(null);
    } catch (e) {
      setLocalError(e.message);
    }
  };

  if (!step) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Select a step
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Request</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded px-2 py-0.5 font-bold ${
              step.method === 'GET'
                ? 'bg-sky-100 text-sky-800'
                : step.method === 'POST'
                  ? 'bg-violet-100 text-violet-800'
                  : step.method === 'PUT'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
            }`}
          >
            {step.method}
          </span>
          <span className="font-mono text-slate-600">{step.url}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">Body (JSON)</label>
        <textarea
          value={bodyText}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          className="h-full min-h-[220px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/80 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-60"
          placeholder="{}"
        />
        {localError ? (
          <p className="mt-2 text-xs text-rose-600">JSON: {localError}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">{`Use {{variable}} in JSON; values are filled at run time.`}</p>
        )}
      </div>
    </div>
  );
};

export default ApiEditor;
