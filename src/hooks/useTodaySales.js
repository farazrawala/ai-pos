import { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { fetchSalesDayWiseRequest } from '../features/orders/ordersAPI.js';

/** @param {{ date: string; totalAmount: number }[]} days @param {string} dateKey */
function findDayAmount(days, dateKey) {
  const row = days.find((d) => d.date === dateKey);
  return row?.totalAmount ?? 0;
}

/** @param {number} today @param {number} yesterday */
function computeDayOverDayPercent(today, yesterday) {
  const t = Number(today);
  const y = Number(yesterday);
  if (!Number.isFinite(t) || !Number.isFinite(y)) return null;
  if (y === 0) return t > 0 ? 100 : 0;
  return ((t - y) / y) * 100;
}

export function useTodaySales() {
  const [state, setState] = useState({
    loading: true,
    todayAmount: null,
    yesterdayAmount: null,
    dodPercent: null,
    orderCount: null,
    error: null,
  });

  const todayKey = useMemo(() => moment().format('YYYY-MM-DD'), []);
  const yesterdayKey = useMemo(() => moment().subtract(1, 'day').format('YYYY-MM-DD'), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { days } = await fetchSalesDayWiseRequest();
        if (cancelled) return;

        const todayRow = days.find((d) => d.date === todayKey);
        const todayAmount = findDayAmount(days, todayKey);
        const yesterdayAmount = findDayAmount(days, yesterdayKey);
        const dodPercent = computeDayOverDayPercent(todayAmount, yesterdayAmount);

        setState({
          loading: false,
          todayAmount,
          yesterdayAmount,
          dodPercent,
          orderCount: todayRow?.orderCount ?? 0,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          todayAmount: null,
          yesterdayAmount: null,
          dodPercent: null,
          orderCount: null,
          error: e?.message || 'Could not load today\'s sales',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [todayKey, yesterdayKey]);

  return state;
}
