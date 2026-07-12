import { useEffect, useState } from 'react';
import { fetchLedgerDebitCreditRequest } from '../features/dashboard/financeDashboardAPI.js';

export function useLedgerDebitCredit(options = {}) {
  const { startDate, endDate } = options;
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
        const result = await fetchLedgerDebitCreditRequest({ startDate, endDate });
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
          error: e?.message || 'Could not load ledger debit/credit',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return state;
}
