/**
 * Resolve dotted path against a root object, e.g. "response.data.id"
 * with root { response: axiosResponse }.
 */
export function getByPath(root, path) {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur = root;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Apply `save` map: keys -> path expressions evaluated on { response }.
 * Each value may be a single path string or an array of paths; the first path
 * that resolves to a non-nullish value wins (useful for alternate API shapes).
 */
export function applySaveMap(axiosResponse, saveMap, variables) {
  if (!saveMap || typeof saveMap !== 'object') return variables;
  const next = { ...variables };
  const root = { response: axiosResponse };
  for (const [varName, pathExpr] of Object.entries(saveMap)) {
    const paths = Array.isArray(pathExpr) ? pathExpr : [pathExpr];
    let chosen;
    for (const p of paths) {
      if (typeof p !== 'string') continue;
      const v = getByPath(root, p);
      if (v != null) {
        chosen = v;
        break;
      }
    }
    next[varName] = chosen;
  }
  return next;
}
