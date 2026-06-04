/**
 * Flat object → FormData (keys like `product_id[0]` are appended as-is).
 * @param {Record<string, unknown>} obj
 */
export function objectToFormData(obj) {
  const form = new FormData();
  if (!obj || typeof obj !== 'object') return form;
  for (const [key, val] of Object.entries(obj)) {
    if (val == null) continue;
    if (typeof val === 'object' && !(val instanceof Blob)) continue;
    form.append(key, String(val));
  }
  return form;
}
