/** Elapsed ms since `t0` from `performance.now()`. */
export function posElapsedMs(t0) {
  return Math.round(performance.now() - t0);
}

/** Convert ms to seconds (3 decimal places). */
export function posMsToSec(ms) {
  return Number((Number(ms) / 1000).toFixed(3));
}

/**
 * Log a phase timing table (seconds) and highlight the slowest step.
 * @param {string} phase
 * @param {Array<{ name: string, ms: number }>} steps
 */
export function posLogTimingSummary(phase, steps) {
  const cleaned = (Array.isArray(steps) ? steps : [])
    .filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.ms))
    .map((s) => ({ name: s.name, ms: Math.round(s.ms) }));
  if (cleaned.length === 0) return;

  const workSteps = cleaned.filter((s) => s.name.toUpperCase() !== 'TOTAL');
  const totalEntry = cleaned.find((s) => s.name.toUpperCase() === 'TOTAL');
  const ranked = [...workSteps].sort((a, b) => b.ms - a.ms);
  const slowest = ranked[0];
  const sumMs = workSteps.reduce((sum, s) => sum + s.ms, 0);
  const totalMs = totalEntry?.ms ?? sumMs;

  const rows = [];
  cleaned.forEach((s) => {
    rows.push({
      step: s.name,
      sec: posMsToSec(s.ms),
      ms: s.ms,
      note: slowest && s.name === slowest.name ? 'SLOWEST' : '',
    });
  });
  if (!totalEntry) {
    rows.push({
      step: 'TOTAL',
      sec: posMsToSec(totalMs),
      ms: totalMs,
      note: '',
    });
  }

  console.log(`[POS] timing summary — ${phase}`);
  console.table(rows);
  console.log(
    `[POS] slowest — ${phase}:`,
    slowest ? `${slowest.name} (${posMsToSec(slowest.ms)}s / ${slowest.ms}ms)` : 'n/a',
    `| total ${posMsToSec(totalMs)}s`
  );
}
