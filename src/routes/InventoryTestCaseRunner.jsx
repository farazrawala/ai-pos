import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import TestCaseWorkflowList from '../components/apiWorkflow/TestCaseWorkflowList.jsx';
import ApiEditor from '../components/apiWorkflow/ApiEditor.jsx';
import ResponseViewer from '../components/apiWorkflow/ResponseViewer.jsx';
import TestCaseQtyLedger from '../components/apiWorkflow/TestCaseQtyLedger.jsx';
import { createInventoryTestCaseSteps } from '../utils/apiWorkflow/testCaseSteps.js';
import { interpolateDeep, interpolateUrl } from '../utils/apiWorkflow/variableReplace.js';
import { applySaveMap } from '../utils/apiWorkflow/extractFromResponse.js';
import { objectToFormData } from '../utils/apiWorkflow/formData.js';
import { resolveWorkflowAuthToken } from '../utils/apiWorkflow/authToken.js';
import { buildWorkflowRequestHeaders } from '../utils/apiWorkflow/requestHeaders.js';

const DEFAULT_BASE = '';

const emptyStatuses = (n) => Array.from({ length: n }, () => 'pending');

function useInitialRunnerSnapshot() {
  const ref = useRef(null);
  if (ref.current === null) {
    const steps = createInventoryTestCaseSteps();
    ref.current = {
      steps,
      statuses: emptyStatuses(steps.length),
      bodyText: JSON.stringify(steps[0]?.body ?? {}, null, 2),
      stepResults: Array.from({ length: steps.length }, () => null),
    };
  }
  return ref.current;
}

function buildInterpVars(varsSnapshot, baseUrlRaw) {
  const b = (baseUrlRaw ?? '').trim();
  const url =
    b === ''
      ? typeof window !== 'undefined'
        ? `${window.location.origin}/`
        : 'http://localhost/'
      : b.replace(/\/?$/, '/');
  return { url, ...varsSnapshot };
}

const InventoryTestCaseRunner = () => {
  const initialSnapshot = useInitialRunnerSnapshot();
  const [steps] = useState(() => initialSnapshot.steps);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [variables, setVariables] = useState(() => {
    const token = resolveWorkflowAuthToken({});
    return token ? { auth_token: token } : {};
  });
  const [statuses, setStatuses] = useState(() => initialSnapshot.statuses);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bodyText, setBodyText] = useState(() => initialSnapshot.bodyText);
  const [stepResults, setStepResults] = useState(() => initialSnapshot.stepResults);
  const [loadingStep, setLoadingStep] = useState(null);

  const variablesRef = useRef(variables);
  const commitVariables = useCallback((next) => {
    variablesRef.current = next;
    setVariables(next);
  }, []);

  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  const selectedStep = steps[selectedIndex] ?? null;

  useEffect(() => {
    if (!selectedStep) return;
    setBodyText(JSON.stringify(selectedStep.body ?? {}, null, 2));
  }, [selectedIndex, selectedStep]);

  const syncBodyToStep = useCallback((text) => {
    setBodyText(text);
  }, []);

  const reset = useCallback(() => {
    const token = resolveWorkflowAuthToken({});
    const initial = token ? { auth_token: token } : {};
    variablesRef.current = initial;
    setVariables(initial);
    setStatuses(emptyStatuses(steps.length));
    setStepResults(Array.from({ length: steps.length }, () => null));
    setLoadingStep(null);
    setSelectedIndex(0);
  }, [steps.length]);

  const executeAtIndex = useCallback(
    async (index, varsSnapshot, { applySaves = true } = {}) => {
      const step = steps[index];
      if (!step) return { ok: false, nextVariables: varsSnapshot };

      setLoadingStep(index);
      setStatuses((prev) => {
        const next = [...prev];
        next[index] = 'running';
        return next;
      });

      const method = (step.method || 'GET').toUpperCase();
      const interpVars = buildInterpVars(varsSnapshot, baseUrl);
      const authToken = resolveWorkflowAuthToken(interpVars);

      if (step.requiresAuth && !authToken) {
        const errPayload = {
          ok: false,
          status: null,
          statusText: 'Missing auth token',
          timeMs: 0,
          data: {
            success: false,
            message:
              'Authorization token is missing. Run "Setup: Login" successfully first (check Saved variables for auth_token), or sign in to the app so localStorage authToken is available.',
          },
          errorMessage: 'Missing auth_token — run Setup: Login first',
          headers: null,
        };
        setStepResults((prev) => {
          const next =
            prev.length === steps.length
              ? [...prev]
              : Array.from({ length: steps.length }, () => null);
          next[index] = errPayload;
          return next;
        });
        setStatuses((prev) => {
          const next = [...prev];
          next[index] = 'failed';
          return next;
        });
        setLoadingStep(null);
        return { ok: false, nextVariables: varsSnapshot };
      }

      const path = interpolateUrl(step.url, interpVars);
      const fullUrl = /^https?:\/\//i.test(path)
        ? path
        : `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

      let body;
      try {
        body = interpolateDeep(step.body ?? {}, interpVars);
      } catch (e) {
        const errPayload = {
          ok: false,
          status: null,
          statusText: 'Bad request body',
          timeMs: 0,
          data: null,
          errorMessage: e.message || String(e),
          headers: null,
        };
        setStepResults((prev) => {
          const next =
            prev.length === steps.length
              ? [...prev]
              : Array.from({ length: steps.length }, () => null);
          next[index] = errPayload;
          return next;
        });
        setStatuses((prev) => {
          const next = [...prev];
          next[index] = 'failed';
          return next;
        });
        setLoadingStep(null);
        return { ok: false, nextVariables: varsSnapshot };
      }

      const t0 = performance.now();
      try {
        const cfg = {
          method,
          url: fullUrl,
          validateStatus: () => true,
        };
        if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
          if (step.bodyType === 'form') {
            cfg.data = objectToFormData(body);
          } else {
            cfg.data = body;
          }
        }
        cfg.headers = buildWorkflowRequestHeaders({
          vars: interpVars,
          method,
          bodyType: step.bodyType,
          hasJsonBody: method !== 'GET' && method !== 'HEAD' && method !== 'DELETE' && step.bodyType !== 'form',
        });

        const res = await axios(cfg);
        const timeMs = performance.now() - t0;
        const ok = res.status >= 200 && res.status < 300;

        const payload = {
          ok,
          status: res.status,
          statusText: res.statusText,
          timeMs,
          data: res.data,
          errorMessage: ok ? null : `HTTP ${res.status}: ${res.statusText || 'Error'}`,
          headers: res.headers ? { ...res.headers } : null,
        };
        setStepResults((prev) => {
          const next =
            prev.length === steps.length
              ? [...prev]
              : Array.from({ length: steps.length }, () => null);
          next[index] = payload;
          return next;
        });

        let nextVariables = varsSnapshot;
        if (ok && applySaves) {
          nextVariables = { ...varsSnapshot };
          if (step.saveLiterals && typeof step.saveLiterals === 'object') {
            nextVariables = { ...nextVariables, ...step.saveLiterals };
          }
          if (step.save && typeof step.save === 'object') {
            nextVariables = applySaveMap(res, step.save, nextVariables);
          }
          const savedToken = resolveWorkflowAuthToken(nextVariables);
          if (savedToken && typeof window !== 'undefined') {
            localStorage.setItem('authToken', savedToken);
          }
          commitVariables(nextVariables);
        }

        setStatuses((prev) => {
          const next = [...prev];
          next[index] = ok ? 'success' : 'failed';
          return next;
        });

        setLoadingStep(null);
        return { ok, nextVariables };
      } catch (err) {
        const timeMs = performance.now() - t0;
        const res = err.response;
        const payload = {
          ok: false,
          status: res?.status ?? null,
          statusText: res?.statusText ?? 'Network error',
          timeMs,
          data: res?.data ?? { message: err.message },
          errorMessage: err.message || 'Request failed',
          headers: res?.headers ? { ...res.headers } : null,
        };
        setStepResults((prev) => {
          const next =
            prev.length === steps.length
              ? [...prev]
              : Array.from({ length: steps.length }, () => null);
          next[index] = payload;
          return next;
        });
        setStatuses((prev) => {
          const next = [...prev];
          next[index] = 'failed';
          return next;
        });
        setLoadingStep(null);
        return { ok: false, nextVariables: varsSnapshot };
      }
    },
    [baseUrl, commitVariables, steps]
  );

  const runSelected = useCallback(async () => {
    const { nextVariables } = await executeAtIndex(selectedIndex, variablesRef.current, {
      applySaves: true,
    });
    variablesRef.current = nextVariables;
  }, [executeAtIndex, selectedIndex]);

  const runNext = useCallback(async () => {
    const next = selectedIndex + 1;
    if (next >= steps.length) return;
    setSelectedIndex(next);
    const { nextVariables } = await executeAtIndex(next, variablesRef.current, {
      applySaves: true,
    });
    variablesRef.current = nextVariables;
  }, [executeAtIndex, selectedIndex, steps.length]);

  const busy = loadingStep !== null;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input' || e.target?.isContentEditable) return;
      e.preventDefault();
      if (!busy) void runNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, runNext]);

  const varsDisplay = useMemo(() => JSON.stringify(variables, null, 2), [variables]);

  return (
    <div className="container-fluid py-4">
      <div className="mx-auto max-w-[1400px] px-2">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Inventory test case runner
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Manual API checks from <code className="text-indigo-600">test_case.rb</code> — run{' '}
              <strong>Setup: Create master user + company</strong>, then <strong>Setup: Login</strong>,
              before warehouse and other authenticated steps. Expected qty is shown per step.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Also see{' '}
              <Link to="/api-workflow" className="text-indigo-600 hover:underline">
                API workflow runner
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || selectedIndex < 0}
              onClick={() => void runSelected()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run this step
            </button>
            <button
              type="button"
              disabled={busy || selectedIndex >= steps.length - 1}
              onClick={() => void runNext()}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run next step
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={reset}
              className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
            Base URL
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={busy}
              placeholder="Empty = current origin (Vite proxies /api/)"
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50"
            />
          </label>
          <div className="shrink-0 text-xs text-slate-500">
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono">
              Enter
            </kbd>{' '}
            runs the next step when focus is not in a field.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="h-[min(70vh,640px)]">
              <TestCaseWorkflowList
                steps={steps}
                statuses={statuses}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                disabled={busy}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="min-h-[280px] flex-1">
              <ApiEditor
                step={selectedStep}
                stepIndex={selectedIndex}
                bodyText={bodyText}
                onBodyChange={syncBodyToStep}
                disabled={busy}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="min-h-[200px]">
              <ResponseViewer
                steps={steps}
                stepResults={stepResults}
                loadingStepIndex={loadingStep}
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Saved variables
              </h3>
              <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] leading-relaxed text-slate-700">
                {varsDisplay}
              </pre>
            </div>
            <TestCaseQtyLedger steps={steps} statuses={statuses} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryTestCaseRunner;
