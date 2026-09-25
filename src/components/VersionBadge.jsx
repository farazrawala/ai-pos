import { FaCodeBranch, FaServer } from 'react-icons/fa6';
import { APP_VERSION } from '../config/appVersion.js';
import { useServerInfo, versionBadgeTitle } from '../hooks/useServerInfo.js';

/** App version + hosting server IP, shown as a two-segment pill. */
export default function VersionBadge({ className = '' }) {
  const serverInfo = useServerInfo();

  return (
    <span className={`version-badge ${className}`.trim()} title={versionBadgeTitle(serverInfo)}>
      <span className="version-badge__segment">
        <FaCodeBranch className="version-badge__icon" aria-hidden="true" />
        <span className="version-badge__label">Version</span>
        <span className="version-badge__value">v{APP_VERSION}</span>
      </span>
      {serverInfo?.ip ? (
        <span className="version-badge__segment version-badge__segment--server">
          <FaServer className="version-badge__icon" aria-hidden="true" />
          <span className="version-badge__label">Server</span>
          <span className="version-badge__value">{serverInfo.ip}</span>
        </span>
      ) : null}
    </span>
  );
}
