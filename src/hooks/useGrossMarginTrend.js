import { useEffect, useState } from 'react';
import { fetchGrossMarginTrendRequest } from '../features/dashboard/financeDashboardAPI.js';

export function useGrossMarginTrend(options = {}) {
  const { weeks = 6 } = options;
  const [state, setState] = useState({
    loading: true,
    weeks: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchGrossMarginTrendRequest({ weeks });
        if (cancelled) return;
        setState({
          loading: false,
          weeks: result.weeks,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          weeks: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load margin trend',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weeks]);

  return state;
}
