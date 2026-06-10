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
function normalizeSavedScalar(value) {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const id = value._id ?? value.id;
    if (id == null) return undefined;
    return String(id).trim() || undefined;
  }
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

function isCachedVariable(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return false;
}

/**
 * @param {import('axios').AxiosResponse} axiosResponse
 * @param {Record<string, string | string[]> | null | undefined} saveMap
 * @param {Record<string, unknown>} variables
 * @param {{ skipIfCached?: boolean }} [options] — when true, keep existing saved vars (default true)
 */
export function applySaveMap(axiosResponse, saveMap, variables, options = {}) {
  if (!saveMap || typeof saveMap !== 'object') return variables;
  const skipIfCached = options.skipIfCached !== false;
  const next = { ...variables };
  const root = { response: axiosResponse };
  for (const [varName, pathExpr] of Object.entries(saveMap)) {
    if (skipIfCached && isCachedVariable(next[varName])) continue;
    const paths = Array.isArray(pathExpr) ? pathExpr : [pathExpr];
    let chosen;
    for (const p of paths) {
      if (typeof p !== 'string') continue;
      const v = getByPath(root, p);
      if (v != null && (typeof v !== 'string' || v.trim() !== '')) {
        chosen = v;
        break;
      }
    }
    if (chosen === undefined) continue;
    const normalized = normalizeSavedScalar(chosen);
    if (normalized !== undefined) {
      next[varName] = normalized;
    }
  }
  return next;
}
