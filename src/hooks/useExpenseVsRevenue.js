import { useEffect, useState } from 'react';
import { fetchExpenseVsRevenueRequest } from '../features/dashboard/expenseDashboardAPI.js';

export function useExpenseVsRevenue(options = {}) {
  const { period = 'current_month', from, to, timezone } = options;
  const [state, setState] = useState({
    loading: true,
    days: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchExpenseVsRevenueRequest({
          period: from && to ? undefined : period,
          from,
          to,
          timezone,
        });
        if (cancelled) return;
        setState({
          loading: false,
          days: result.days,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          days: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load expense vs revenue',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, from, to, timezone]);

  return state;
}
