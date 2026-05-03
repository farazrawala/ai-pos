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
 */
export function applySaveMap(axiosResponse, saveMap, variables) {
  if (!saveMap || typeof saveMap !== 'object') return variables;
  const next = { ...variables };
  const root = { response: axiosResponse };
  for (const [varName, pathExpr] of Object.entries(saveMap)) {
    next[varName] = getByPath(root, pathExpr);
  }
  return next;
}
