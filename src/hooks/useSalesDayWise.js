import { useEffect, useState } from 'react';
import { fetchSalesDayWiseRequest } from '../features/orders/ordersAPI.js';

export function useSalesDayWise() {
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
        const result = await fetchSalesDayWiseRequest();
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
          error: e?.message || 'Could not load sales overview',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
