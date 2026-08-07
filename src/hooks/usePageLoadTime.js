import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const readNavigationTiming = () => {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
  const [entry] = performance.getEntriesByType('navigation');
  if (!entry) return null;

  const total = entry.loadEventEnd > 0 ? entry.loadEventEnd - entry.startTime : 0;
  if (!(total > 0)) return null;

  return {
    total,
    ttfb: Math.max(0, entry.responseStart - entry.startTime),
    domReady: Math.max(0, entry.domContentLoadedEventEnd - entry.startTime),
  };
};

/**
 * Initial document load timing, then per-route transition timing on navigation.
 *
 * @returns {{ ms: number|null, kind: 'page'|'route', detail: object|null }}
 */
export function usePageLoadTime() {
  const location = useLocation();
  const [state, setState] = useState({ ms: null, kind: 'page', detail: null });
  const isFirstRoute = useRef(true);

  useEffect(() => {
    const apply = () => {
      const timing = readNavigationTiming();
      if (timing) {
        setState({ ms: timing.total, kind: 'page', detail: timing });
      }
    };

    apply();
    if (document.readyState === 'complete') return undefined;

    window.addEventListener('load', apply);
    return () => window.removeEventListener('load', apply);
  }, []);

  useEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return undefined;
    }

    const start = performance.now();
    let frame = 0;
    // Two frames: after React commits and the browser paints the new route.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setState({ ms: performance.now() - start, kind: 'route', detail: null });
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  return state;
}
