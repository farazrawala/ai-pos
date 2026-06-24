import { useEffect, useState } from 'react';
import { fetchPurchasesSummaryRequest } from '../features/dashboard/purchaseDashboardAPI.js';

export function usePurchaseSummary(options = {}) {
  const { period = 'current_month', from, to, timezone, limit } = options;
  const [state, setState] = useState({
    loading: true,
    summary: null,
    days: [],
    weeks: [],
    topVendors: [],
    dailySummary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchPurchasesSummaryRequest({
          period: from && to ? undefined : period,
          from,
          to,
          timezone,
          limit,
        });
        if (cancelled) return;
        setState({
          loading: false,
          summary: result.summary,
          days: result.days,
          weeks: result.weeks,
          topVendors: result.topVendors,
          dailySummary: result.dailySummary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          summary: null,
          days: [],
          weeks: [],
          topVendors: [],
          dailySummary: null,
          period: null,
          error: e?.message || 'Could not load purchases summary',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, from, to, timezone, limit]);

  return state;
}
