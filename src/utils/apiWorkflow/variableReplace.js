const WHOLE_TOKEN = /^\{\{\s*([\w.]+)\s*\}\}$/;

/**
 * Replace {{key}} inside a string (non-whole-string), coercing values to string.
 */
export function replaceTemplateTokens(str, variables) {
  if (typeof str !== 'string') return str;
  let out = str;
  for (const [key, value] of Object.entries(variables)) {
    const token = `{{${key}}}`;
    if (!out.includes(token)) continue;
    const piece = value === null || value === undefined ? '' : String(value);
    out = out.split(token).join(piece);
  }
  return out;
}

export function interpolateUrl(url, variables) {
  return replaceTemplateTokens(url ?? '', variables);
}

/**
 * Deep-interpolate JSON-like values for request bodies.
 * - If a string is exactly `{{var}}`, substitute the raw variable value (typed).
 * - Otherwise replace {{var}} substrings with String(value).
 */
export function interpolateDeep(value, variables) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const m = value.trim().match(WHOLE_TOKEN);
    if (m) {
      const key = m[1];
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        return variables[key];
      }
    }
    return replaceTemplateTokens(value, variables);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateDeep(item, variables));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = interpolateDeep(v, variables);
    }
    return out;
  }
  return value;
}
