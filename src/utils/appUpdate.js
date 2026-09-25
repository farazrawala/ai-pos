import { withBase } from '../config/appBase.js';
import { APP_BUILD, APP_VERSION } from '../config/appVersion.js';

/**
 * Ask the server which build is deployed (`version.json`, emitted by vite.config.js).
 * The timestamp query keeps it out of the SW precache and HTTP cache.
 * @returns {Promise<{ version: string, build: number, builtAt?: string }>}
 */
export async function fetchDeployedVersion() {
  const res = await fetch(`${withBase('/version.json')}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Version check failed (${res.status})`);
  return res.json();
}

/** True when the deployed build differs from the one running in this tab. */
export function isDifferentBuild(deployed) {
  if (!deployed) return false;
  if (deployed.build != null && APP_BUILD != null) return Number(deployed.build) !== Number(APP_BUILD);
  return String(deployed.version) !== String(APP_VERSION);
}

/**
 * Drop the service worker and its caches, then reload so the browser fetches the new build.
 * Offline POS data lives in IndexedDB and is not touched.
 */
export async function reloadWithFreshBuild() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('[POS] Failed to clear app cache before reload', err);
  }
  window.location.reload();
}
