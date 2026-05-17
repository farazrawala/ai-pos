/**
 * @typedef {'pending' | 'loading' | 'success' | 'error'} ApiSourceStatus
 */

/**
 * @typedef {Object} ApiSourceDefinition
 * @property {string} [key] — Unique id; defaults to `label`.
 * @property {string} label — Human-readable name shown in the footer.
 * @property {string} url — Request URL (for display).
 * @property {() => Promise<unknown>} fetch — Request function to run and time.
 */

/**
 * @typedef {Object} ApiSourceEntry
 * @property {string} key
 * @property {string} label
 * @property {string} url
 * @property {ApiSourceStatus} status
 * @property {number | null} durationMs — Elapsed time when the request finished.
 * @property {string | null} [error] — Error message when status is `error`.
 */

/**
 * @typedef {ApiSourceEntry & { value: unknown }} ApiSourceResult
 */

/**
 * @param {number | null | undefined} ms
 * @returns {string}
 */
export function formatApiDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const n = Math.round(ms);
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

/**
 * @param {ApiSourceDefinition} definition
 * @returns {Promise<ApiSourceResult>}
 */
export async function trackApiCall(definition) {
  const key = definition.key ?? definition.label;
  const start = performance.now();
  try {
    const value = await definition.fetch();
    return {
      key,
      label: definition.label,
      url: definition.url,
      status: 'success',
      durationMs: Math.round(performance.now() - start),
      error: null,
      value,
    };
  } catch (err) {
    return {
      key,
      label: definition.label,
      url: definition.url,
      status: 'error',
      durationMs: Math.round(performance.now() - start),
      error: err?.message || 'Request failed',
      value: null,
    };
  }
}

/**
 * Run multiple API calls in parallel and record per-request timing.
 *
 * @param {ApiSourceDefinition[]} definitions
 * @returns {Promise<{ results: ApiSourceResult[]; sources: ApiSourceEntry[]; wallDurationMs: number }>}
 */
export async function trackApiCallsParallel(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    return { results: [], sources: [], wallDurationMs: 0 };
  }

  const wallStart = performance.now();
  const results = await Promise.all(definitions.map((d) => trackApiCall(d)));
  const wallDurationMs = Math.round(performance.now() - wallStart);

  const sources = results.map(({ key, label, url, status, durationMs, error }) => ({
    key,
    label,
    url,
    status,
    durationMs,
    error,
  }));

  return { results, sources, wallDurationMs };
}

/**
 * @param {ApiSourceDefinition[]} definitions
 * @returns {ApiSourceEntry[]}
 */
export function buildPendingApiSources(definitions) {
  return definitions.map((d) => ({
    key: d.key ?? d.label,
    label: d.label,
    url: d.url,
    status: 'pending',
    durationMs: null,
    error: null,
  }));
}
