import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * @typedef {{ key: string; label: string; alwaysVisible?: boolean; defaultVisible?: boolean }} ColumnDef
 */

const STORAGE_PREFIX = 'posColumns:';

function buildDefaults(columns) {
  const out = {};
  for (const col of columns) {
    out[col.key] = col.alwaysVisible ? true : col.defaultVisible !== false;
  }
  return out;
}

/**
 * Manage show/hide state for table columns, persisted in localStorage (cache).
 * Columns flagged `alwaysVisible` can never be hidden.
 *
 * @param {string} storageId  Unique id for this table (e.g. "products").
 * @param {ColumnDef[]} columns
 */
export function useColumnVisibility(storageId, columns) {
  const storageKey = `${STORAGE_PREFIX}${storageId}`;
  const defaults = useMemo(() => buildDefaults(columns), [columns]);

  const [visibility, setVisibility] = useState(defaults);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setVisibility(defaults);
        return;
      }
      const saved = JSON.parse(raw);
      const next = { ...defaults };
      for (const col of columns) {
        if (col.alwaysVisible) {
          next[col.key] = true;
        } else if (typeof saved?.[col.key] === 'boolean') {
          next[col.key] = saved[col.key];
        }
      }
      setVisibility(next);
    } catch {
      setVisibility(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore quota/serialization errors */
      }
    },
    [storageKey]
  );

  const isVisible = useCallback((key) => visibility[key] !== false, [visibility]);

  const toggle = useCallback(
    (key) => {
      const col = columns.find((c) => c.key === key);
      if (col?.alwaysVisible) return;
      setVisibility((prev) => {
        const next = { ...prev, [key]: prev[key] === false };
        persist(next);
        return next;
      });
    },
    [columns, persist]
  );

  const reset = useCallback(() => {
    setVisibility(defaults);
    persist(defaults);
  }, [defaults, persist]);

  const visibleCount = useMemo(
    () => columns.reduce((n, c) => (visibility[c.key] !== false ? n + 1 : n), 0),
    [columns, visibility]
  );

  return { visibility, isVisible, toggle, reset, visibleCount };
}
