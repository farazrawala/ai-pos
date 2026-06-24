import { useEffect, useState } from 'react';
import { fetchExpensesByAccountRequest } from '../features/dashboard/expenseDashboardAPI.js';

export function useExpensesByAccount(options = {}) {
  const { period = 'last_30_days', limit = 10, from, to, timezone } = options;
  const [state, setState] = useState({
    loading: true,
    accounts: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchExpensesByAccountRequest({
          period: from && to ? undefined : period,
          limit,
          from,
          to,
          timezone,
        });
        if (cancelled) return;
        setState({
          loading: false,
          accounts: result.accounts,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          accounts: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load expenses by account',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, limit, from, to, timezone]);

  return state;
}
