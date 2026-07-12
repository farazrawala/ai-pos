import { useEffect, useState } from 'react';
import { fetchInventoryValueRequest } from '../features/dashboard/financeDashboardAPI.js';

export function useInventoryValue(options = {}) {
  const { limit = 8 } = options;
  const [state, setState] = useState({
    loading: true,
    products: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchInventoryValueRequest({ limit });
        if (cancelled) return;
        setState({
          loading: false,
          products: result.products,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          products: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load inventory value',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return state;
}
