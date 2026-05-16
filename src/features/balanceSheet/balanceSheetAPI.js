import { API_BASE_URL } from '../../config/apiConfig.js';

const BASE_URL = `${API_BASE_URL}/`;

/**
 * GET path for balance-sheet inventory (COGS at cost).
 * Override with `.env`: `VITE_BALANCE_SHEET_INVENTORY_COG_PATH=your/path` (no leading slash).
 */
const INVENTORY_COG_PATH =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BALANCE_SHEET_INVENTORY_COG_PATH) ||
  'inventory_movements/cost-of-goods-available';

const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const getErrorMessageFromResponse = async (response) => {
  const status = response.status;
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json.message === 'string' && json.message) return json.message;
      if (typeof json.error === 'string' && json.error) return json.error;
    } catch {
      /* ignore */
    }
  }
  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 500 ? `${oneLine.slice(0, 500)}…` : oneLine;
};

/** GET URL for inventory / COGS section on the balance sheet. */
export function buildBalanceSheetInventoryCogUrl() {
  return `${BASE_URL}${INVENTORY_COG_PATH}`;
}

/**
 * Inventory valuation for the balance sheet.
 * Expects JSON like `{ grand_total_cost_of_goods, data: [{ product_id, product_name, cost_of_goods_available }] }`.
 *
 * @returns {Promise<{ lines: Array<{ id: string; label: string; amount: number }>; grandTotal: number }>}
 */
export async function fetchBalanceSheetInventoryCogRequest() {
  const url = buildBalanceSheetInventoryCogUrl();
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Inventory request was not successful';
    throw new Error(msg);
  }

  const rows = Array.isArray(result.data) ? result.data : [];

  const lines = rows.map((row, idx) => {
    const id =
      row.product_id != null
        ? String(row.product_id)
        : `inventory-row-${idx}`;
    const label = row.product_name != null ? String(row.product_name) : '—';
    const raw = row.cost_of_goods_available ?? row.costOfGoodsAvailable;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''));
    return {
      id,
      label,
      amount: Number.isFinite(n) ? n : 0,
    };
  });

  const gtRaw =
    result.grand_total_cost_of_goods ??
    result.grandTotalCostOfGoods ??
    result.grand_total_cost_of_goods_available;
  const gtNum =
    typeof gtRaw === 'number' && Number.isFinite(gtRaw)
      ? gtRaw
      : parseFloat(String(gtRaw ?? '').replace(/,/g, '').trim());
  const fromLines = lines.reduce((a, r) => a + r.amount, 0);
  const grandTotal = Number.isFinite(gtNum) ? gtNum : fromLines;

  return { lines, grandTotal };
}
