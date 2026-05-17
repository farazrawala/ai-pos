import { APP_ENV, DEBUG } from '../../config/env.js';
import { formatDisplayApiUrl } from '../../config/apiConfig.js';
import { formatApiDurationMs } from '../../utils/pageApiSources.js';

/**
 * @typedef {import('../../utils/pageApiSources.js').ApiSourceEntry} ApiSourceEntry
 */

/**
 * Dev-only footer listing API endpoints used on a page and their load times.
 * Shown only when `VITE_DEBUG=true` in `.env`.
 *
 * @param {{
 *   sources?: ApiSourceEntry[];
 *   title?: string;
 *   className?: string;
 *   wallDurationMs?: number | null;
 * }} props
 */
export default function DevApiSourcesFooter({
  sources = [],
  title = 'Data fetched from',
  className = '',
  wallDurationMs = null,
}) {
  if (!DEBUG || !sources.length) return null;

  const resolvedWallMs =
    wallDurationMs != null && Number.isFinite(wallDurationMs)
      ? wallDurationMs
      : sources.reduce((max, s) => Math.max(max, s.durationMs ?? 0), 0) || null;

  const anyLoading = sources.some((s) => s.status === 'loading' || s.status === 'pending');
  const errorCount = sources.filter((s) => s.status === 'error').length;

  return (
    <aside
      className={`dev-api-sources ${className}`.trim()}
      aria-label="API data sources"
    >
      <p className="dev-api-sources-title">
        {title}
        <span className="dev-api-sources-env"> ({APP_ENV})</span>
        {resolvedWallMs != null && resolvedWallMs > 0 ? (
          <span className="dev-api-sources-wall">
            {' '}
            · {anyLoading ? 'loading' : 'loaded in'} {formatApiDurationMs(resolvedWallMs)}
            {errorCount > 0 ? (
              <span className="dev-api-sources-wall-warn"> · {errorCount} failed</span>
            ) : null}
          </span>
        ) : null}
      </p>
      <ul className="dev-api-sources-list">
        {sources.map((entry) => {
          const { key, label, url, error } = entry;
          const status = entry.status ?? 'success';
          const durationMs = entry.durationMs ?? null;
          const rowKey = key || label;
          const timingClass =
            status === 'error'
              ? 'dev-api-sources-timing--error'
              : status === 'success'
                ? 'dev-api-sources-timing--success'
                : 'dev-api-sources-timing--loading';

          return (
            <li key={rowKey} className="dev-api-sources-item">
              <div className="dev-api-sources-row-head">
                <span className="dev-api-sources-label">{label}</span>
                <span className={`dev-api-sources-timing ${timingClass}`} title="Request duration">
                  {status === 'loading' || status === 'pending'
                    ? '…'
                    : formatApiDurationMs(durationMs)}
                </span>
              </div>
              <code className="dev-api-sources-url user-select-all">{formatDisplayApiUrl(url)}</code>
              {status === 'error' && error ? (
                <span className="dev-api-sources-error">{error}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
