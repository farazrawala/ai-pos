# Offline POS — Implementation Plan

## Overview

This document describes how to convert the AI POS **in-store checkout** into an **offline-first** model: cashiers can sell, print receipts, and take payments without internet. When connectivity returns, pending orders sync to the existing backend (MongoDB via REST API).

**Scope:** POS screen only (`/pos`, payment modal, thermal receipt). Admin modules (products, purchases, reports) remain online-only unless extended later.

**Current state (today):**

| Area | Current behavior |
|------|------------------|
| Products / categories | Live API on every POS load |
| Customers | Live API (`fetchUsersListRequest`) |
| Payment methods | Live API in `PosPaymentModal` |
| Order save | Direct `POST /api/order/order_save` — fails offline |
| Auth | `localStorage` (`authToken`, `userData`, `companyData`) |
| Offline / PWA | Not implemented |

---

## Table of Contents

1. [Architecture](#architecture)
2. [Which database to use](#which-database-to-use)
3. [Data model (IndexedDB)](#data-model-indexeddb)
4. [Order sync when internet connects](#order-sync-when-internet-connects)
5. [Step-by-step implementation](#step-by-step-implementation)
6. [Backend changes required](#backend-changes-required)
7. [Edge cases & rules](#edge-cases--rules)
8. [Testing checklist](#testing-checklist)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (POS terminal)                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ React POS UI │──▶│ Offline layer│──▶│ IndexedDB (Dexie)    │ │
│  │ /pos         │   │ read/write   │   │ products, orders,    │ │
│  └──────────────┘   └──────────────┘   │ sync_queue, meta     │ │
│         │                  │            └──────────────────────┘ │
│         │                  │                                     │
│         ▼                  ▼                                     │
│  ┌──────────────┐   ┌──────────────┐                            │
│  │ Service      │   │ Sync worker  │  runs when `navigator.onLine`│
│  │ Worker (PWA) │   │ (background) │  or manual "Sync now"        │
│  └──────────────┘   └──────┬───────┘                            │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTPS (when online)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Existing backend API + MongoDB                      │
│  POST /api/order/order_save  (+ optional sync endpoints)         │
└─────────────────────────────────────────────────────────────────┘
```

**Principles:**

1. **Local-first writes** — Checkout never waits on the network.
2. **Server is source of truth** — After sync, server IDs and invoice numbers win.
3. **Idempotent sync** — Same offline order must not create duplicates on retry.
4. **Cached reads** — Products, customers, and settings come from IndexedDB when offline.

---

## Which database to use

### Client (POS terminal) — **IndexedDB** (via **Dexie.js**)

| Option | Verdict | Why |
|--------|---------|-----|
| **IndexedDB + Dexie** | **Recommended** | Built into every modern browser; handles large product catalogs; supports indexes and transactions; works with your existing Vite/React SPA. |
| `localStorage` | Not for POS data | 5 MB limit, no queries, no atomic multi-record writes. OK only for auth token (already used). |
| SQLite (sql.js / OPFS) | Optional later | Better for a **desktop wrapper** (Electron/Tauri). Extra complexity for a web-only POS. |
| Redux persist only | Not enough | Memory + session cache; lost on hard refresh without IndexedDB. |

**Suggested npm packages:**

- `dexie` — IndexedDB wrapper
- `dexie-react-hooks` (optional) — reactive queries in React
- `vite-plugin-pwa` + `workbox` — offline app shell + asset caching
- `uuid` — local order IDs (`client_order_id`)

### Server (unchanged) — **MongoDB**

Your backend already uses MongoDB (see project notes). Offline POS does **not** add a second server database. The flow is:

- **Offline:** orders live in IndexedDB on the device.
- **Online:** sync pushes to existing `order/order_save` (and related stock/accounting logic on the server).

---

## Data model (IndexedDB)

Suggested database name: `ai_pos_offline`

### Store: `meta`

| Key | Value |
|-----|--------|
| `last_master_sync_at` | ISO timestamp |
| `company_id` | string |
| `warehouse_id` | string |
| `sync_version` | number (bump when schema changes) |

### Store: `products`

Indexed by `_id`, `sku`, `barcode`, `category_id`.

Cache fields needed for POS: name, price, variants, stock per warehouse, images (URLs only — images cached separately by Service Worker if needed).

**Source API today:** `fetchProductsRequest` in `PosProducts.jsx`.

### Store: `categories`

**Source API:** `fetchCategoriesRequest`.

### Store: `customers`

**Source API:** `fetchUsersListRequest` with `role: 'CUSTOMER'`.

### Store: `payment_methods`

**Source API:** loaded in `PosPaymentModal.jsx`.

### Store: `company_settings`

Printer settings, product settings, logo, default customer — from `companyAPI.js` / Redux `authCompany`.

### Store: `pending_orders` (sync queue)

Each record = one offline sale waiting to upload.

```javascript
{
  client_order_id: "uuid-v4",           // idempotency key — NEVER reuse
  local_invoice_no: "OFF-20250624-001", // shown on thermal receipt offline
  payload: { /* same shape as createPosOrderRequest */ },
  cart_snapshot: { /* for receipt reprint / audit */ },
  status: "pending" | "syncing" | "synced" | "failed",
  server_order_id: null,              // filled after sync
  server_invoice_no: null,
  error_message: null,
  retry_count: 0,
  created_at: "ISO",
  synced_at: null
}
```

### Store: `local_stock_adjustments` (optional but recommended)

Track qty decrements per product/warehouse while offline so stock checks stay accurate until master sync.

---

## Order sync when internet connects

### High-level flow

```
Cashier completes sale (offline)
        │
        ▼
Save to pending_orders (status: pending)
        │
        ▼
Print thermal receipt with local_invoice_no
        │
        ▼
Decrement local stock cache
        │
        ▼
[ Internet returns OR user clicks "Sync" ]
        │
        ▼
Sync worker picks pending orders (FIFO, oldest first)
        │
        ▼
POST /api/order/order_save
  + header or field: client_order_id
        │
        ├── Success ──▶ status: synced, store server _id + invoice no
        │
        └── Failure ──▶ status: failed, retry with backoff
                        (stock conflict → show in "Sync issues" UI)
```

### Sync worker rules

1. **Trigger on:**
   - `window.addEventListener('online', ...)`
   - App startup if `navigator.onLine`
   - Manual **Sync now** button in POS header
   - Optional: `setInterval` every 60s while online and queue non-empty

2. **One order at a time** — Avoid race conditions on stock and accounting.

3. **Idempotency** — Backend must accept `client_order_id`. If the same ID is sent twice (timeout + retry), server returns the existing order instead of creating a duplicate.

4. **Auth** — Use cached `authToken` from `localStorage`. If token expired, mark sync as `failed` with "Session expired — login online" and block new offline sessions until re-login.

5. **Mapping after success:**

   ```javascript
   // pickOrderInvoiceNoFromSaveResponse + pickOrderFromSaveResult (already in pos/index.jsx)
   pending_orders[client_order_id].server_order_id = order._id;
   pending_orders[client_order_id].server_invoice_no = invoiceNo;
   pending_orders[client_order_id].status = 'synced';
   ```

6. **Optional:** Background refresh of products/stock after all pending orders sync (`last_master_sync_at`).

### Local invoice numbers offline

Server assigns real invoice numbers only after sync. Offline receipts use a **local prefix**:

- Format: `OFF-{YYYYMMDD}-{sequence}` e.g. `OFF-20250624-003`
- Sequence stored in `meta.offline_invoice_seq`
- Receipt footer note: *"Offline invoice — will sync when online"*

After sync, reprint is optional (most shops keep the offline number on the physical receipt; server record has the official number).

### Stock conflict handling

| Scenario | Behavior |
|----------|----------|
| Offline sale passes local stock check | Allow sale |
| Sync rejected (insufficient stock on server) | Mark order `failed`, alert manager, do not auto-delete |
| Manager resolution | Adjust stock on server or void order manually |

Company setting `allow_add_when_stock_insufficient` (already read in POS) should apply to **local** checks the same way.

---

## Step-by-step implementation

Implement in this order. Each step should be shippable and testable before moving on.

---

### Step 1 — Connectivity & UI foundation

**Goal:** App knows online/offline state; user sees clear status.

**Tasks:**

1. Add `useOnlineStatus()` hook (`navigator.onLine` + `online` / `offline` events).
2. POS header badge: **Online** (green) / **Offline** (amber) / **Syncing…** (blue).
3. Block or warn on first POS open if never synced while online (no cached catalog).

**Files to touch:**

- New: `src/hooks/useOnlineStatus.js`
- New: `src/components/OfflineStatusBadge.jsx`
- `src/routes/pos/index.jsx` — mount badge

**Done when:** Toggling DevTools → Network → Offline updates the badge.

---

### Step 2 — IndexedDB layer (Dexie)

**Goal:** Persistent local database with typed stores.

**Tasks:**

1. `npm install dexie uuid`
2. Create `src/offline/db.js` — schema + version migrations.
3. Create `src/offline/repositories/` — thin CRUD for each store (`productsRepo`, `ordersRepo`, etc.).
4. Export `isOfflineDbReady()` and `clearOfflineDb()` (for logout / company switch).

**Done when:** Dev console can write/read a test product record; survives page refresh.

---

### Step 3 — Master data download ("Initial sync")

**Goal:** While online, POS caches everything needed to sell offline.

**Tasks:**

1. New `src/offline/masterSync.js`:
   - Pull products (paginate until done — same as `PosProducts.jsx`).
   - Pull categories, customers (limit 2000), payment methods, company settings.
   - Upsert into IndexedDB; set `meta.last_master_sync_at`.
2. Run master sync:
   - After successful login (if POS module enabled).
   - On POS mount when online and `last_master_sync_at` older than X hours (e.g. 4h).
   - Manual **Refresh catalog** button.
3. Show progress: "Downloading products… 450/1200".

**Files to touch:**

- `src/routes/pos/PosProducts.jsx` — read from IndexedDB when offline.
- `src/routes/pos/index.jsx` — customers/categories from IndexedDB when offline.
- `src/routes/pos/PosPaymentModal.jsx` — payment methods from IndexedDB when offline.

**Done when:** Load POS → go offline → products, categories, customers, payment methods still work.

---

### Step 4 — PWA app shell (Service Worker)

**Goal:** POS app loads without network after first visit.

**Tasks:**

1. `npm install vite-plugin-pwa -D`
2. Configure `vite.config.js` — precache JS/CSS/HTML; runtime cache for product images (optional).
3. `manifest.json` — name, icons, `display: standalone` for tablet/kiosk.
4. Register SW in `src/main.jsx`.

**Done when:** Build + preview → airplane mode → app shell opens (may still need Step 3 data for catalog).

---

### Step 5 — Offline checkout (write path)

**Goal:** Complete sale without API; print receipt immediately.

**Tasks:**

1. New `src/offline/saveOfflineOrder.js`:
   - Build payload (same fields as `createPosOrderRequest` in `ordersAPI.js`).
   - Generate `client_order_id` + `local_invoice_no`.
   - Insert into `pending_orders`.
   - Apply local stock decrement.
2. In `src/routes/pos/index.jsx` — replace direct `createPosOrderRequest` call:

   ```javascript
   if (navigator.onLine) {
     // try online first; on network error fall back to offline save
   } else {
     await saveOfflineOrder(...);
   }
   ```

3. Thermal print uses `local_invoice_no` and existing `openThermalReceiptPrint`.
4. Toast: "Sale saved offline — will sync when online."

**Done when:** Offline checkout → receipt prints → record in IndexedDB → cart clears.

---

### Step 6 — Sync queue (upload path)

**Goal:** Pending orders upload automatically when online.

**Tasks:**

1. New `src/offline/syncOrders.js`:
   - `processSyncQueue()` — FIFO, one at a time.
   - Call `createPosOrderRequest` with extra `client_order_id` field (after backend Step 7).
   - Update status / handle errors / increment `retry_count`.
   - Exponential backoff: 5s, 30s, 2m, 10m (cap).
2. Wire triggers: `online` event, POS mount, manual button.
3. New `src/offline/syncStatus.js` — expose `{ pending, failed, syncing }` for UI.

**Files to touch:**

- `src/features/orders/ordersAPI.js` — append `client_order_id` to FormData when present.

**Done when:** Offline sale → go online → order appears in server admin; local status = `synced`.

---

### Step 7 — Backend idempotency (MongoDB)

**Goal:** Safe retries; no duplicate orders.

**Tasks (backend team):**

1. Add optional field `client_order_id` (string, indexed, unique sparse) on `orders` collection.
2. In `order_save` handler:
   - If `client_order_id` exists and order found → return existing order (200).
   - Else create normally.
3. Optional: `GET /api/order/sync-status?client_order_id=` for recovery after ambiguous timeouts.

**Done when:** Sending same `client_order_id` twice returns one MongoDB document.

---

### Step 8 — Sync management UI

**Goal:** Cashier/manager visibility into queue.

**Tasks:**

1. POS drawer or modal: **Pending sync** list (local invoice, time, amount, status).
2. Actions: **Sync now**, **Retry failed**, copy error for support.
3. Sidebar entry or badge count: `3 pending`.

**Done when:** Failed sync visible and retryable without DevTools.

---

### Step 9 — Login & session for offline

**Goal:** POS usable offline after at least one online login.

**Tasks:**

1. Keep current `localStorage` auth (`persistWorkflowAppSession`, `authToken`).
2. On login success → trigger master sync (Step 3).
3. If offline and no valid cached auth → show "Connect to internet to sign in."
4. Optional: extend token TTL for POS devices (backend policy).

**Done when:** Login once online → close browser → open offline → POS works.

---

### Step 10 — QA, limits, documentation

**Goal:** Production-ready offline POS.

**Tasks:**

1. Test matrix (see [Testing checklist](#testing-checklist)).
2. Document max offline duration (recommend: re-sync master data every 24h when online).
3. Document single-device scope (v1: one browser profile per register; multi-device conflict out of scope).
4. Train users: offline badge, pending sync, what to do on failed sync.

---

## Backend changes required

| Change | Priority | Notes |
|--------|----------|-------|
| `client_order_id` on order save | **Required** | Unique index in MongoDB |
| Idempotent `order_save` | **Required** | Return existing if duplicate client ID |
| Optional bulk sync endpoint | Nice to have | `POST /api/order/offline_batch_sync` for many orders |
| Longer POS device tokens | Optional | Reduces sync failures after long offline periods |
| Webhook / push for catalog updates | Future | Pull-based master sync is enough for v1 |

**Existing endpoint used for sync:**

- `POST /api/order/order_save` — `createPosOrderRequest` in `src/features/orders/ordersAPI.js`

---

## Edge cases & rules

| Topic | Rule |
|-------|------|
| Duplicate sync | Prevented by `client_order_id` unique index |
| Partial timeout | Retry; server idempotency handles double-submit |
| Edit invoice offline | v1: **disable** invoice edit offline; only new sales |
| New customer offline | v1: walk-in only offline; or queue `createCustomerUserRequest` in separate sync queue (v2) |
| Product price changed on server | Offline uses cached price at sync time; accept or flag variance (v2) |
| Multiple registers | Each device has its own IndexedDB; server is merge point |
| Logout | Clear IndexedDB or wipe company-scoped data |
| Company switch | Must run full master sync for new company |
| Storage quota | Monitor IndexedDB size; prune old `synced` orders after 30 days |

---

## Testing checklist

- [ ] Master sync completes for 1000+ products
- [ ] POS fully functional with DevTools offline
- [ ] Checkout saves to `pending_orders`
- [ ] Thermal receipt prints with local invoice number
- [ ] Going online auto-syncs pending orders
- [ ] Duplicate retry does not create duplicate server orders
- [ ] Insufficient stock on server marks order failed (not silent drop)
- [ ] Expired token shows clear error
- [ ] PWA: reload app offline after first online visit
- [ ] Logout clears sensitive offline data
- [ ] Stock decrement locally prevents overselling same SKU offline

---

## Suggested file layout (new code)

```
src/offline/
├── db.js                 # Dexie schema
├── masterSync.js         # download catalog → IndexedDB
├── saveOfflineOrder.js   # offline checkout write
├── syncOrders.js         # upload queue
├── syncStatus.js         # queue stats for UI
├── localInvoiceNo.js     # OFF-YYYYMMDD-NNN generator
└── repositories/
    ├── productsRepo.js
    ├── ordersRepo.js
    └── metaRepo.js
```

---

## Summary

| Question | Answer |
|----------|--------|
| **Client DB?** | **IndexedDB** (Dexie.js) in the browser |
| **Server DB?** | **MongoDB** (existing) — unchanged |
| **When offline?** | Save orders locally; print receipt; decrement cached stock |
| **When online?** | Background worker POSTs to `order/order_save` with `client_order_id`; updates local record with server invoice ID |
| **First step to build?** | Step 1 (online/offline UI) + Step 2 (IndexedDB schema) |

---

*Document version: 1.0 — aligned with current `src/routes/pos/` and `ordersAPI.js` implementation.*
