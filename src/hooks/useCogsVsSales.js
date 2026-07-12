import { useEffect, useState } from 'react';
import { fetchCogsVsSalesRequest } from '../features/dashboard/financeDashboardAPI.js';

export function useCogsVsSales(options = {}) {
  const { startDate, endDate } = options;
  const [state, setState] = useState({
    loading: true,
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchCogsVsSalesRequest({ startDate, endDate });
        if (cancelled) return;
        setState({
          loading: false,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          summary: null,
          period: null,
          error: e?.message || 'Could not load COGS vs sales',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return state;
}
