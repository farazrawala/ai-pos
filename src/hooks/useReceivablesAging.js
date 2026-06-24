import { useEffect, useState } from 'react';
import { fetchReceivablesAgingRequest } from '../features/dashboard/receivablesDashboardAPI.js';

export function useReceivablesAging(options = {}) {
  const { period, from, to, timezone } = options;
  const [state, setState] = useState({
    loading: true,
    buckets: [],
    summary: null,
    asOf: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchReceivablesAgingRequest({
          period: from && to ? undefined : period,
          from,
          to,
          timezone,
        });
        if (cancelled) return;
        setState({
          loading: false,
          buckets: result.buckets,
          summary: result.summary,
          asOf: result.asOf,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          buckets: [],
          summary: null,
          asOf: null,
          period: null,
          error: e?.message || 'Could not load receivables aging',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, from, to, timezone]);

  return state;
}
