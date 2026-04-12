const ENDPOINT = '/__project-dev-log';

function cloneForLog(details) {
  if (details == null) return {};
  if (typeof details !== 'object' || Array.isArray(details)) {
    return { value: details };
  }
  const out = {};
  for (const [k, v] of Object.entries(details)) {
    if (v instanceof Error) {
      out[k] = { message: v.message, name: v.name, stack: v.stack };
    } else {
      try {
        JSON.stringify(v);
        out[k] = v;
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

/**
 * Whether the app should POST dev logs to the Vite middleware (writes to project log file).
 * - Always on in `npm run dev` (import.meta.env.DEV).
 * - In preview/production client builds: set `VITE_PROJECT_DEV_LOG=1` or `VITE_FILE_UPLOAD_LOG=1` (legacy).
 */
export function shouldAppendProjectDevLog() {
  if (typeof import.meta === 'undefined') return false;
  if (import.meta.env?.DEV) return true;
  const a = import.meta.env?.VITE_PROJECT_DEV_LOG;
  const b = import.meta.env?.VITE_FILE_UPLOAD_LOG;
  return a === '1' || a === 'true' || b === '1' || b === 'true';
}

/**
 * Append a line to the project dev log file (via Vite dev/preview middleware).
 * Use from any feature: pass `meta.tag` / `meta.label` to namespace console + file output.
 *
 * @param {string} operation - e.g. `categories.create.multipart.network`
 * @param {object} [details]
 * @param {{ tag?: string, label?: string, kind?: string }} [meta] - defaults tag `[app]`, label `dev-log`
 */
export function appendProjectDevLog(operation, details = {}, meta = {}) {
  const tag = meta.tag ?? '[app]';
  const label = meta.label ?? 'dev-log';
  const kind = meta.kind ?? 'client';

  const clonedDetails = cloneForLog(details);
  let detailsJson;
  try {
    detailsJson = JSON.stringify(clonedDetails);
  } catch {
    detailsJson = '"[unserializable]"';
  }
  const consoleLine = `${tag} [${label}] ${operation} ${detailsJson}`;

  const payload = {
    tag,
    kind,
    label,
    operation,
    consoleLine,
    clientTime: new Date().toISOString(),
    ...clonedDetails,
  };
  let body;
  try {
    body = JSON.stringify(payload);
  } catch {
    body = JSON.stringify({
      tag,
      kind,
      label,
      operation,
      consoleLine,
      clientTime: payload.clientTime,
      message: 'Failed to serialize details',
    });
  }
  console.error(tag, `[${label}]`, operation, details);
  if (typeof fetch === 'undefined' || !shouldAppendProjectDevLog()) {
    return;
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

/** Use with `appendProjectDevLog(op, details, CATEGORY_IMAGE_UPLOAD_META)` for category file upload errors. */
export const CATEGORY_IMAGE_UPLOAD_META = {
  tag: '[Category module]',
  label: 'upload error',
  kind: 'category_image_upload',
};
