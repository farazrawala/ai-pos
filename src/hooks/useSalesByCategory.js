import { useEffect, useState } from 'react';
import { fetchSalesByCategoryRequest } from '../features/orders/ordersAPI.js';

/** @param {{ period?: string, limit?: number, from?: string, to?: string, timezone?: string }} [options] */
export function useSalesByCategory(options = {}) {
  const { period = 'last_30_days', limit = 20, from, to, timezone } = options;

  const [state, setState] = useState({
    loading: true,
    categories: [],
    summary: null,
    period: null,
    total: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchSalesByCategoryRequest({
          period: from && to ? undefined : period,
          limit,
          from,
          to,
          timezone,
        });
        if (cancelled) return;
        setState({
          loading: false,
          categories: result.categories,
          summary: result.summary,
          period: result.period,
          total: result.total,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          categories: [],
          summary: null,
          period: null,
          total: 0,
          error: e?.message || 'Could not load sales by category',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, limit, from, to, timezone]);

  return state;
}
