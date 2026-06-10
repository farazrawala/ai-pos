import { API_BASE_URL } from '../../config/apiConfig.js';
import {
  ADJUSTMENT_LIST_POPULATE,
  formatAdjustmentType,
  getAdjustmentProductName,
  normalizeAdjustmentsListRows,
} from '../adjustments/adjustmentsAPI.js';
import {
  ensureCompanyFromCache,
  extractCompanyFromUser,
  getDefaultAccountId,
  pickAccountRefId,
} from '../company/companyAPI.js';

/** Company field excluded from equity `fetch-account-by-type` (shown via adjustments). */
export const BALANCE_SHEET_EQUITY_EXCLUDE_KEY = 'default_adjustment_account';

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
    const id = row.product_id != null ? String(row.product_id) : `inventory-row-${idx}`;
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
      : parseFloat(
          String(gtRaw ?? '')
            .replace(/,/g, '')
            .trim()
        );
  const fromLines = lines.reduce((a, r) => a + r.amount, 0);
  const grandTotal = Number.isFinite(gtNum) ? gtNum : fromLines;

  return { lines, grandTotal };
}

const PROFIT_BY_ORDER_ITEM_PATH = 'order/profit-by-order-item';
const PROFIT_BY_SALES_RETURN_ITEM_PATH = 'sales_return/profit-by-sales-return-item';

/** GET URL for order profit on the balance sheet (Owner's equity). */
export function buildBalanceSheetProfitUrl() {
  return `${BASE_URL}${PROFIT_BY_ORDER_ITEM_PATH}`;
}

/** GET URL for sales return profit on the balance sheet (Owner's equity). */
export function buildBalanceSheetSalesReturnProfitUrl() {
  return `${BASE_URL}${PROFIT_BY_SALES_RETURN_ITEM_PATH}`;
}

/**
 * Order profit for balance sheet Owner's equity.
 * Expects `{ success, profit, line_count?, order_item_ids? }`.
 *
 * @returns {Promise<{ profit: number; lineCount: number; orderItemIds: string[] }>}
 */
export async function fetchBalanceSheetProfitRequest() {
  const url = buildBalanceSheetProfitUrl();
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Profit request was not successful';
    throw new Error(msg);
  }

  const raw = result.profit ?? result.total_profit ?? result.totalProfit;
  const profit =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseFloat(
          String(raw ?? '')
            .replace(/,/g, '')
            .trim()
        );

  const lineCountRaw = result.line_count ?? result.lineCount;
  const lineCount =
    typeof lineCountRaw === 'number' && Number.isFinite(lineCountRaw)
      ? lineCountRaw
      : parseInt(String(lineCountRaw ?? ''), 10);

  const orderItemIds = Array.isArray(result.order_item_ids)
    ? result.order_item_ids.map(String)
    : Array.isArray(result.orderItemIds)
      ? result.orderItemIds.map(String)
      : [];

  return {
    profit: Number.isFinite(profit) ? profit : 0,
    lineCount: Number.isFinite(lineCount) ? lineCount : 0,
    orderItemIds,
  };
}

/**
 * Sales return profit for balance sheet Owner's equity.
 * Expects `{ success, profit, line_count? }`.
 *
 * @returns {Promise<{ profit: number; lineCount: number }>}
 */
export async function fetchBalanceSheetSalesReturnProfitRequest() {
  const url = buildBalanceSheetSalesReturnProfitUrl();
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Sales return profit request was not successful';
    throw new Error(msg);
  }

  const raw = result.profit ?? result.total_profit ?? result.totalProfit;
  const profit =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseFloat(
          String(raw ?? '')
            .replace(/,/g, '')
            .trim()
        );

  const lineCountRaw = result.line_count ?? result.lineCount;
  const lineCount =
    typeof lineCountRaw === 'number' && Number.isFinite(lineCountRaw)
      ? lineCountRaw
      : parseInt(String(lineCountRaw ?? ''), 10);

  return {
    profit: Number.isFinite(profit) ? profit : 0,
    lineCount: Number.isFinite(lineCount) ? lineCount : 0,
  };
}

/** Resolve `default_adjustment_account` id for equity exclude filter. */
export function resolveBalanceSheetEquityExcludeId(user, company) {
  const sources = [
    company,
    user,
    user?.company && typeof user.company === 'object' ? user.company : null,
  ].filter(Boolean);

  for (const src of sources) {
    const id = pickAccountRefId(
      src.default_adjustment_account ??
        src.defaultAdjustmentAccount ??
        src.default_adjustment_account_id
    );
    if (id) return id;
  }

  return getDefaultAccountId(company, BALANCE_SHEET_EQUITY_EXCLUDE_KEY) || '';
}

/**
 * Query params for equity accounts on the balance sheet (`exclude_id` = default adjustment account).
 * @returns {Promise<{ exclude_id?: string }>}
 */
export async function buildBalanceSheetEquityFetchParams(user = null, company = null) {
  const resolvedCompany = await ensureCompanyFromCache(user, company, {
    requiredKeys: [BALANCE_SHEET_EQUITY_EXCLUDE_KEY],
  });
  const excludeId = resolveBalanceSheetEquityExcludeId(user, resolvedCompany);
  return excludeId ? { exclude_id: excludeId } : {};
}

/** GET URL for stock adjustments on the balance sheet (Owner's equity). */
export function buildBalanceSheetAdjustmentsUrl() {
  const q = new URLSearchParams();
  q.set('populate', ADJUSTMENT_LIST_POPULATE);
  q.set('limit', '500');
  return `${BASE_URL}adjustment/get-all-active?${q.toString()}`;
}

function productUnitCostForAdjustment(product) {
  if (!product || typeof product !== 'object') return 0;
  const raw =
    product.cost_price ??
    product.costPrice ??
    product.product_price ??
    product.productPrice ??
    product.wholesale_price ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Signed equity impact: add = +qty×cost, subtract = −qty×cost. */
export function adjustmentEquityAmount(row) {
  if (!row || typeof row !== 'object') return 0;
  const qty = Number(row.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const product =
    row.product_id && typeof row.product_id === 'object' && !Array.isArray(row.product_id)
      ? row.product_id
      : null;
  const unitCost = productUnitCostForAdjustment(product);
  const sign = String(row.type || '').toLowerCase() === 'subtract' ? -1 : 1;
  return sign * unitCost * qty;
}

/**
 * Stock adjustments for balance sheet Owner's equity.
 * @returns {Promise<{ lines: Array<{ id: string; label: string; amount: number }>; total: number }>}
 */
export async function fetchBalanceSheetAdjustmentsRequest() {
  const url = buildBalanceSheetAdjustmentsUrl();
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    throw new Error(await getErrorMessageFromResponse(response));
  }

  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    const msg =
      typeof result.message === 'string' && result.message.trim() !== ''
        ? result.message
        : 'Adjustments request was not successful';
    throw new Error(msg);
  }

  const rows = normalizeAdjustmentsListRows(result);
  const lines = rows.map((row, idx) => {
    const id = String(row._id ?? row.id ?? `adjustment-${idx}`);
    const name = getAdjustmentProductName(row);
    const typeLabel = formatAdjustmentType(row.type);
    const amount = adjustmentEquityAmount(row);
    const label = name && name !== '—' ? `${name} (${typeLabel})` : `Adjustment (${typeLabel})`;
    return { id, label, amount };
  });

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total };
}
