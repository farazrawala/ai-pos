import { useEffect, useState } from 'react';
import { fetchTotalSalesCurrentMonthRequest } from '../features/orders/ordersAPI.js';

/** @param {number} current @param {number} previous */
function computeMomPercent(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  if (p === 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
}

/** Projected month-end total from sales so far this month. */
export function expectedTotalMonthlySale(currentAmount, now = new Date()) {
  const amount = Number(currentAmount);
  if (!Number.isFinite(amount)) return null;
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.min(Math.max(day, 1), daysInMonth);
  return (amount / daysElapsed) * daysInMonth;
}

export function useCurrentMonthSales() {
  const [state, setState] = useState({
    loading: true,
    totalAmount: null,
    orderCount: null,
    momPercent: null,
    expectedMonthlyAmount: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { currentMonth, lastMonth } = await fetchTotalSalesCurrentMonthRequest();
        if (cancelled) return;

        const { totalAmount, orderCount } = currentMonth;
        const momPercent =
          lastMonth != null
            ? computeMomPercent(totalAmount, lastMonth.totalAmount)
            : null;
        const expectedMonthlyAmount = expectedTotalMonthlySale(totalAmount);

        setState({
          loading: false,
          totalAmount,
          orderCount,
          momPercent,
          expectedMonthlyAmount,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          totalAmount: null,
          orderCount: null,
          momPercent: null,
          expectedMonthlyAmount: null,
          error: e?.message || 'Could not load sales',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
