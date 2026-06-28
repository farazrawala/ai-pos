/** @returns {string} */
export function pickRecordId(record) {
  if (record == null || typeof record !== 'object') return '';
  const id =
    record._id ??
    record.id ??
    record.product_id ??
    record.user_id ??
    record.client_order_id ??
    '';
  return id != null ? String(id) : '';
}

/** Strip undefined index fields so Dexie stores stay valid. */
export function omitUndefined(value) {
  if (value == null || typeof value !== 'object') return value;
  const next = { ...value };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  return next;
}
