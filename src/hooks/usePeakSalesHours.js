import { useEffect, useState } from 'react';
import { fetchPeakSalesHoursRequest } from '../features/orders/ordersAPI.js';

/**
 * @param {{ period?: string, peakBy?: 'order_count'|'total_amount', from?: string, to?: string, timezone?: string }} [options]
 */
export function usePeakSalesHours(options = {}) {
  const { period = 'last_30_days', peakBy = 'order_count', from, to, timezone } = options;

  const [state, setState] = useState({
    loading: true,
    hours: [],
    summary: null,
    period: null,
    peakBy: peakBy,
    timezone: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchPeakSalesHoursRequest({
          period: from && to ? undefined : period,
          peak_by: peakBy,
          from,
          to,
          timezone,
        });
        if (cancelled) return;
        setState({
          loading: false,
          hours: result.hours,
          summary: result.summary,
          period: result.period,
          peakBy: result.peakBy,
          timezone: result.timezone,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          hours: [],
          summary: null,
          period: null,
          peakBy,
          timezone: null,
          error: e?.message || 'Could not load peak sales hours',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, peakBy, from, to, timezone]);

  return state;
}
