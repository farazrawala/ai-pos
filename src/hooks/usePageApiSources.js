import { useCallback, useState } from 'react';
import {
  buildPendingApiSources,
  trackApiCall,
  trackApiCallsParallel,
} from '../utils/pageApiSources.js';

/**
 * Track API endpoints used on a page and expose them for {@link DevApiSourcesFooter}.
 *
 * @example
 * const { sources, wallDurationMs, runAll } = usePageApiSources();
 *
 * useEffect(() => {
 *   runAll([
 *     { key: 'users', label: 'Users', url: buildUsersUrl(), fetch: () => fetchUsers() },
 *   ]).then(({ results }) => {
 *     const users = results.find((r) => r.key === 'users');
 *     if (users?.status === 'success') setRows(users.value);
 *   });
 * }, [runAll]);
 *
 * return <DevApiSourcesFooter sources={sources} wallDurationMs={wallDurationMs} />;
 */
export function usePageApiSources() {
  const [sources, setSources] = useState([]);
  const [wallDurationMs, setWallDurationMs] = useState(null);

  const runAll = useCallback(async (definitions) => {
    if (!Array.isArray(definitions) || definitions.length === 0) {
      setSources([]);
      setWallDurationMs(null);
      return { results: [], sources: [], wallDurationMs: 0 };
    }

    setSources(buildPendingApiSources(definitions).map((s) => ({ ...s, status: 'loading' })));
    setWallDurationMs(null);

    const outcome = await trackApiCallsParallel(definitions);
    setSources(outcome.sources);
    setWallDurationMs(outcome.wallDurationMs);
    return outcome;
  }, []);

  const trackOne = useCallback(async (definition) => {
    const key = definition.key ?? definition.label;
    setSources((prev) => {
      const next = prev.filter((s) => s.key !== key);
      next.push({
        key,
        label: definition.label,
        url: definition.url,
        status: 'loading',
        durationMs: null,
        error: null,
      });
      return next;
    });

    const result = await trackApiCall(definition);
    setSources((prev) => {
      const rest = prev.filter((s) => s.key !== key);
      return [
        ...rest,
        {
          key: result.key,
          label: result.label,
          url: result.url,
          status: result.status,
          durationMs: result.durationMs,
          error: result.error,
        },
      ];
    });
    return result;
  }, []);

  const setSourceEntries = useCallback((entries) => {
    setSources(Array.isArray(entries) ? entries : []);
  }, []);

  return {
    sources,
    wallDurationMs,
    runAll,
    trackOne,
    setSources: setSourceEntries,
    setWallDurationMs,
  };
}
