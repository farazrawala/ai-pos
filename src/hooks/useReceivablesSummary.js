import { useEffect, useState } from 'react';
import { fetchReceivablesSummaryRequest } from '../features/dashboard/receivablesDashboardAPI.js';

export function useReceivablesSummary(options = {}) {
  const { limit = 10, period } = options;
  const [state, setState] = useState({
    loading: true,
    parties: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchReceivablesSummaryRequest({ limit, period });
        if (cancelled) return;
        setState({
          loading: false,
          parties: result.parties,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          parties: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load receivables summary',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, period]);

  return state;
}
