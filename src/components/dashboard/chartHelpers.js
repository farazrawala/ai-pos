/** @param {string} date YYYY-MM-DD */
export function dayLabelFromDate(date) {
  const parts = String(date || '').split('-');
  const day = parseInt(parts[2] ?? '', 10);
  return Number.isFinite(day) ? String(day) : '';
}

/** @param {{ date: string }[]} days */
export function monthLabelFromDays(days) {
  if (!days?.length || !days[0]?.date) return 'Current month';
  const d = new Date(`${days[0].date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Current month';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** @param {{ from?: string, to?: string, label?: string } | null} period @param {{ date: string }[]} days */
export function periodLabelFromApi(period, days) {
  if (period?.from) {
    const from = new Date(period.from);
    if (!Number.isNaN(from.getTime())) {
      return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }
  return monthLabelFromDays(days);
}

const DASHBOARD_PERIOD_LABELS = {
  last_30_days: 'Last 30 days',
  last_90_days: 'Last 90 days',
  current_month: 'Current month',
  last_month: 'Last month',
  current_year: 'Current year',
  last_year: 'Last year',
  last_12_months: 'Last 12 months',
};

/** @param {string} monthKey YYYY-MM */
export function monthLabelFromKey(monthKey, { includeYear = false } = {}) {
  const parts = String(monthKey || '').split('-');
  const year = parseInt(parts[0] ?? '', 10);
  const month = parseInt(parts[1] ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return String(monthKey || '');
  }
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

/** @param {{ label?: string, from?: string, to?: string } | null} period */
export function periodLabelFromPeakApi(period) {
  if (!period) return DASHBOARD_PERIOD_LABELS.last_30_days;
  const key = String(period.label ?? '').trim();
  if (key && DASHBOARD_PERIOD_LABELS[key]) return DASHBOARD_PERIOD_LABELS[key];
  if (period.from && period.to) {
    const from = new Date(period.from);
    const to = new Date(period.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${fmt(from)} – ${fmt(to)}`;
    }
  }
  return key || DASHBOARD_PERIOD_LABELS.last_30_days;
}

/** @param {{ label?: string, from?: string, to?: string } | null} period */
export function periodLabelFromMonthWiseApi(period) {
  if (!period) return DASHBOARD_PERIOD_LABELS.current_year;
  const key = String(period.label ?? '').trim();
  if (key && DASHBOARD_PERIOD_LABELS[key]) return DASHBOARD_PERIOD_LABELS[key];
  return periodLabelFromPeakApi(period) || DASHBOARD_PERIOD_LABELS.current_year;
}

/** @param {string} name @param {number} [maxLen] */
export function truncateChartLabel(name, maxLen = 22) {
  const s = String(name ?? '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/** @param {{ hour?: number, hourLabel?: string, hour_label?: string }} row */
export function shortHourLabel(row) {
  const label = row?.hourLabel ?? row?.hour_label ?? '';
  if (label.includes('·')) {
    const part = label.split('·')[1];
    if (part?.trim()) return part.trim();
  }
  const h = row?.hour;
  if (h == null || !Number.isFinite(Number(h))) return label || '';
  const d = new Date();
  d.setHours(Number(h), 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true });
}
