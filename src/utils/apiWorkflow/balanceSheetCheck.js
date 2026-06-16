/** True when a test-case step should trigger a follow-up balance-sheet check. */
export function isTransactionRelatedStep(step) {
  if (!step || typeof step !== 'object') return false;
  if (step.qtyLedger) return true;

  const url = String(step.url || '').toLowerCase();
  return (
    url.includes('api/order/') ||
    url.includes('api/purchase_order/') ||
    url.includes('api/purchase_return/') ||
    url.includes('api/sales_return/') ||
    url.includes('api/transaction/')
  );
}

/** Extract only the summary block from a balance-sheet API response. */
export function extractBalanceSheetSummary(responseData) {
  if (!responseData || typeof responseData !== 'object') return null;
  return responseData?.data?.summary ?? responseData?.summary ?? null;
}
