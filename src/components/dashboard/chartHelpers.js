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

/** @param {{ from?: string } | null} period @param {{ date: string }[]} days */
export function periodLabelFromApi(period, days) {
  if (period?.from) {
    const from = new Date(period.from);
    if (!Number.isNaN(from.getTime())) {
      return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }
  return monthLabelFromDays(days);
}
