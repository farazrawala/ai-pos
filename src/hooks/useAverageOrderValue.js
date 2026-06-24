import { useEffect, useState } from 'react';
import { fetchAverageOrderValueRequest } from '../features/orders/ordersAPI.js';

/** @param {{ period?: string, from?: string, to?: string, timezone?: string }} [options] */
export function useAverageOrderValue(options = {}) {
  const { period = 'current_month', from, to, timezone } = options;

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
        const result = await fetchAverageOrderValueRequest({
          period: from && to ? undefined : period,
          from,
          to,
          timezone,
        });
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
          error: e?.message || 'Could not load average order value',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, from, to, timezone]);

  return state;
}
