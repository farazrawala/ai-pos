import { useEffect, useState } from 'react';
import { fetchAccountsReceivableSummaryRequest } from '../features/dashboard/receivablesDashboardAPI.js';

export function useAccountsReceivableSummary(options = {}) {
  const { period = 'current_month', from, to, timezone } = options;
  const [state, setState] = useState({ loading: true, summary: null, period: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchAccountsReceivableSummaryRequest({
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
          error: e?.message || 'Could not load accounts receivable summary',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, from, to, timezone]);

  return state;
}
