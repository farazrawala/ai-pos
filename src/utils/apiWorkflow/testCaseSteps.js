/** @typedef {import('./inventoryQty.js').QtyLedgerEntry} QtyLedgerEntry */

import { AUTH_TOKEN_SAVE_PATHS } from './authToken.js';
import { LOGIN_SAVE_MAP } from './loginSavePaths.js';
import { applyQtyDelta, qtyLedgerDelta } from './inventoryQty.js';

const PRODUCT_PRICE = 300;

const RECORD_ID_SAVE = [
  'response.data.data._id',
  'response.data.data.id',
  'response.data._id',
  'response.data.id',
  'response.data.data.purchase_order._id',
  'response.data.data.order._id',
  'response.data.data.sales_return._id',
  'response.data.data.purchase_return._id',
];

const PRODUCT_ID_SAVE = [
  'response.data.data._id',
  'response.data.data.product._id',
  'response.data.data.product_id',
  'response.data.product._id',
  'response.data._id',
  'response.data.id',
];

const WAREHOUSE_ID_SAVE = [
  'response.data.data._id',
  'response.data.data.warehouse._id',
  'response.data.warehouse._id',
  'response.data._id',
];

const USER_ID_SAVE = [
  'response.data.data.user._id',
  'response.data.data.user.id',
  'response.data.data._id',
  'response.data.user._id',
  'response.data._id',
];

function compRandEmail() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `comp_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}@gmail.com`;
  }
  return `comp_${Math.random().toString(36).slice(2, 11)}${Math.random().toString(36).slice(2, 7)}@gmail.com`;
}

/**
 * Inventory scenarios from test_case.rb — run manually one step at a time.
 * @type {Array<{
 *   n: number;
 *   type: 'purchase' | 'sale' | 'purchase_return' | 'sales_return' | 'delete_purchase' | 'delete_sale' | 'delete_purchase_return' | 'delete_sales_return';
 *   label: string;
 *   qty?: number;
 *   price?: number;
 *   ref?: number;
 *   refQty?: number;
 *   expected: number;
 * }>}
 */
export const INVENTORY_TEST_CASES = [
  { n: 1, type: 'purchase', label: 'Purchase 100 @ 100', qty: 100, price: 100, expected: 100 },
  { n: 2, type: 'purchase', label: 'Purchase 50 @ 120', qty: 50, price: 120, expected: 150 },
  { n: 3, type: 'sale', label: 'Sale 40', qty: 40, expected: 110 },
  { n: 4, type: 'purchase', label: 'Purchase 60 @ 150', qty: 60, price: 150, expected: 170 },
  { n: 5, type: 'purchase_return', label: 'Purchase Return 20 @ 150', qty: 20, price: 150, expected: 150 },
  { n: 6, type: 'sale', label: 'Sale 30', qty: 30, expected: 120 },
  { n: 7, type: 'sales_return', label: 'Sales Return 10 (from #6)', qty: 10, expected: 130 },
  { n: 8, type: 'purchase', label: 'Purchase 100 @ 200', qty: 100, price: 200, expected: 230 },
  { n: 9, type: 'sale', label: 'Sale 50', qty: 50, expected: 180 },
  { n: 10, type: 'delete_purchase_return', label: 'Delete #5 Purchase Return', ref: 5, refQty: 20, expected: 200 },
  { n: 11, type: 'purchase', label: 'Purchase 80 @ 180', qty: 80, price: 180, expected: 280 },
  { n: 12, type: 'sale', label: 'Sale 70', qty: 70, expected: 210 },
  { n: 13, type: 'purchase_return', label: 'Purchase Return 10 @ 180', qty: 10, price: 180, expected: 200 },
  { n: 14, type: 'sales_return', label: 'Sales Return 5 (from #12)', qty: 5, expected: 205 },
  { n: 15, type: 'delete_sales_return', label: 'Delete #7 Sales Return', ref: 7, refQty: 10, expected: 195 },
  { n: 16, type: 'purchase', label: 'Purchase 40 @ 250', qty: 40, price: 250, expected: 235 },
  { n: 17, type: 'sale', label: 'Sale 25', qty: 25, expected: 210 },
  { n: 18, type: 'purchase', label: 'Purchase 75 @ 300', qty: 75, price: 300, expected: 285 },
  { n: 19, type: 'sale', label: 'Sale 60', qty: 60, expected: 225 },
  { n: 20, type: 'delete_purchase', label: 'Delete #2 Purchase 50 @ 120', ref: 2, refQty: 50, expected: 175 },
  { n: 21, type: 'purchase_return', label: 'Purchase Return 15 @ 300', qty: 15, price: 300, expected: 160 },
  { n: 22, type: 'sales_return', label: 'Sales Return 20 (from #19)', qty: 20, expected: 180 },
  { n: 23, type: 'purchase', label: 'Purchase 30 @ 350', qty: 30, price: 350, expected: 210 },
  { n: 24, type: 'sale', label: 'Sale 40', qty: 40, expected: 170 },
  { n: 25, type: 'purchase', label: 'Purchase 50 @ 400', qty: 50, price: 400, expected: 220 },
  { n: 26, type: 'delete_purchase_return', label: 'Delete #13 Purchase Return', ref: 13, refQty: 10, expected: 230 },
  { n: 27, type: 'sale', label: 'Sale 35', qty: 35, expected: 195 },
  { n: 28, type: 'purchase_return', label: 'Purchase Return 5 @ 400', qty: 5, price: 400, expected: 190 },
  { n: 29, type: 'sales_return', label: 'Sales Return 10 (from #27)', qty: 10, expected: 200 },
  { n: 30, type: 'delete_sale', label: 'Delete #24 Sale 40', ref: 24, refQty: 40, expected: 240 },
  { n: 31, type: 'delete_sales_return', label: 'Delete #29 Sales Return', ref: 29, refQty: 10, expected: 230 },
  { n: 32, type: 'delete_purchase', label: 'Delete #18 Purchase 75 @ 300', ref: 18, refQty: 75, expected: 155 },
];

function editedQty(tc) {
  const q = Number(tc.qty) || 0;
  return q > 1 ? q - 1 : q;
}

/** @param {{ qty: number }} tc @param {number} qty */
function saleBody(tc, qty = tc.qty) {
  const total = qty * PRODUCT_PRICE;
  return {
    name: 'Test Customer',
    email: '{{customer_email}}',
    phone: '03001234567',
    customer_id: '{{customer_id}}',
    order_status: 'active',
    discount: '0',
    shipping: '0',
    shipment: '0',
    amount_received: String(total),
    change_given: '0',
    payment_method_id: '{{payment_account_id}}',
    posPayMethod: '{{payment_account_id}}',
    'product_id[0]': '{{product_1_id}}',
    'qty[0]': String(qty),
    'price[0]': String(PRODUCT_PRICE),
  };
}

/** @param {{ n: number; qty: number; price: number }} tc @param {number} qty */
function purchaseBody(tc, qty = tc.qty) {
  const total = qty * tc.price;
  return {
    vendor_id: '{{vendor_id}}',
    ref_no: `TC-PO-${tc.n}`,
    discount: '0',
    shipment: '0',
    payment_method_accounts_id: '{{payment_account_id}}',
    account_id: '{{payment_account_id}}',
    amount_paid: String(total),
    remaining_amount: '0',
    total_amount: String(total),
    order_status: 'active',
    'product_id[0]': '{{product_1_id}}',
    'qty[0]': String(qty),
    'price[0]': String(tc.price),
    'warehouse_id[0]': '{{warehouse_1_id}}',
    'shipping_per_unit[0]': '0',
    'total_shipping[0]': '0',
  };
}

/** @param {{ n: number; qty: number; price: number }} tc @param {number} qty */
function purchaseReturnBody(tc, qty = tc.qty) {
  const total = qty * tc.price;
  return {
    vendor_id: '{{vendor_id}}',
    ref_no: `TC-PR-${tc.n}`,
    discount: '0',
    shipment: '0',
    payment_method_accounts_id: '{{receipt_account_id}}',
    account_id: '{{receipt_account_id}}',
    amount_paid: String(total),
    remaining_amount: '0',
    total_amount: String(total),
    'product_id[0]': '{{product_1_id}}',
    'qty[0]': String(qty),
    'price[0]': String(tc.price),
    'warehouse_id[0]': '{{warehouse_1_id}}',
    'shipping_per_unit[0]': '0',
    'total_shipping[0]': '0',
  };
}

/** @param {{ n: number; qty: number }} tc @param {number} qty */
function salesReturnBody(tc, qty = tc.qty) {
  const total = qty * PRODUCT_PRICE;
  return {
    customer_id: '{{customer_id}}',
    ref_no: `TC-SR-${tc.n}`,
    discount: '0',
    shipment: '0',
    payment_method_accounts_id: '{{receipt_account_id}}',
    account_id: '{{receipt_account_id}}',
    amount_paid: String(total),
    remaining_amount: '0',
    total_amount: String(total),
    'product_id[0]': '{{product_1_id}}',
    'qty[0]': String(qty),
    'price[0]': String(PRODUCT_PRICE),
    'warehouse_id[0]': '{{warehouse_1_id}}',
    'shipping_per_unit[0]': '0',
    'total_shipping[0]': '0',
  };
}

/** @param {typeof INVENTORY_TEST_CASES[number]} tc */
function buildPurchaseReturnSteps(tc) {
  const nextQty = editedQty(tc);
  const editDelta = Number(tc.qty) - nextQty;

  return [
    {
      caseNo: tc.n,
      name: `${tc.n}. ${tc.label}`,
      requiresAuth: true,
      method: 'POST',
      url: '{{url}}api/purchase_return/purchase_return_create',
      bodyType: 'form',
      body: purchaseReturnBody(tc),
      qtyLedger: { type: 'purchase_return', qty: tc.qty },
      save: { [`txn_${tc.n}_id`]: RECORD_ID_SAVE },
    },
    {
      caseNo: tc.n,
      name: `${tc.n}a. Get purchase return #${tc.n}`,
      requiresAuth: true,
      method: 'GET',
      url: `{{url}}api/purchase_return/get-purchase-return-by-return-no/{{txn_${tc.n}_id}}?populate=vendor_id`,
      body: {},
    },
    {
      caseNo: tc.n,
      name: `${tc.n}b. Edit PR #${tc.n} qty ${tc.qty} → ${nextQty}`,
      requiresAuth: true,
      method: 'PATCH',
      url: `{{url}}api/purchase_order_return/purchase_order_return_update/{{txn_${tc.n}_id}}`,
      bodyType: 'form',
      body: purchaseReturnBody(tc, nextQty),
      qtyLedger: editDelta > 0 ? { type: 'edit_purchase_return', qty: editDelta } : undefined,
      caseFinal: true,
    },
  ];
}

/** @param {typeof INVENTORY_TEST_CASES[number]} tc */
function buildSalesReturnSteps(tc) {
  const nextQty = editedQty(tc);
  const editDelta = Number(tc.qty) - nextQty;

  return [
    {
      caseNo: tc.n,
      name: `${tc.n}. ${tc.label}`,
      requiresAuth: true,
      method: 'POST',
      url: '{{url}}api/sales_return/sales_return_create',
      bodyType: 'form',
      body: salesReturnBody(tc),
      qtyLedger: { type: 'sales_return', qty: tc.qty },
      save: { [`txn_${tc.n}_id`]: RECORD_ID_SAVE },
    },
    {
      caseNo: tc.n,
      name: `${tc.n}a. Get sales return #${tc.n}`,
      requiresAuth: true,
      method: 'GET',
      url: `{{url}}api/sales_return/get-sales-return-by-return-no/{{txn_${tc.n}_id}}?populate=customer_id`,
      body: {},
    },
    {
      caseNo: tc.n,
      name: `${tc.n}b. Edit SR #${tc.n} qty ${tc.qty} → ${nextQty}`,
      requiresAuth: true,
      method: 'PATCH',
      url: `{{url}}api/sales_order_return/sales_order_return_update/{{txn_${tc.n}_id}}`,
      bodyType: 'form',
      body: salesReturnBody(tc, nextQty),
      qtyLedger: editDelta > 0 ? { type: 'edit_sales_return', qty: editDelta } : undefined,
      caseFinal: true,
    },
  ];
}

/** @param {typeof INVENTORY_TEST_CASES[number]} tc */
function buildPurchaseSteps(tc) {
  const nextQty = editedQty(tc);
  const editDelta = Number(tc.qty) - nextQty;

  return [
    {
      caseNo: tc.n,
      name: `${tc.n}. ${tc.label}`,
      requiresAuth: true,
      method: 'POST',
      url: '{{url}}api/purchase_order/purchase_order_create',
      bodyType: 'form',
      body: purchaseBody(tc),
      qtyLedger: { type: 'purchase', qty: tc.qty },
      save: { [`txn_${tc.n}_id`]: RECORD_ID_SAVE },
    },
    {
      caseNo: tc.n,
      name: `${tc.n}a. Get purchase order #${tc.n}`,
      requiresAuth: true,
      method: 'GET',
      url: `{{url}}api/purchase_order/get-purchase-order-by-purchase-item/{{txn_${tc.n}_id}}?populate=vendor_id`,
      body: {},
    },
    {
      caseNo: tc.n,
      name: `${tc.n}b. Edit PO #${tc.n} qty ${tc.qty} → ${nextQty}`,
      requiresAuth: true,
      method: 'PATCH',
      url: `{{url}}api/purchase_order/purchase_order_update/{{txn_${tc.n}_id}}`,
      bodyType: 'form',
      body: purchaseBody(tc, nextQty),
      qtyLedger: editDelta > 0 ? { type: 'edit_purchase', qty: editDelta } : undefined,
      caseFinal: true,
    },
  ];
}

/** @param {typeof INVENTORY_TEST_CASES[number]} tc */
function buildSaleSteps(tc) {
  const nextQty = editedQty(tc);
  const editDelta = Number(tc.qty) - nextQty;

  return [
    {
      caseNo: tc.n,
      name: `${tc.n}. ${tc.label}`,
      requiresAuth: true,
      method: 'POST',
      url: '{{url}}api/order/order_save',
      bodyType: 'form',
      body: saleBody(tc),
      qtyLedger: { type: 'sale', qty: tc.qty },
      save: { [`txn_${tc.n}_id`]: RECORD_ID_SAVE },
    },
    {
      caseNo: tc.n,
      name: `${tc.n}a. Get sale invoice #${tc.n}`,
      requiresAuth: true,
      method: 'GET',
      url: `{{url}}api/order/get-order-by-order-no/{{txn_${tc.n}_id}}`,
      body: {},
    },
    {
      caseNo: tc.n,
      name: `${tc.n}b. Edit sale #${tc.n} qty ${tc.qty} → ${nextQty}`,
      requiresAuth: true,
      method: 'PATCH',
      url: `{{url}}api/order/order_update/{{txn_${tc.n}_id}}`,
      bodyType: 'form',
      body: saleBody(tc, nextQty),
      qtyLedger: editDelta > 0 ? { type: 'edit_sale', qty: editDelta } : undefined,
      caseFinal: true,
    },
  ];
}

/** @param {typeof INVENTORY_TEST_CASES[number]} tc */
function buildStepsForCase(tc) {
  const base = {
    caseNo: tc.n,
    name: `${tc.n}. ${tc.label}`,
    requiresAuth: true,
    save: {},
    caseFinal: true,
  };

  switch (tc.type) {
    case 'purchase':
      return buildPurchaseSteps(tc);
    case 'sale':
      return buildSaleSteps(tc);
    case 'purchase_return':
      return buildPurchaseReturnSteps(tc);
    case 'sales_return':
      return buildSalesReturnSteps(tc);
    case 'delete_purchase':
      return [
        {
          ...base,
          method: 'DELETE',
          url: `{{url}}api/purchase_order/purchase_order_delete/{{txn_${tc.ref}_id}}`,
          body: {},
          qtyLedger: { type: 'delete_purchase', qty: tc.refQty },
        },
      ];
    case 'delete_sale':
      return [
        {
          ...base,
          method: 'DELETE',
          url: `{{url}}api/order/order_delete/{{txn_${tc.ref}_id}}`,
          body: {},
          qtyLedger: { type: 'delete_sale', qty: tc.refQty },
        },
      ];
    case 'delete_purchase_return':
      return [
        {
          ...base,
          method: 'DELETE',
          url: `{{url}}api/purchase_return/purchase_return_delete/{{txn_${tc.ref}_id}}`,
          body: {},
          qtyLedger: { type: 'delete_purchase_return', qty: tc.refQty },
        },
      ];
    case 'delete_sales_return':
      return [
        {
          ...base,
          method: 'DELETE',
          url: `{{url}}api/sales_return/sales_return_delete/{{txn_${tc.ref}_id}}`,
          body: {},
          qtyLedger: { type: 'delete_sales_return', qty: tc.refQty },
        },
      ];
    default:
      return [
        {
          ...base,
          method: 'GET',
          url: '{{url}}api/health',
          body: {},
        },
      ];
  }
}

/** @param {object[]} steps */
function assignRunningExpected(steps) {
  let runningQty = 0;
  return steps.map((step) => {
    const lg = step.qtyLedger;
    if (lg) {
      runningQty = applyQtyDelta(runningQty, qtyLedgerDelta(lg));
    }
    if (step.caseFinal) {
      return { ...step, expectedQty: runningQty };
    }
    const { expectedQty: _drop, ...rest } = step;
    return rest;
  });
}

function createSetupSteps() {
  const email = compRandEmail();
  const vendorEmail = compRandEmail().replace('comp_', 'vendor_');
  const customerEmail = compRandEmail().replace('comp_', 'cust_');

  return [
    {
      name: 'Setup: Create master user + company',
      method: 'POST',
      url: '{{url}}api/user/user_company',
      body: {
        name: 'Master user',
        email,
        password: email,
        company_name: 'Inventory test company',
        address: 'Test address',
        company_email: 'inventory_test@gmail.com',
        permissions: {
          category: { view: true, add: true, edit: true, delete: true },
          integration: { add: true, view: true, edit: true, delete: true },
          order: { add: true, view: true, edit: true, delete: true },
          process: { add: true, view: true, edit: false, delete: false },
        },
      },
      saveLiterals: {
        login_email: email,
        login_password: email,
      },
      save: {
        login_email: [
          'response.data.data.user.email',
          'response.data.user.email',
          'response.data.email',
        ],
        auth_token: AUTH_TOKEN_SAVE_PATHS,
        company_id: [
          'response.data.data.company._id',
          'response.data.data.user.company_id',
          'response.data.company._id',
        ],
        workflow_user_id: [
          'response.data.data.user._id',
          'response.data.data.user.id',
        ],
      },
    },
    {
      name: 'Setup: Login',
      method: 'POST',
      url: '{{url}}api/user/login',
      body: {
        email: '{{login_email}}',
        password: '{{login_password}}',
      },
      save: LOGIN_SAVE_MAP,
    },
    {
      name: 'Setup: Create warehouse',
      method: 'POST',
      url: '{{url}}api/warehouse/create',
      requiresAuth: true,
      body: { name: 'Test Warehouse 1' },
      save: { warehouse_1_id: WAREHOUSE_ID_SAVE },
    },
    {
      name: 'Setup: Create product',
      method: 'POST',
      requiresAuth: true,
      url: '{{url}}api/product/create-product-variation',
      body: {
        product_name: 'Inventory test product',
        product_price: PRODUCT_PRICE,
        alert_qty: 0,
        product_description: 'Inventory test case product',
        wholesale_price: 250,
        quantity: 0,
        weight: 1,
        length: 1,
        width: 1,
      },
      save: { product_1_id: PRODUCT_ID_SAVE },
    },
    {
      name: 'Setup: Create vendor',
      method: 'POST',
      requiresAuth: true,
      url: '{{url}}api/user/create',
      body: {
        name: 'Test Vendor',
        email: vendorEmail,
        password: '123456',
        phone: '03001234567',
        role: ['VENDOR'],
      },
      save: { vendor_id: USER_ID_SAVE },
    },
    {
      name: 'Setup: Create customer',
      method: 'POST',
      requiresAuth: true,
      url: '{{url}}api/user/create',
      body: {
        name: 'Test Customer',
        email: customerEmail,
        password: '123456',
        phone: '03007654321',
        role: ['CUSTOMER'],
      },
      save: {
        customer_id: USER_ID_SAVE,
        customer_email: [
          'response.data.data.user.email',
          'response.data.data.email',
          'response.data.user.email',
        ],
      },
    },
    {
      name: 'Setup: Get payment account (liability)',
      method: 'GET',
      requiresAuth: true,
      url: '{{url}}api/account/get-all-active?limit=5&account_type=current_liability',
      body: {},
      save: {
        payment_account_id: [
          'response.data.data.0._id',
          'response.data.data.0.id',
          'response.data.0._id',
        ],
      },
    },
    {
      name: 'Setup: Get receipt account (asset)',
      method: 'GET',
      requiresAuth: true,
      url: '{{url}}api/account/get-all-active?limit=5&account_type=current_asset',
      body: {},
      save: {
        receipt_account_id: [
          'response.data.data.0._id',
          'response.data.data.0.id',
          'response.data.0._id',
        ],
      },
    },
  ];
}

/** Full workflow: setup + inventory transactions from test_case.rb (+ get/edit for sales & purchases). */
export function createInventoryTestCaseSteps() {
  const txnSteps = INVENTORY_TEST_CASES.flatMap(buildStepsForCase);
  return assignRunningExpected([...createSetupSteps(), ...txnSteps]);
}
