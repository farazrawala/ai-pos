import { useEffect, useState } from 'react';
import { fetchTopSellingProductsRequest } from '../features/orders/ordersAPI.js';

/**
 * @param {{ period?: string, sortBy?: 'qty'|'revenue', limit?: number, from?: string, to?: string }} [options]
 */
export function useTopSellingProducts(options = {}) {
  const { period = 'last_30_days', sortBy = 'qty', limit = 5, from, to } = options;

  const [state, setState] = useState({
    loading: true,
    products: [],
    period: null,
    sortBy,
    total: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchTopSellingProductsRequest({
          period: from && to ? undefined : period,
          sort_by: sortBy,
          limit,
          from,
          to,
        });
        if (cancelled) return;
        setState({
          loading: false,
          products: result.products,
          period: result.period,
          sortBy: result.sortBy,
          total: result.total,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          products: [],
          period: null,
          sortBy,
          total: 0,
          error: e?.message || 'Could not load top selling products',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, sortBy, limit, from, to]);

  return state;
}
