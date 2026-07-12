import { useEffect, useState } from 'react';
import { fetchDiscountTotalsRequest } from '../features/dashboard/financeDashboardAPI.js';

export function useDiscountTotals() {
  const [state, setState] = useState({
    loading: true,
    discounts: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchDiscountTotalsRequest();
        if (cancelled) return;
        setState({
          loading: false,
          discounts: result.discounts,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          discounts: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load discount totals',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
