import { useEffect, useRef, useState } from 'react';
import { FaCircleCheck, FaCodeBranch, FaRotate, FaServer } from 'react-icons/fa6';
import { APP_VERSION } from '../config/appVersion.js';
import { useServerInfo, versionBadgeTitle } from '../hooks/useServerInfo.js';
import { fetchDeployedVersion, isDifferentBuild, reloadWithFreshBuild } from '../utils/appUpdate.js';

const STATUS_TEXT = {
  checking: 'Checking…',
  updating: 'Updating…',
  latest: 'Latest',
  offline: 'Offline',
  error: 'Check failed',
};

/**
 * App version + hosting server IP, shown as a two-segment pill.
 * Clicking the version checks the server for a newer build and reloads onto it.
 */
export default function VersionBadge({ className = '' }) {
  const serverInfo = useServerInfo();
  const [status, setStatus] = useState('idle');
  const resetTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const showBriefly = (next) => {
    setStatus(next);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus('idle'), 3000);
  };

  const handleCheckUpdate = async () => {
    if (status === 'checking' || status === 'updating') return;
    if (!navigator.onLine) {
      showBriefly('offline');
      return;
    }
    setStatus('checking');
    try {
      const deployed = await fetchDeployedVersion();
      if (isDifferentBuild(deployed)) {
        setStatus('updating');
        await reloadWithFreshBuild();
      } else {
        showBriefly('latest');
      }
    } catch (err) {
      console.warn('[POS] Version check failed', err);
      showBriefly('error');
    }
  };

  const busy = status === 'checking' || status === 'updating';
  const StatusIcon = busy ? FaRotate : status === 'latest' ? FaCircleCheck : FaCodeBranch;

  return (
    <span className={`version-badge ${className}`.trim()} title={versionBadgeTitle(serverInfo)}>
      <button
        type="button"
        className={`version-badge__segment version-badge__segment--version is-${status}`}
        onClick={handleCheckUpdate}
        disabled={busy}
        aria-label={`Version ${APP_VERSION}. Check for updates`}
      >
        <StatusIcon
          className={`version-badge__icon${busy ? ' version-badge__icon--spin' : ''}`}
          aria-hidden="true"
        />
        <span className="version-badge__label">Version</span>
        <span className="version-badge__value">v{APP_VERSION}</span>
        {status !== 'idle' ? (
          <span className="version-badge__status" role="status">
            {STATUS_TEXT[status]}
          </span>
        ) : null}
      </button>
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
