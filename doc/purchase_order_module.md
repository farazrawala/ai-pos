# Purchase Order Module Documentation

## Overview

The Purchase Order Module mirrors the [Category Module](./category_module.md): **Redux Toolkit** slice, **paginated list** (like `category/index.jsx`), plus **add** and **edit** screens (like `category/add.jsx` / `edit.jsx`) backed by conventional REST endpoints under `purchase_order/`.

---

## Architecture

```
src/
├── features/
│   └── purchaseOrders/
│       ├── purchaseOrdersAPI.js
│       └── purchaseOrdersSlice.js
├── routes/
│   └── purchase_order/
│       ├── index.jsx              # List
│       ├── add.jsx                # Create
│       ├── edit.jsx               # Update
│       └── poFormConstants.js   # Shared status enum for forms
└── config/
    └── apiConfig.js
```

---

## API (`purchaseOrdersAPI.js`)

| Export | Endpoint (under `API_BASE_URL`) |
|--------|--------------------------------|
| `fetchPurchaseOrdersListRequest` | `GET purchase_order/get-purchase-order-by-purchase-item` — `skip`, `limit`, `search`, `sortBy`, `sortOrder`, optional item filter |
| `fetchPurchaseOrderByIdRequest` | `GET purchase_order/get/:id` |
| `createPurchaseOrderRequest` | `POST purchase_order/create` — JSON body |
| `updatePurchaseOrderRequest` | `PATCH purchase_order/update/:id` — JSON body |
| `fetchPurchaseOrderByPurchaseItemRequest` | Legacy single lookup (GET/POST param retries) |
| `unwrapPurchaseOrderRecord`, `normalizePurchaseOrdersListResponse`, … | Response helpers |

**Env:** `VITE_PURCHASE_ORDER_ITEM_PARAM` — force one query/body key for item-scoped calls.

**List GET** uses `Accept: application/json` + Bearer for the list endpoint; create/update use JSON `Content-Type` (same idea as `warehouseAPI`).

---

## Redux (`purchaseOrdersSlice.js`)

| Thunk / action | Purpose |
|----------------|---------|
| `fetchPurchaseOrders` | List |
| `fetchPurchaseOrderById` | Load one PO for edit |
| `createPurchaseOrder` | Create (used by add page) |
| `updatePurchaseOrder` | Update (used by edit page) |
| `fetchPurchaseOrderByPurchaseItem` | Optional item-based fetch |
| `setSearch`, `setPage`, `setLimit`, `setSort`, `setFilterPurchaseItemId` | List controls |
| `clearCurrentPurchaseOrder`, `clearUpdateStatus`, `clearError`, `clearPurchaseOrderByItem` | Reset helpers |

**State:** `list`, `status`, `error`, `pagination`, `search`, `sort`, `filterPurchaseItemId`, `currentPurchaseOrder`, `fetchStatus`, `fetchError`, `updateStatus`, `updateError`, plus optional `byPurchaseItem*` fields.

---

## Routes (`src/App.jsx`)

| Path | Page |
|------|------|
| `/purchase-orders` | List — search, sort, pagination, **Add** / row **Edit** |
| `/purchase-orders/add` | Create form |
| `/purchase-orders/edit/:id` | Edit form |

**Sidebar:** “Purchase orders”.

---

## Forms (`add.jsx` / `edit.jsx`)

Shared fields (JSON keys — adjust to match your backend):

- `purchase_order_no` (required) — reference / PO number  
- `supplier_id` (optional)  
- `status` — select from `PO_STATUS_OPTIONS` in `poFormConstants.js`  
- `expected_delivery_date` (optional, `YYYY-MM-DD`)  
- `notes` (optional)  

Edit page loads with `fetchPurchaseOrderById`, maps nested `supplier` to `supplier_id` when present, and supports a **status** value returned by the API even if it is not in the static list.

---

## Redux usage (examples)

```javascript
import {
  fetchPurchaseOrders,
  fetchPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
} from '../features/purchaseOrders/purchaseOrdersSlice.js';

dispatch(fetchPurchaseOrders({ page: 1, limit: 10 }));
dispatch(fetchPurchaseOrderById(id));
await dispatch(createPurchaseOrder({ purchase_order_no: 'PO-1', status: 'placed' })).unwrap();
await dispatch(updatePurchaseOrder({ purchaseOrderId: id, purchaseOrderData: { status: 'confirmed' } })).unwrap();
```

---

## Store

Reducer key: **`purchaseOrders`** in `src/store/index.js`.

---

## Troubleshooting

- **404 on create/update/get:** Confirm your API uses the same paths (`purchase_order/create`, `purchase_order/update/:id`, `purchase_order/get/:id`). Rename in `purchaseOrdersAPI.js` if your routes differ.
- **Empty list:** Use the optional **Item id** filter if the list endpoint requires a purchase item id.
- **Console:** `[Purchase order module]` on failures.

---

**Last updated:** 2026
