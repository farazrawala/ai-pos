import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import WorkflowList from '../components/apiWorkflow/WorkflowList.jsx';
import ApiEditor from '../components/apiWorkflow/ApiEditor.jsx';
import ResponseViewer from '../components/apiWorkflow/ResponseViewer.jsx';
import InventoryCostLedger from '../components/apiWorkflow/InventoryCostLedger.jsx';
import { interpolateDeep, interpolateUrl } from '../utils/apiWorkflow/variableReplace.js';
import { applySaveMap } from '../utils/apiWorkflow/extractFromResponse.js';
import { objectToFormData } from '../utils/apiWorkflow/formData.js';

const DEFAULT_BASE = '';

/** Short unique local part per mount: `comp_<random>@gmail.com`. */
function compRandEmail() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `comp_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}@gmail.com`;
  }
  return `comp_${Math.random().toString(36).slice(2, 11)}${Math.random().toString(36).slice(2, 7)}@gmail.com`;
}

const PRODUCT_ID_SAVE = [
  'response.data.data._id',
  'response.data.data.product._id',
  'response.data.data.product_id',
  'response.data.product._id',
  'response.data._id',
  'response.data.id',
];

const WAREHOUSE_ID_SAVE = [
  'response.data.data._id',
  'response.data.data.warehouse._id',
  'response.data.warehouse._id',
  'response.data._id',
];

const USER_ID_SAVE = [
  'response.data.data.user._id',
  'response.data.data.user.id',
  'response.data.data._id',
  'response.data.user._id',
  'response.data._id',
];

/** @param {string} name @param {string} refNo @param {number} qty @param {number} price */
function purchaseLedgerStep(name, refNo, qty, price) {
  const total = qty * price;
  return {
    name,
    method: 'POST',
    url: '{{url}}api/purchase_order/purchase_order_create',
    bodyType: 'form',
    body: {
      vendor_id: '{{vendor_id}}',
      ref_no: refNo,
      discount: '0',
      shipment: '0',
      payment_method_accounts_id: '{{payment_account_id}}',
      account_id: '{{payment_account_id}}',
      amount_paid: String(total),
      remaining_amount: '0',
      total_amount: String(total),
      'product_id[0]': '{{product_1_id}}',
      'qty[0]': String(qty),
      'price[0]': String(price),
      'warehouse_id[0]': '{{warehouse_1_id}}',
      'shipping_per_unit[0]': '0',
      'total_shipping[0]': '0',
    },
    ledger: { type: 'purchase', qty, unitCost: price },
    save: {},
  };
}

function createInitialSteps() {
  const email = compRandEmail();
  const vendorEmail = compRandEmail().replace('comp_', 'vendor_');
  return [
    {
      name: 'Create master user + company',
      method: 'POST',
      url: '{{url}}api/user/user_company',
      body: {
        name: 'Master user',
        email,
        password: email,
        company_name: 'company 1',
        address: 'new york.',
        company_email: 'company_name@gmail.com',
        permissions: {
          category: { view: true, add: true, edit: true, delete: true },
          integration: { add: true, view: true, edit: true, delete: true },
          order: { add: true, view: true, edit: true, delete: true },
          process: { add: true, view: true, edit: false, delete: false },
        },
      },
      save: {
        login_email: 'response.data.data.user.email',
        login_password: 'response.data.data.user.email',
        company_id: [
          'response.data.data.company._id',
          'response.data.data.company.id',
          'response.data.data.user.company_id',
          'response.data.data.user.company',
          'response.data.company._id',
          'response.data.company.id',
          'response.data.user.company_id',
        ],
        workflow_user_id: [
          'response.data.data.user._id',
          'response.data.data.user.id',
          'response.data.company._id',
        ],
      },
    },
    {
      name: 'Login (credentials from signup)',
      method: 'POST',
      url: '{{url}}api/user/login',
      body: {
        email: '{{login_email}}',
        password: '{{login_password}}',
      },
      save: {
        auth_token: [
          'response.data.data.token',
          'response.data.token',
          'response.data.data.user.token',
          'response.data.user.token',
        ],
        company_id: [
          'response.data.data.user.company_id',
          'response.data.data.user.company',
          'response.data.data.company._id',
          'response.data.data.company.id',
          'response.data.user.company_id',
          'response.data.company._id',
        ],
      },
    },
    {
      name: 'Create warehouse — Ware House 1 3',
      method: 'POST',
      url: '{{url}}api/warehouse/create',
      body: {
        name: 'Ware House 1',
      },
      save: {
        warehouse_1_id: WAREHOUSE_ID_SAVE,
      },
    },
    {
      name: 'Create warehouse — Ware House 2',
      method: 'POST',
      url: '{{url}}api/warehouse/create',
      body: {
        name: 'Ware House 2',
      },
      save: {},
    },
    {
      name: 'Create category — category 1',
      method: 'POST',
      url: '{{url}}api/category/create',
      body: {
        name: 'category 1',
        user_id: '{{workflow_user_id}}',
        description: 'Lorem ipsum',
      },
      save: {},
    },
    {
      name: 'Create category — category 2',
      method: 'POST',
      url: '{{url}}api/category/create',
      body: {
        name: 'category 2',
        user_id: '{{workflow_user_id}}',
        description: 'Lorem ipsum',
      },
      save: {},
    },
    {
      name: 'Create category — category 3',
      method: 'POST',
      url: '{{url}}api/category/create',
      body: {
        name: 'category 3',
        user_id: '{{workflow_user_id}}',
        description: 'Lorem ipsum',
      },
      save: {},
    },
    {
      name: 'Create product variation — product 1',
      method: 'POST',
      url: '{{url}}api/product/create-product-variation',
      body: {
        product_name: 'product 1',
        product_price: 300,
        alert_qty: 0,
        product_description: 'Lorem ipsum',
        wholesale_price: 250,
        quantity: 35,
        weight: 12,
        length: 25,
        width: 124,
      },
      save: {
        product_1_id: PRODUCT_ID_SAVE,
      },
    },
    {
      name: 'Create product variation — product 2',
      method: 'POST',
      url: '{{url}}api/product/create-product-variation',
      body: {
        product_name: 'product 2',
        product_price: 300,
        alert_qty: 0,
        product_description: 'Lorem ipsum',
        wholesale_price: 250,
        quantity: 35,
        weight: 12,
        length: 25,
        width: 124,
      },
      save: {},
    },
    {
      name: 'product 3',
      method: 'POST',
      url: '{{url}}api/product/create-product-variation',
      body: {
        product_name: 'product 3',
        product_price: 300,
        alert_qty: 0,
        product_description: 'Lorem ipsum',
        wholesale_price: 250,
        quantity: 35,
        weight: 12,
        length: 25,
        width: 124,
      },
      save: {},
    },
    {
      name: 'Create vendor',
      method: 'POST',
      url: '{{url}}api/user/create',
      body: {
        name: 'Vendor 1',
        email: vendorEmail,
        password: '123456',
        phone: '03001234567',
        role: ['VENDOR'],
      },
      save: {
        vendor_id: USER_ID_SAVE,
      },
    },
    {
      name: 'Get payment account',
      method: 'GET',
      url: '{{url}}api/account/get-all-active?limit=5&account_type=current_liability',
      body: {},
      save: {
        payment_account_id: [
          'response.data.data.0._id',
          'response.data.data.0.id',
          'response.data.0._id',
          'response.data.0.id',
        ],
      },
    },
    purchaseLedgerStep('Purchase 10 @ 200', 'PO-WAC-1', 10, 200),
    purchaseLedgerStep('Purchase 10 @ 220', 'PO-WAC-2', 10, 220),
    purchaseLedgerStep('Purchase 10 @ 250', 'PO-WAC-3', 10, 250),
    purchaseLedgerStep('Purchase 20 @ 300', 'PO-WAC-4', 20, 300),
  ];
}

const emptyStatuses = (n) => Array.from({ length: n }, () => 'pending');

/** One shared snapshot per component mount (avoids multiple `createInitialSteps()` calls with different emails). */
function useInitialRunnerSnapshot() {
  const ref = useRef(null);
  if (ref.current === null) {
    const steps = createInitialSteps();
    ref.current = {
      steps,
      statuses: emptyStatuses(steps.length),
      bodyText: JSON.stringify(steps[0]?.body ?? {}, null, 2),
      stepResults: Array.from({ length: steps.length }, () => null),
    };
  }
  return ref.current;
}

/** `{{url}}` in step URLs: API root with trailing slash (from Base URL or current browser origin). */
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

const ApiWorkflowRunner = () => {
  const initialSnapshot = useInitialRunnerSnapshot();
  const [steps, setSteps] = useState(() => initialSnapshot.steps);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [variables, setVariables] = useState({});
  const [statuses, setStatuses] = useState(() => initialSnapshot.statuses);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bodyText, setBodyText] = useState(() => initialSnapshot.bodyText);
  const [stepResults, setStepResults] = useState(() => initialSnapshot.stepResults);
  const [loadingStep, setLoadingStep] = useState(null);
  const [runningAll, setRunningAll] = useState(false);

  const variablesRef = useRef(variables);
  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  const selectedStep = steps[selectedIndex] ?? null;

  useEffect(() => {
    if (!selectedStep) return;
    setBodyText(JSON.stringify(selectedStep.body ?? {}, null, 2));
  }, [selectedIndex, steps]);

  const syncBodyToStep = useCallback(
    (text) => {
      setBodyText(text);
      try {
        const parsed = text.trim() ? JSON.parse(text) : {};
        setSteps((prev) => prev.map((s, i) => (i === selectedIndex ? { ...s, body: parsed } : s)));
      } catch {
        /* invalid JSON while typing */
      }
    },
    [selectedIndex]
  );

  const reset = useCallback(() => {
    setVariables({});
    setStatuses(emptyStatuses(steps.length));
    setStepResults(Array.from({ length: steps.length }, () => null));
    setLoadingStep(null);
    setRunningAll(false);
  }, [steps.length]);

  /**
   * Execute one step with an explicit variable snapshot (avoids stale closures in Run all).
   * @returns {{ ok: boolean, nextVariables: Record<string, unknown> }}
   */
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
        const headers = {};
        if (method !== 'GET' && method !== 'HEAD') {
          if (step.bodyType === 'form') {
            cfg.data = objectToFormData(body);
          } else {
            headers['Content-Type'] = 'application/json';
            cfg.data = body;
          }
        }
        const token = interpVars.auth_token ?? interpVars.token;
        if (typeof token === 'string' && token.trim()) {
          headers.Authorization = `Bearer ${token.trim()}`;
        }
        if (Object.keys(headers).length) {
          cfg.headers = headers;
        }

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
        if (ok && applySaves && step.save && typeof step.save === 'object') {
          nextVariables = applySaveMap(res, step.save, varsSnapshot);
          setVariables(nextVariables);
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
    [baseUrl, steps]
  );

  const runAll = useCallback(async () => {
    setRunningAll(true);
    setVariables({});
    setStepResults(Array.from({ length: steps.length }, () => null));
    setStatuses(emptyStatuses(steps.length));
    let vars = {};
    for (let i = 0; i < steps.length; i++) {
      const { ok, nextVariables } = await executeAtIndex(i, vars, { applySaves: true });
      vars = nextVariables;
      if (!ok) break;
    }
    setRunningAll(false);
  }, [executeAtIndex, steps.length]);

  const runSelected = useCallback(async () => {
    const snap = variablesRef.current;
    await executeAtIndex(selectedIndex, snap, { applySaves: true });
  }, [executeAtIndex, selectedIndex]);

  const runNext = useCallback(async () => {
    const next = selectedIndex + 1;
    if (next >= steps.length) return;
    setSelectedIndex(next);
    const snap = variablesRef.current;
    await executeAtIndex(next, snap, { applySaves: true });
  }, [executeAtIndex, selectedIndex, steps.length]);

  const busy = loadingStep !== null || runningAll;

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
              API workflow runner
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Run sequential API steps with saved variables and{' '}
              <code className="text-indigo-600">{'{{tokens}}'}</code> in URLs and JSON bodies.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAll()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run all
            </button>
            <button
              type="button"
              disabled={busy || selectedIndex < 0}
              onClick={() => void runSelected()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run this step
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
              placeholder="Empty = {{url}} uses this origin (Vite proxies /api/). Or e.g. http://localhost:8000"
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50"
            />
          </label>
          <div className="shrink-0 text-xs text-slate-500">
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono">
              Enter
            </kbd>{' '}
            runs the next step (when focus is not in a field).
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="h-[min(70vh,640px)]">
              <WorkflowList
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
            <InventoryCostLedger steps={steps} statuses={statuses} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiWorkflowRunner;
