import { useEffect, useState } from 'react';
import { fetchExpenseSummaryRequest } from '../features/dashboard/expenseDashboardAPI.js';

export function useExpenseSummary(options = {}) {
  const { period = 'current_month', from, to, timezone } = options;
  const [state, setState] = useState({ loading: true, summary: null, period: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchExpenseSummaryRequest({
          period: from && to ? undefined : period,
          from,
          to,
          timezone,
        });
        if (cancelled) return;
        setState({ loading: false, summary: result.summary, period: result.period, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          summary: null,
          period: null,
          error: e?.message || 'Could not load expense summary',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, from, to, timezone]);

  return state;
}
