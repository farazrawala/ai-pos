import { useCallback, useEffect, useRef, useState } from 'react';
import { withBase } from '../config/appBase.js';

/** Static asset downloaded to measure throughput. */
const PROBE_PATH = '/assets/fonts/nucleo-icons.svg';
/** How often to re-measure while the tab is visible. */
const PROBE_INTERVAL_MS = 15000;
/** Below this the timing is mostly request overhead, so the estimate is flagged. */
const MIN_RELIABLE_SECONDS = 0.02;

const getConnection = () =>
  typeof navigator !== 'undefined'
    ? navigator.connection || navigator.mozConnection || navigator.webkitConnection
    : null;

const readConnectionMeta = () => {
  const conn = getConnection();
  if (!conn) return { rtt: null, effectiveType: '', saveData: false };
  return {
    rtt: Number.isFinite(Number(conn.rtt)) ? Number(conn.rtt) : null,
    effectiveType: conn.effectiveType || '',
    saveData: Boolean(conn.saveData),
  };
};

async function probeDownlink(signal) {
  const url = `${withBase(PROBE_PATH)}?_probe=${Date.now()}`;
  const start = performance.now();
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Probe failed (${response.status})`);

  const buffer = await response.arrayBuffer();
  const seconds = (performance.now() - start) / 1000;
  if (!(seconds > 0) || !buffer.byteLength) return null;

  const megabits = (buffer.byteLength * 8) / 1_000_000;
  return {
    downlink: megabits / seconds,
    approximate: seconds < MIN_RELIABLE_SECONDS,
    bytes: buffer.byteLength,
    seconds,
  };
}

/**
 * Live connection speed measured by repeatedly downloading a small asset.
 *
 * The Network Information API only supplies latency / effective type here: its
 * `downlink` is rounded and capped (10 Mbps in Chromium), so it reads as static.
 */
export function useNetworkSpeed({ enabled = true, intervalMs = PROBE_INTERVAL_MS } = {}) {
  const [stats, setStats] = useState(() => ({
    downlink: null,
    approximate: false,
    updatedAt: null,
    ...readConnectionMeta(),
  }));
  const [measuring, setMeasuring] = useState(false);
  const abortRef = useRef(null);
  const inFlightRef = useRef(false);

  const measure = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    setMeasuring(true);
    try {
      const result = await probeDownlink(controller.signal);
      if (result) {
        setStats({
          downlink: result.downlink,
          approximate: result.approximate,
          updatedAt: Date.now(),
          ...readConnectionMeta(),
        });
      }
    } catch {
      /* Keep the last known value; the offline badge covers hard failures. */
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      inFlightRef.current = false;
      setMeasuring(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    measure();

    const tick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) measure();
    };
    const id = window.setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') measure();
    };
    const conn = getConnection();
    const onConnectionChange = () => {
      setStats((prev) => ({ ...prev, ...readConnectionMeta() }));
      measure();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', measure);
    conn?.addEventListener?.('change', onConnectionChange);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', measure);
      conn?.removeEventListener?.('change', onConnectionChange);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, measure]);

  return { ...stats, measuring, measure, hasStats: Boolean(stats.downlink) };
}
