import { useEffect, useState } from 'react';
import { withBase } from '../config/appBase.js';
import { APP_BUILT_AT } from '../config/appVersion.js';

// One request per page load, shared by every badge.
let serverInfoPromise = null;

function fetchServerInfo() {
  if (!serverInfoPromise) {
    serverInfoPromise = fetch(withBase('/server-info.php'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data?.ip ? data : null))
      // Vite dev server doesn't run PHP, so this resolves to null locally.
      .catch(() => null);
  }
  return serverInfoPromise;
}

/** Hosting server IP/hostname from `public/server-info.php`, or null when unavailable. */
export function useServerInfo() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let active = true;
    fetchServerInfo().then((data) => {
      if (active) setInfo(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return info;
}

/** Tooltip text for the version badge: build time plus hosting server IP. */
export function versionBadgeTitle(serverInfo) {
  const lines = [APP_BUILT_AT ? `Built ${new Date(APP_BUILT_AT).toLocaleString()}` : 'App version'];
  if (serverInfo?.ip) {
    lines.push(`Server IP: ${serverInfo.ip}`);
    if (serverInfo.host) lines.push(`Host: ${serverInfo.host}`);
  }
  lines.push('Click the version to check for updates');
  return lines.join('\n');
}
