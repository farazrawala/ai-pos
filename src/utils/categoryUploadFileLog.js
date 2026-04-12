const ENDPOINT = '/__category-upload-log';

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

export function shouldAppendCategoryUploadLogToFile() {
  if (typeof import.meta === 'undefined') return false;
  if (import.meta.env?.DEV) return true;
  const flag = import.meta.env?.VITE_FILE_UPLOAD_LOG;
  return flag === '1' || flag === 'true';
}

/**
 * Append a category image upload error to project `logs.txt` (via Vite dev/preview middleware).
 * No-ops the HTTP post when not in dev / when VITE_FILE_UPLOAD_LOG is unset in preview.
 */
export function logCategoryUploadErrorToFile(operation, details = {}) {
  const payload = {
    tag: '[Category module]',
    kind: 'category_image_upload_error',
    operation,
    clientTime: new Date().toISOString(),
    ...cloneForLog(details),
  };
  let body;
  try {
    body = JSON.stringify(payload);
  } catch {
    body = JSON.stringify({
      tag: '[Category module]',
      kind: 'category_image_upload_error',
      operation,
      clientTime: payload.clientTime,
      message: 'Failed to serialize details',
    });
  }
  console.error('[Category module] [upload error]', operation, details);
  if (typeof fetch === 'undefined' || !shouldAppendCategoryUploadLogToFile()) {
    return;
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}
