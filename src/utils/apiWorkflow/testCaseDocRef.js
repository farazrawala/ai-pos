/** Transaction types that receive a serial document ref in test cases. */
export const TEST_CASE_DOC_TYPES = ['sale', 'purchase', 'purchase_return', 'sales_return'];

const DOC_REF_PREFIX = {
  sale: 'ORD',
  purchase: 'PO',
  purchase_return: 'PR',
  sales_return: 'SR',
};

/**
 * @param {'sale' | 'purchase' | 'purchase_return' | 'sales_return'} type
 * @param {number} serial 1-based serial for that document type
 * @param {number} [width]
 */
export function formatTestCaseDocRef(type, serial, width = 3) {
  const prefix = DOC_REF_PREFIX[type];
  const n = Number(serial);
  if (!prefix || !Number.isFinite(n) || n < 1) return '';
  return `${prefix}-${String(Math.floor(n)).padStart(width, '0')}`;
}

/**
 * Assign ORD-001 / PO-001 / PR-001 / SR-001 per create transaction in suite order.
 * @param {Array<{ n: number; type: string }>} cases
 * @returns {Map<number, { type: string; ref: string }>}
 */
export function buildTestCaseDocRefMap(cases) {
  /** @type {Record<string, number>} */
  const serial = { sale: 0, purchase: 0, purchase_return: 0, sales_return: 0 };
  /** @type {Map<number, { type: string; ref: string }>} */
  const byCaseNo = new Map();

  for (const tc of cases || []) {
    if (!tc || !TEST_CASE_DOC_TYPES.includes(tc.type)) continue;
    serial[tc.type] += 1;
    byCaseNo.set(tc.n, {
      type: tc.type,
      ref: formatTestCaseDocRef(tc.type, serial[tc.type]),
    });
  }

  return byCaseNo;
}

/**
 * Document ref for a case row (create) or the referenced source doc (edit/delete).
 * @param {{ n?: number; type?: string; ref?: number } | null | undefined} tc
 * @param {Map<number, { type: string; ref: string }>} byCaseNo
 */
export function resolveTestCaseDocRef(tc, byCaseNo) {
  if (!tc || !byCaseNo?.size) return '';
  if (TEST_CASE_DOC_TYPES.includes(tc.type)) {
    return byCaseNo.get(tc.n)?.ref ?? '';
  }
  if (tc.ref != null) {
    return byCaseNo.get(tc.ref)?.ref ?? '';
  }
  return '';
}
