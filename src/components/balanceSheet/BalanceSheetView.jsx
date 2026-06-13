import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { BalanceSheetSummaryBar } from './BalanceSheetSummaryBar.jsx';
import { formatCurrencyAccounting } from './formatCurrency.js';
import {
  buildFetchAccountsByTypeUrl,
  fetchAccountsByTypeRequest,
} from '../../features/accounts/accountsAPI.js';
import {
  buildBalanceSheetAdjustmentsUrl,
  buildBalanceSheetDefaultDiscountSumsUrl,
  buildBalanceSheetEquityFetchParams,
  buildBalanceSheetInventoryCogUrl,
  buildBalanceSheetProfitUrl,
  buildBalanceSheetSalesReturnProfitUrl,
  fetchBalanceSheetAdjustmentsRequest,
  fetchBalanceSheetDefaultDiscountSumsRequest,
  fetchBalanceSheetInventoryCogRequest,
  fetchBalanceSheetProfitRequest,
  fetchBalanceSheetSalesReturnProfitRequest,
} from '../../features/balanceSheet/balanceSheetAPI.js';
import { selectAuthUser, selectCompany } from '../../features/user/userSlice.js';
import DevApiSourcesFooter from '../common/DevApiSourcesFooter.jsx';
import {
  buildCompanyRemoveCacheUrl,
  removeCompanyCacheRequest,
} from '../../features/company/companyAPI.js';
import { usePageApiSources } from '../../hooks/usePageApiSources.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import {
  buildPendingApiSources,
  trackApiCallsSequential,
} from '../../utils/pageApiSources.js';
import '../common/devApiSources.css';
import './balanceSheetGl.css';
import './balanceSheetDark.css';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function startOfCalendarMonth(year, month1to12) {
  return new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
}

function endOfCalendarMonth(year, month1to12) {
  return new Date(year, month1to12, 0, 23, 59, 59, 999);
}

function compareMonthYear(y1, m1, y2, m2) {
  if (y1 !== y2) return y1 - y2;
  return m1 - m2;
}

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function quarterLabelIfExact(periodStart, periodEnd) {
  const y = periodStart.getFullYear();
  if (y !== periodEnd.getFullYear()) return null;
  if (periodStart.getDate() !== 1) return null;
  const sm = periodStart.getMonth();
  const em = periodEnd.getMonth();
  const q = Math.floor(sm / 3);
  if (sm !== q * 3 || em !== q * 3 + 2) return null;
  const quarterEnd = new Date(y, q * 3 + 3, 0);
  if (!sameCalendarDay(periodEnd, quarterEnd)) return null;
  return `Q${q + 1} ${y}`;
}

function sumLines(lines) {
  return lines.reduce((acc, row) => acc + row.amount, 0);
}

function formatCompactMillions(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(x / 1_000).toFixed(2)}K`;
  return formatCurrencyAccounting(x);
}

/** Emphasis for select lines (inventory, certain debt / deferrals), matching dashboard mock. */
function lineAmountClassName(label, sectionTitle) {
  const l = String(label || '').toLowerCase();
  const t = String(sectionTitle || '').toLowerCase();
  if (t.includes('inventory')) return 'bs-gl-amt-warn';
  if (t.includes('current liabilit')) {
    if (
      l.includes('debt') ||
      l.includes('loan') ||
      l.includes('borrowing') ||
      l.includes('line of credit') ||
      l.includes('note payable')
    ) {
      return 'bs-gl-amt-warn';
    }
  }
  if (t.includes('long-term') && (l.includes('defer') || l.includes('deferred')))
    return 'bs-gl-amt-warn';
  return '';
}

function GlStatementPanel({ variant, heading, periodSuffix, groups, grandTotal, grandLabel }) {
  const hdClass = variant === 'assets' ? 'assets' : 'le';
  const [expanded, setExpanded] = useState(() => new Set(groups.map((g) => g.title)));

  useEffect(() => {
    setExpanded(new Set(groups.map((g) => g.title)));
  }, [groups]);

  const toggle = (title) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div className="bs-gl-panel">
      <div className={`bs-gl-panel-hd ${hdClass}`}>
        {heading}
        <span className="period"> · {periodSuffix}</span>
      </div>
      <table className="bs-gl-table">
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const open = expanded.has(g.title);
            return (
              <Fragment key={g.title}>
                <tr
                  className="bs-gl-section"
                  onClick={() => toggle(g.title)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(g.title);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={open}
                >
                  <td>
                    <span className="bs-gl-chevron" aria-hidden>
                      {open ? '▼' : '▶'}
                    </span>
                    {g.title}
                  </td>
                  <td className="num">{formatCurrencyAccounting(g.subtotal)}</td>
                </tr>
                {open ? (
                  <>
                    {g.lines.map((row, lineIdx) => (
                      <tr
                        key={row.id || `${g.title}-${row.label}-${lineIdx}`}
                        className="bs-gl-line"
                      >
                        <td>{row.label}</td>
                        <td className={`num ${lineAmountClassName(row.label, g.title)}`}>
                          {formatCurrencyAccounting(row.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bs-gl-subtotal">
                      <td>Subtotal</td>
                      <td className="num">{formatCurrencyAccounting(g.subtotal)}</td>
                    </tr>
                  </>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>{grandLabel}</td>
            <td className="num">{formatCurrencyAccounting(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * @param {'credit_minus_debit' | 'net_debit_minus_credit'} amountSource — assets use net_debit_minus_credit; L&E use credit_minus_debit.
 */
function mapAccountToLine(account, amountSource = 'credit_minus_debit') {
  const sum = account.transactions_sum ?? account.transactionsSum;
  const raw =
    amountSource === 'net_debit_minus_credit'
      ? (sum?.net_debit_minus_credit ?? sum?.netDebitMinusCredit)
      : (sum?.credit_minus_debit ?? sum?.creditMinusDebit);
  const amount = Number(raw);
  return {
    id: account._id || account.id,
    label: account.name || '—',
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

const REMOVE_COMPANY_CACHE_DEFINITION = {
  key: 'remove_cache',
  label: 'Clear company cache',
  url: buildCompanyRemoveCacheUrl(),
  fetch: () => removeCompanyCacheRequest(),
};

function createBalanceSheetApiDefinitions(equityFetchParams = {}) {
  const equityParams =
    equityFetchParams.exclude_id != null && String(equityFetchParams.exclude_id).trim() !== ''
      ? { exclude_id: String(equityFetchParams.exclude_id).trim() }
      : {};

  return [
    {
      key: 'current_asset',
      label: 'Current assets',
      url: buildFetchAccountsByTypeUrl('current_asset'),
      fetch: () => fetchAccountsByTypeRequest('current_asset'),
    },
    {
      key: 'equity',
      label: 'Equity',
      url: buildFetchAccountsByTypeUrl('equity', equityParams),
      fetch: () => fetchAccountsByTypeRequest('equity', equityParams),
    },
    {
      key: 'operating_expense',
      label: "Owner's equity (operating expenses)",
      url: buildFetchAccountsByTypeUrl('operating_expense'),
      fetch: () => fetchAccountsByTypeRequest('operating_expense'),
    },
    {
      key: 'other_expense',
      label: "Owner's equity (other expenses)",
      url: buildFetchAccountsByTypeUrl('other_expense'),
      fetch: () => fetchAccountsByTypeRequest('other_expense'),
    },
    {
      key: 'profit',
      label: "Owner's equity (profit)",
      url: buildBalanceSheetProfitUrl(),
      fetch: () => fetchBalanceSheetProfitRequest(),
    },
    {
      key: 'sales_return_profit',
      label: "Owner's equity (sales return profit)",
      url: buildBalanceSheetSalesReturnProfitUrl(),
      fetch: () => fetchBalanceSheetSalesReturnProfitRequest(),
    },
    {
      key: 'adjustments',
      label: "Owner's equity (adjustments)",
      url: buildBalanceSheetAdjustmentsUrl(),
      fetch: () => fetchBalanceSheetAdjustmentsRequest(),
    },
    {
      key: 'default_discount_sums',
      label: "Owner's equity (discounts)",
      url: buildBalanceSheetDefaultDiscountSumsUrl(),
      fetch: () => fetchBalanceSheetDefaultDiscountSumsRequest(),
    },
    {
      key: 'current_liability',
      label: 'Current liabilities',
      url: buildFetchAccountsByTypeUrl('current_liability'),
      fetch: () => fetchAccountsByTypeRequest('current_liability'),
    },
    {
      key: 'long_term_liability',
      label: 'Long-term liabilities',
      url: buildFetchAccountsByTypeUrl('long_term_liability'),
      fetch: () => fetchAccountsByTypeRequest('long_term_liability'),
    },
    {
      key: 'fixed_asset',
      label: 'Fixed assets',
      url: buildFetchAccountsByTypeUrl('fixed_asset'),
      fetch: () => fetchAccountsByTypeRequest('fixed_asset'),
    },
    {
      key: 'inventory',
      label: 'Inventory (cost of goods)',
      url: buildBalanceSheetInventoryCogUrl(),
      fetch: () => fetchBalanceSheetInventoryCogRequest(),
    },
  ];
}

function apiResult(results, key) {
  return results.find((r) => r.key === key);
}

export default function BalanceSheetView() {
  useRequireModuleAccess('balance-sheet');
  const authUser = useSelector(selectAuthUser);
  const authCompany = useSelector(selectCompany);
  const {
    sources: apiSources,
    wallDurationMs,
    setSources: setApiSources,
    setWallDurationMs,
  } = usePageApiSources();
  const [fromYear, setFromYear] = useState(() => new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState(() => new Date().getMonth() + 1);
  const [toYear, setToYear] = useState(() => new Date().getFullYear());
  const [toMonth, setToMonth] = useState(() => new Date().getMonth() + 1);
  const [currentAssetLines, setCurrentAssetLines] = useState([]);
  const [currentAssetsStatus, setCurrentAssetsStatus] = useState({ loading: true, error: null });
  const [equityLines, setEquityLines] = useState([]);
  const [equityStatus, setEquityStatus] = useState({ loading: true, error: null });
  const [currentLiabilityLines, setCurrentLiabilityLines] = useState([]);
  const [currentLiabilitiesStatus, setCurrentLiabilitiesStatus] = useState({
    loading: true,
    error: null,
  });
  const [longTermLiabilityLines, setLongTermLiabilityLines] = useState([]);
  const [longTermLiabilitiesStatus, setLongTermLiabilitiesStatus] = useState({
    loading: true,
    error: null,
  });
  const [fixedAssetLines, setFixedAssetLines] = useState([]);
  const [fixedAssetsStatus, setFixedAssetsStatus] = useState({ loading: true, error: null });
  const [inventoryLines, setInventoryLines] = useState([]);
  /** Subtotal for Inventory section; from API `grand_total_cost_of_goods`. */
  const [inventoryGrandTotal, setInventoryGrandTotal] = useState(0);
  const [inventoryStatus, setInventoryStatus] = useState({ loading: true, error: null });
  const [loadProgress, setLoadProgress] = useState({
    active: false,
    percent: 0,
    label: '',
    completed: 0,
    total: 0,
  });

  const periodStart = useMemo(
    () => startOfCalendarMonth(fromYear, fromMonth),
    [fromYear, fromMonth]
  );
  const periodEnd = useMemo(() => endOfCalendarMonth(toYear, toMonth), [toYear, toMonth]);

  const rangeLabel = useMemo(() => {
    const my = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
    const a = my.format(periodStart);
    const b = my.format(periodEnd);
    if (a === b) return a;
    return `${a} – ${b}`;
  }, [periodStart, periodEnd]);

  const rangeDetail = useMemo(() => {
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
    return `${df.format(periodStart)} – ${df.format(periodEnd)}`;
  }, [periodStart, periodEnd]);

  const periodSuffix = useMemo(() => {
    const q = quarterLabelIfExact(periodStart, periodEnd);
    return q || rangeLabel;
  }, [periodStart, periodEnd, rangeLabel]);

  const asOfLabel = useMemo(() => {
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
    return df.format(periodEnd);
  }, [periodEnd]);

  const quarterExact = useMemo(
    () => quarterLabelIfExact(periodStart, periodEnd),
    [periodStart, periodEnd]
  );

  const setFrom = (y, m) => {
    setFromYear(y);
    setFromMonth(m);
    if (compareMonthYear(y, m, toYear, toMonth) > 0) {
      setToYear(y);
      setToMonth(m);
    }
  };

  const setTo = (y, m) => {
    setToYear(y);
    setToMonth(m);
    if (compareMonthYear(fromYear, fromMonth, y, m) > 0) {
      setFromYear(y);
      setFromMonth(m);
    }
  };

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y - 10; i <= y + 2; i += 1) out.push(i);
    return out;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCurrentAssetsStatus({ loading: true, error: null });
      setEquityStatus({ loading: true, error: null });
      setCurrentLiabilitiesStatus({ loading: true, error: null });
      setLongTermLiabilitiesStatus({ loading: true, error: null });
      setFixedAssetsStatus({ loading: true, error: null });
      setInventoryStatus({ loading: true, error: null });
      setInventoryGrandTotal(0);
      setLoadProgress({
        active: true,
        percent: 0,
        label: 'Preparing balance sheet…',
        completed: 0,
        total: 0,
      });

      const equityFetchParams = await buildBalanceSheetEquityFetchParams(authUser, authCompany);
      if (cancelled) return;

      const sheetApiDefinitions = createBalanceSheetApiDefinitions(equityFetchParams);
      const allApiDefinitions = [REMOVE_COMPANY_CACHE_DEFINITION, ...sheetApiDefinitions];
      const totalSteps = allApiDefinitions.length;

      let pendingSources = buildPendingApiSources(allApiDefinitions);
      setApiSources(pendingSources);

      const wallStart = performance.now();

      const markSourceStatus = (key, status) => {
        pendingSources = pendingSources.map((s) => (s.key === key ? { ...s, status } : s));
        setApiSources([...pendingSources]);
      };

      const applySourceResult = (result) => {
        pendingSources = pendingSources.map((s) =>
          s.key === result.key
            ? {
                key: result.key,
                label: result.label,
                url: result.url,
                status: result.status,
                durationMs: result.durationMs,
                error: result.error,
              }
            : s
        );
        setApiSources([...pendingSources]);
      };

      setLoadProgress({
        active: true,
        percent: 0,
        label: allApiDefinitions[0].label,
        completed: 0,
        total: totalSteps,
      });

      const { results: apiResults } = await trackApiCallsSequential(allApiDefinitions, {
        stopOnFirstError: true,
        onStepStart: ({ index, total, definition }) => {
          if (cancelled) return;
          markSourceStatus(definition.key ?? definition.label, 'loading');
          setLoadProgress({
            active: true,
            percent: Math.round((index / total) * 100),
            label: definition.label,
            completed: index,
            total,
          });
        },
        onStepComplete: ({ index, total, result }) => {
          if (cancelled) return;
          applySourceResult(result);
          setLoadProgress({
            active: true,
            percent: Math.round(((index + 1) / total) * 100),
            label:
              index + 1 < total
                ? allApiDefinitions[index + 1].label
                : 'Applying balance sheet data…',
            completed: index + 1,
            total,
          });
        },
      });

      if (cancelled) return;

      setWallDurationMs(Math.round(performance.now() - wallStart));
      setLoadProgress((prev) => ({ ...prev, active: false, percent: 100, label: 'Ready' }));

      const cacheResult = apiResults[0];
      if (!cacheResult || cacheResult.status !== 'success') {
        const cacheErr = cacheResult?.error || 'Failed to clear company cache';
        const failed = { loading: false, error: cacheErr };
        setLoadProgress((prev) => ({ ...prev, active: false }));
        setCurrentAssetsStatus(failed);
        setEquityStatus(failed);
        setCurrentLiabilitiesStatus(failed);
        setLongTermLiabilitiesStatus(failed);
        setFixedAssetsStatus(failed);
        setInventoryStatus(failed);
        return;
      }

      const results = apiResults.slice(1);

      const currentRes = apiResult(results, 'current_asset');
      if (currentRes?.status === 'success') {
        const list = currentRes.value;
        setCurrentAssetLines(
          Array.isArray(list) ? list.map((a) => mapAccountToLine(a, 'net_debit_minus_credit')) : []
        );
        setCurrentAssetsStatus({ loading: false, error: null });
      } else {
        setCurrentAssetLines([]);
        setCurrentAssetsStatus({
          loading: false,
          error: currentRes?.error || 'Failed to load current assets',
        });
      }

      const equityRes = apiResult(results, 'equity');
      const operatingExpenseRes = apiResult(results, 'operating_expense');
      const otherExpenseRes = apiResult(results, 'other_expense');
      const profitRes = apiResult(results, 'profit');
      const salesReturnProfitRes = apiResult(results, 'sales_return_profit');
      const adjustmentsRes = apiResult(results, 'adjustments');
      const defaultDiscountSumsRes = apiResult(results, 'default_discount_sums');
      const equityAccounts =
        equityRes?.status === 'success' && Array.isArray(equityRes.value) ? equityRes.value : [];
      const operatingExpenseAccounts =
        operatingExpenseRes?.status === 'success' && Array.isArray(operatingExpenseRes.value)
          ? operatingExpenseRes.value
          : [];
      const otherExpenseAccounts =
        otherExpenseRes?.status === 'success' && Array.isArray(otherExpenseRes.value)
          ? otherExpenseRes.value
          : [];

      const equityOk = equityRes?.status === 'success';
      const operatingExpenseOk = operatingExpenseRes?.status === 'success';
      const otherExpenseOk = otherExpenseRes?.status === 'success';

      if (equityOk && operatingExpenseOk && otherExpenseOk) {
        const equityAccountLines = equityAccounts.map(mapAccountToLine);
        const expenseDeductionLines = operatingExpenseAccounts.map((account) =>
          mapAccountToLine(account, 'credit_minus_debit')
        );
        const otherExpenseDeductionLines = otherExpenseAccounts.map((account) =>
          mapAccountToLine(account, 'credit_minus_debit')
        );
        const profitLines = [];
        if (profitRes?.status === 'success' && profitRes.value) {
          const profitNum = Number(profitRes.value.profit);
          if (Number.isFinite(profitNum)) {
            profitLines.push({
              id: 'order-profit-by-order-item',
              label: 'Profit',
              amount: profitNum,
            });
          }
        }
        const salesReturnProfitLines = [];
        if (salesReturnProfitRes?.status === 'success' && salesReturnProfitRes.value) {
          const salesReturnProfitNum = Number(salesReturnProfitRes.value.profit);
          if (Number.isFinite(salesReturnProfitNum)) {
            salesReturnProfitLines.push({
              id: 'sales-return-profit-by-item',
              label: 'Sales Return Profit',
              amount: salesReturnProfitNum,
            });
          }
        }
        const adjustmentLines =
          adjustmentsRes?.status === 'success' && Array.isArray(adjustmentsRes.value?.lines)
            ? adjustmentsRes.value.lines
            : [];
        const discountLines =
          defaultDiscountSumsRes?.status === 'success' &&
          Array.isArray(defaultDiscountSumsRes.value?.lines)
            ? defaultDiscountSumsRes.value.lines
            : [];
        const discountIds = new Set(discountLines.map((line) => String(line.id)));
        const withoutDuplicateDiscounts = (lines) =>
          lines.filter((line) => !discountIds.has(String(line.id)));
        setEquityLines([
          ...withoutDuplicateDiscounts(equityAccountLines),
          ...profitLines,
          ...salesReturnProfitLines,
          ...adjustmentLines,
          ...discountLines,
          ...withoutDuplicateDiscounts(expenseDeductionLines),
          ...withoutDuplicateDiscounts(otherExpenseDeductionLines),
        ]);
        const profitErr = profitRes?.status === 'error' ? profitRes.error : null;
        const salesReturnProfitErr =
          salesReturnProfitRes?.status === 'error' ? salesReturnProfitRes.error : null;
        const adjustmentErr = adjustmentsRes?.status === 'error' ? adjustmentsRes.error : null;
        const discountErr =
          defaultDiscountSumsRes?.status === 'error' ? defaultDiscountSumsRes.error : null;
        setEquityStatus({
          loading: false,
          error:
            [profitErr, salesReturnProfitErr, adjustmentErr, discountErr].filter(Boolean).join(' · ') ||
            null,
        });
      } else {
        setEquityLines([]);
        const equityErr = equityRes?.status === 'error' ? equityRes.error : null;
        const expenseErr =
          operatingExpenseRes?.status === 'error' ? operatingExpenseRes.error : null;
        const otherExpenseErr =
          otherExpenseRes?.status === 'error' ? otherExpenseRes.error : null;
        const profitErr = profitRes?.status === 'error' ? profitRes.error : null;
        const salesReturnProfitErr =
          salesReturnProfitRes?.status === 'error' ? salesReturnProfitRes.error : null;
        const adjustmentErr = adjustmentsRes?.status === 'error' ? adjustmentsRes.error : null;
        const discountErr =
          defaultDiscountSumsRes?.status === 'error' ? defaultDiscountSumsRes.error : null;
        setEquityStatus({
          loading: false,
          error:
            [
              equityErr,
              expenseErr,
              otherExpenseErr,
              profitErr,
              salesReturnProfitErr,
              adjustmentErr,
              discountErr,
            ]
              .filter(Boolean)
              .join(' · ') || 'Failed to load equity',
        });
      }

      const currentLiabilityRes = apiResult(results, 'current_liability');
      if (currentLiabilityRes?.status === 'success') {
        const list = currentLiabilityRes.value;
        setCurrentLiabilityLines(Array.isArray(list) ? list.map(mapAccountToLine) : []);
        setCurrentLiabilitiesStatus({ loading: false, error: null });
      } else {
        setCurrentLiabilityLines([]);
        setCurrentLiabilitiesStatus({
          loading: false,
          error: currentLiabilityRes?.error || 'Failed to load current liabilities',
        });
      }

      const longTermLiabilityRes = apiResult(results, 'long_term_liability');
      if (longTermLiabilityRes?.status === 'success') {
        const list = longTermLiabilityRes.value;
        setLongTermLiabilityLines(Array.isArray(list) ? list.map(mapAccountToLine) : []);
        setLongTermLiabilitiesStatus({ loading: false, error: null });
      } else {
        setLongTermLiabilityLines([]);
        setLongTermLiabilitiesStatus({
          loading: false,
          error: longTermLiabilityRes?.error || 'Failed to load long-term liabilities',
        });
      }

      const fixedAssetRes = apiResult(results, 'fixed_asset');
      if (fixedAssetRes?.status === 'success') {
        const list = fixedAssetRes.value;
        setFixedAssetLines(
          Array.isArray(list) ? list.map((a) => mapAccountToLine(a, 'net_debit_minus_credit')) : []
        );
        setFixedAssetsStatus({ loading: false, error: null });
      } else {
        setFixedAssetLines([]);
        setFixedAssetsStatus({
          loading: false,
          error: fixedAssetRes?.error || 'Failed to load fixed assets',
        });
      }

      const inventoryRes = apiResult(results, 'inventory');
      if (inventoryRes?.status === 'success') {
        const { lines, grandTotal } = inventoryRes.value;
        setInventoryLines(Array.isArray(lines) ? lines : []);
        const gt = Number(grandTotal);
        setInventoryGrandTotal(Number.isFinite(gt) ? gt : 0);
        setInventoryStatus({ loading: false, error: null });
      } else {
        setInventoryLines([]);
        setInventoryGrandTotal(0);
        setInventoryStatus({
          loading: false,
          error: inventoryRes?.error || 'Failed to load inventory',
        });
      }
    })();
    return () => {
      cancelled = true;
      setLoadProgress((prev) => ({ ...prev, active: false }));
    };
  }, [authUser, authCompany, setApiSources, setWallDurationMs]);

  const sheetData = useMemo(
    () => ({
      assets: {
        current: currentAssetLines,
        inventory: inventoryLines,
        nonCurrent: fixedAssetLines,
      },
      liabilities: {
        current: currentLiabilityLines,
        longTerm: longTermLiabilityLines,
      },
      equity: equityLines,
    }),
    [
      currentAssetLines,
      inventoryLines,
      currentLiabilityLines,
      longTermLiabilityLines,
      equityLines,
      fixedAssetLines,
    ]
  );

  const {
    totalCurrentAssets,
    totalInventory,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalLongTermLiabilities,
    totalLiabilities,
    totalEquity,
    liabilitiesPlusEquity,
    difference,
    balanced,
  } = useMemo(() => {
    const data = sheetData;
    const totalCurrentAssets = sumLines(data.assets.current);
    const totalInventory = inventoryGrandTotal;
    const totalNonCurrentAssets = sumLines(data.assets.nonCurrent);
    const totalAssets = totalCurrentAssets + totalInventory + totalNonCurrentAssets;

    const totalCurrentLiabilities = sumLines(data.liabilities.current);
    const totalLongTermLiabilities = sumLines(data.liabilities.longTerm);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalEquity = sumLines(data.equity);
    const liabilitiesPlusEquity = totalLiabilities + totalEquity;
    const difference = totalAssets - liabilitiesPlusEquity;
    const balanced = Math.abs(difference) < 0.005;

    return {
      totalCurrentAssets,
      totalInventory,
      totalNonCurrentAssets,
      totalAssets,
      totalCurrentLiabilities,
      totalLongTermLiabilities,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity,
      difference,
      balanced,
    };
  }, [sheetData, inventoryGrandTotal]);

  const assetGroups = useMemo(
    () => [
      {
        title: 'Current assets',
        lines: sheetData.assets.current,
        subtotal: totalCurrentAssets,
      },
      {
        title: 'Inventory',
        lines: sheetData.assets.inventory,
        subtotal: totalInventory,
      },
      {
        title: 'Non-current assets',
        lines: sheetData.assets.nonCurrent,
        subtotal: totalNonCurrentAssets,
      },
    ],
    [sheetData, totalCurrentAssets, totalInventory, totalNonCurrentAssets]
  );

  const liabilityEquityGroups = useMemo(
    () => [
      {
        title: 'Current liabilities',
        lines: sheetData.liabilities.current,
        subtotal: totalCurrentLiabilities,
      },
      {
        title: 'Long-term liabilities',
        lines: sheetData.liabilities.longTerm,
        subtotal: totalLongTermLiabilities,
      },
      {
        title: "Owner's equity",
        lines: sheetData.equity,
        subtotal: totalEquity,
      },
    ],
    [sheetData, totalCurrentLiabilities, totalLongTermLiabilities, totalEquity]
  );

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12 px-3 px-md-4 py-2">
          <div className="bs-bs-dark">
            <div className="bs-gl-frame">
              <div className="bs-gl">
                {(currentAssetsStatus.loading ||
                  equityStatus.loading ||
                  currentLiabilitiesStatus.loading ||
                  longTermLiabilitiesStatus.loading ||
                  fixedAssetsStatus.loading ||
                  inventoryStatus.loading) &&
                  loadProgress.active && (
                    <div className="bs-gl-load-progress-wrap">
                      <div className="bs-gl-load-progress" role="status" aria-live="polite">
                        <div className="bs-gl-load-progress-head">
                          <span className="bs-gl-load-progress-label">{loadProgress.label}</span>
                          <span className="bs-gl-load-progress-pct">{loadProgress.percent}%</span>
                        </div>
                        <div
                          className="progress progress-sm"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={loadProgress.percent}
                          aria-label="Balance sheet loading progress"
                        >
                          <div
                            className="progress-bar"
                            style={{ width: `${loadProgress.percent}%` }}
                          />
                        </div>
                        {loadProgress.total > 0 ? (
                          <div className="bs-gl-load-progress-meta">
                            {loadProgress.completed} of {loadProgress.total} requests
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                <div className="bs-bs-hero">
                  <h1>
                    Consolidated financial position{' '}
                    <span className="bs-bs-hero-muted">(assets vs liabilities)</span>
                    {quarterExact ? (
                      <>
                        {' '}
                        | {quarterExact}{' '}
                        <span className="bs-bs-hero-muted">(ending {asOfLabel})</span>
                      </>
                    ) : (
                      <>
                        {' '}
                        | <span className="bs-bs-hero-muted">{rangeDetail}</span>
                      </>
                    )}
                  </h1>
                </div>

                <div className="bs-bs-balance-strip">
                  Balance: ({formatCurrencyAccounting(difference)}){' '}
                  <span className={balanced ? 'ok' : 'bad'}>
                    {balanced ? 'Check · OK' : 'Check · review'}
                  </span>
                </div>

                <div className="bs-bs-kpi-row">
                  <div className="bs-bs-kpi-card">
                    <div className="lbl">Total assets</div>
                    <div className="val">{formatCompactMillions(totalAssets)}</div>
                  </div>
                  <div className="bs-bs-kpi-card">
                    <div className="lbl">Total liabilities & equity</div>
                    <div className="val">{formatCompactMillions(liabilitiesPlusEquity)}</div>
                  </div>
                </div>

                <div className="bs-gl-toolbar">
                  <div className="bs-gl-toolbar-title">
                    <h1>Reporting period</h1>
                    <div className="bs-gl-sub">As of {asOfLabel} · Accrual basis (sample)</div>
                  </div>
                  <div className="bs-gl-filters">
                    <div className="bs-gl-fg">
                      <span>From</span>
                      <div className="d-flex gap-1">
                        <select
                          className="form-select form-select-sm"
                          value={String(fromMonth)}
                          onChange={(e) => setFrom(fromYear, parseInt(e.target.value, 10))}
                          aria-label="From month"
                        >
                          {MONTH_NAMES.map((name, idx) => (
                            <option key={name} value={String(idx + 1)}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="form-select form-select-sm"
                          value={String(fromYear)}
                          onChange={(e) => setFrom(parseInt(e.target.value, 10), fromMonth)}
                          aria-label="From year"
                        >
                          {yearOptions.map((y) => (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="bs-gl-fg">
                      <span>To</span>
                      <div className="d-flex gap-1">
                        <select
                          className="form-select form-select-sm"
                          value={String(toMonth)}
                          onChange={(e) => setTo(toYear, parseInt(e.target.value, 10))}
                          aria-label="To month"
                        >
                          {MONTH_NAMES.map((name, idx) => (
                            <option key={name} value={String(idx + 1)}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="form-select form-select-sm"
                          value={String(toYear)}
                          onChange={(e) => setTo(parseInt(e.target.value, 10), toMonth)}
                          aria-label="To year"
                        >
                          {yearOptions.map((y) => (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bs-gl-meta">
                    <span className="bs-gl-meta-label">Reporting range</span>
                    <span className="bs-gl-meta-value">{rangeDetail}</span>
                  </div>
                  {currentAssetsStatus.error && (
                    <div className="text-danger small">{currentAssetsStatus.error}</div>
                  )}
                  {inventoryStatus.error && (
                    <div className="text-danger small">{inventoryStatus.error}</div>
                  )}
                  {equityStatus.error && (
                    <div className="text-danger small">{equityStatus.error}</div>
                  )}
                  {currentLiabilitiesStatus.error && (
                    <div className="text-danger small">{currentLiabilitiesStatus.error}</div>
                  )}
                  {longTermLiabilitiesStatus.error && (
                    <div className="text-danger small">{longTermLiabilitiesStatus.error}</div>
                  )}
                  {fixedAssetsStatus.error && (
                    <div className="text-danger small">{fixedAssetsStatus.error}</div>
                  )}
                </div>

                <div className="bs-gl-panels">
                  <GlStatementPanel
                    variant="assets"
                    heading="Asset breakdown"
                    periodSuffix={periodSuffix}
                    groups={assetGroups}
                    grandTotal={totalAssets}
                    grandLabel="Total assets"
                  />
                  <GlStatementPanel
                    variant="le"
                    heading="Liabilities & equity breakdown"
                    periodSuffix={periodSuffix}
                    groups={liabilityEquityGroups}
                    grandTotal={liabilitiesPlusEquity}
                    grandLabel="Total liabilities & equity"
                  />
                </div>

                <div className={`bs-gl-status ${balanced ? 'ok' : 'warn'}`}>
                  <span>
                    <strong>Equation check:</strong> Assets ({formatCurrencyAccounting(totalAssets)}
                    ) = Liabilities + equity ({formatCurrencyAccounting(liabilitiesPlusEquity)})
                  </span>
                  <span>
                    {balanced ? (
                      <span className="bs-gl-pill bs-gl-pill-success">In balance</span>
                    ) : (
                      <span className="bs-gl-pill bs-gl-pill-warn">
                        Out of balance · {formatCurrencyAccounting(difference)}
                      </span>
                    )}
                  </span>
                </div>

                <BalanceSheetSummaryBar
                  totalAssets={totalAssets}
                  liabilitiesPlusEquity={liabilitiesPlusEquity}
                  difference={difference}
                  formatCurrency={formatCurrencyAccounting}
                />

                <DevApiSourcesFooter
                  className="bs-gl-api-sources"
                  sources={apiSources}
                  wallDurationMs={wallDurationMs}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
