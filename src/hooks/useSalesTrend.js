import { useEffect, useState } from 'react';
import {
  fetchSalesByDayReportRequest,
  fetchSalesMonthWiseRequest,
  fetchSalesWeekWiseRequest,
} from '../features/orders/ordersAPI.js';
import {
  dayLabelFromDate,
  monthLabelFromKey,
  weekRangeLabel,
  weekRangeTitle,
} from '../components/dashboard/chartHelpers.js';

export const SALES_TREND_GRAINS = [
  { value: 'day', label: 'Days', period: 'current_month' },
  { value: 'week', label: 'Week', period: 'last_90_days' },
  { value: 'month', label: 'Month', period: 'current_year' },
];

function mapDayPoints(days) {
  return (days || []).map((row) => {
    const date = String(row.date || '').slice(0, 10);
    const d = new Date(`${date}T12:00:00`);
    const title = Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      key: date,
      label: dayLabelFromDate(date),
      title,
      totalAmount: row.totalAmount ?? 0,
      orderCount: row.orderCount ?? 0,
      averageOrderValue:
        row.averageOrderValue ??
        ((row.orderCount ?? 0) > 0 ? (row.totalAmount ?? 0) / row.orderCount : 0),
    };
  });
}

function mapWeekPoints(weeks) {
  return (weeks || []).map((row) => ({
    key: row.from || row.week,
    label: weekRangeLabel(row.from || row.week, row.to),
    title: weekRangeTitle(row.from || row.week, row.to),
    totalAmount: row.totalAmount ?? 0,
    orderCount: row.orderCount ?? 0,
    averageOrderValue: row.averageOrderValue ?? 0,
  }));
}

function mapMonthPoints(months) {
  const spanYears =
    new Set(months.map((m) => String(m.month || '').split('-')[0]).filter(Boolean)).size > 1;
  return (months || []).map((row) => ({
    key: row.month,
    label: monthLabelFromKey(row.month, { includeYear: spanYears }),
    title: monthLabelFromKey(row.month, { includeYear: true }),
    totalAmount: row.totalAmount ?? 0,
    orderCount: row.orderCount ?? 0,
    averageOrderValue: row.averageOrderValue ?? 0,
  }));
}

/**
 * @param {'day'|'week'|'month'} grain
 */
export function useSalesTrend(grain = 'month') {
  const [state, setState] = useState({
    loading: true,
    points: [],
    summary: null,
    period: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        let points = [];
        let summary = null;
        let period = null;

        if (grain === 'day') {
          const result = await fetchSalesByDayReportRequest({ period: 'current_month' });
          points = mapDayPoints(result.days);
          summary = result.summary;
          period = result.period;
        } else if (grain === 'week') {
          const result = await fetchSalesWeekWiseRequest({ period: 'last_90_days' });
          points = mapWeekPoints(result.weeks);
          summary = result.summary;
          period = result.period;
        } else {
          const result = await fetchSalesMonthWiseRequest({ period: 'current_year' });
          points = mapMonthPoints(result.months);
          summary = result.summary;
          period = result.period;
        }

        if (cancelled) return;
        setState({ loading: false, points, summary, period, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          points: [],
          summary: null,
          period: null,
          error: e?.message || 'Could not load sales',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [grain]);

  return state;
}
