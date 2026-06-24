import { useEffect, useState } from 'react';
import { fetchLowStockAlertsRequest } from '../features/alerts/alertsAPI.js';

const DISPLAY_LIMIT = 50;

export function useLowStockProducts() {
  const [state, setState] = useState({
    loading: true,
    items: [],
    total: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await fetchLowStockAlertsRequest({ skip: 0, limit: DISPLAY_LIMIT });
        if (cancelled) return;

        setState({
          loading: false,
          items: result.items,
          total: result.total,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          items: [],
          total: 0,
          error: e?.message || 'Could not load low stock alerts',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
