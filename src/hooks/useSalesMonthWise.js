import { useEffect, useState } from 'react';
import { fetchSalesMonthWiseRequest } from '../features/orders/ordersAPI.js';

/**
 * @param {{
 *   period?: string,
 *   from?: string,
 *   to?: string,
 *   order_status?: string,
 *   timezone?: string,
 * }} [options]
 */
export function useSalesMonthWise(options = {}) {
  const { period = 'current_year', from, to, order_status, timezone } = options;

  const [state, setState] = useState({
    loading: true,
    months: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchSalesMonthWiseRequest({
          period: from && to ? undefined : period,
          from,
          to,
          order_status,
          timezone,
        });
        if (cancelled) return;
        setState({
          loading: false,
          months: result.months,
          summary: result.summary,
          period: result.period,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          months: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load monthly sales',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, from, to, order_status, timezone]);

  return state;
}
