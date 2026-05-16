import { APP_ENV, IS_LIVE } from '../../config/env.js';
import { formatDisplayApiUrl } from '../../config/apiConfig.js';

/**
 * Lists API endpoints at the bottom of a page (hidden when VITE_APP_ENV=live).
 * @param {{ sources: Array<{ label: string; url: string }>; title?: string; className?: string }} props
 */
export default function DevApiSourcesFooter({
  sources = [],
  title = 'API data sources',
  className = '',
}) {
  if (IS_LIVE || !sources.length) return null;

  return (
    <aside
      className={`dev-api-sources ${className}`.trim()}
      aria-label="API data sources"
    >
      <p className="dev-api-sources-title">
        {title}
        <span className="dev-api-sources-env"> ({APP_ENV})</span>
      </p>
      <ul className="dev-api-sources-list">
        {sources.map(({ label, url }) => (
          <li key={label} className="dev-api-sources-item">
            <span className="dev-api-sources-label">{label}</span>
            <code className="dev-api-sources-url user-select-all">{formatDisplayApiUrl(url)}</code>
          </li>
        ))}
      </ul>
    </aside>
  );
}
