# Offline POS — Step-by-Step Implementation Plan

## What we are building

Convert in-store POS (`/pos`) into **offline-first**: sell and print receipts without internet; sync orders to MongoDB when connectivity returns.

| Decision | Answer |
|----------|--------|
| **Same POS UI?** | Yes — `src/routes/pos/index.jsx`, payment modal, thermal receipt unchanged |
| **Same URL?** | Yes — `/pos`, `/pos/invoice`, `/pos/invoice/:invoiceId` |
| **Client DB** | IndexedDB via Dexie.js (browser) |
| **Server DB** | MongoDB (existing) — no new server database |
| **Sync endpoint** | Existing `POST /api/order/order_save` + new `client_order_id` field |

**Scope:** POS checkout only. Admin modules (products, purchases, reports) stay online-only in v1.

---

## Implementation roadmap

Complete steps **in order**. Do not skip ahead — each step depends on the previous one.

| Step | Name | Who | Est. effort |
|------|------|-----|-------------|
| [1](#step-1--connectivity--status-ui) | Connectivity & status UI | Frontend | 0.5 day |
| [2](#step-2--indexeddb-foundation) | IndexedDB foundation | Frontend | 1 day |
| [3](#step-3--master-data-sync-download) | Master data sync (download) | Frontend | 1–2 days |
| [4](#step-4--offline-read-path-pos-catalog) | Offline read path (POS catalog) | Frontend | 1 day |
| [5](#step-5--pwa--app-shell) | PWA / app shell | Frontend | 0.5–1 day |
| [6](#step-6--offline-checkout-write-path) | Offline checkout (write path) | Frontend | 1 day |
| [7](#step-7--backend-idempotency) | Backend idempotency | Backend | 0.5–1 day |
| [8](#step-8--order-sync-queue-upload) | Order sync queue (upload) | Frontend | 1 day |
| [9](#step-9--sync-management-ui) | Sync management UI | Frontend | 0.5 day |
| [10](#step-10--login--session-offline) | Login & session offline | Frontend | 0.5 day |
| [11](#step-11--qa--go-live) | QA & go-live | Both | 1–2 days |

**Total estimate:** ~8–11 days (frontend + backend + QA).

---

## Current vs target behavior

| Area | Today | After offline POS |
|------|-------|-------------------|
| Products / categories | Live API every load | Cached in IndexedDB; API when online |
| Customers | Live API | Cached in IndexedDB |
| Payment methods | Live API | Cached in IndexedDB |
| Order save | Direct API — **fails offline** | Local queue → sync when online |
| Auth | `localStorage` | Same + require one online login |
| App load offline | Fails | PWA caches app shell |

---

# Steps

---

## Step 1 — Connectivity & status UI

**Depends on:** nothing  
**Blocks:** Steps 3–10 (all need online/offline awareness)

### Goal

App knows online/offline state. Cashier sees a clear badge on POS.

### Tasks

- [ ] Create `src/hooks/useOnlineStatus.js`
  - Read `navigator.onLine`
  - Listen to `window` `online` / `offline` events
- [ ] Create `src/components/OfflineStatusBadge.jsx`
  - **Online** — green
  - **Offline** — amber
  - **Syncing…** — blue (wire in Step 8)
- [ ] Mount badge in `src/routes/pos/index.jsx` header

### Files

| Action | Path |
|--------|------|
| New | `src/hooks/useOnlineStatus.js` |
| New | `src/components/OfflineStatusBadge.jsx` |
| Edit | `src/routes/pos/index.jsx` |

### Done when

DevTools → Network → Offline toggles the badge on `/pos` without page reload.

---

## Step 2 — IndexedDB foundation

**Depends on:** Step 1  
**Blocks:** Steps 3–10

### Goal

Persistent local database with all stores defined. Data survives page refresh.

### Tasks

- [ ] `npm install dexie uuid`
- [ ] Create `src/offline/db.js` — Dexie schema (see [IndexedDB schema](#indexeddb-schema-reference))
- [ ] Create repositories:
  - [ ] `src/offline/repositories/metaRepo.js`
  - [ ] `src/offline/repositories/productsRepo.js`
  - [ ] `src/offline/repositories/categoriesRepo.js`
  - [ ] `src/offline/repositories/customersRepo.js`
  - [ ] `src/offline/repositories/paymentMethodsRepo.js`
  - [ ] `src/offline/repositories/ordersRepo.js`
- [ ] Export helpers:
  - [ ] `isOfflineDbReady()`
  - [ ] `clearOfflineDb()` — for logout / company switch

### Files

| Action | Path |
|--------|------|
| New | `src/offline/db.js` |
| New | `src/offline/repositories/*.js` |

### Done when

Dev console can insert and read a test product; data persists after refresh.

---

## Step 3 — Master data sync (download)

**Depends on:** Step 2  
**Blocks:** Steps 4, 6, 10

### Goal

While **online**, download everything POS needs and store in IndexedDB.

### Data to download

| Data | Source (existing API) | Used in |
|------|----------------------|---------|
| Products | `fetchProductsRequest` | `PosProducts.jsx` |
| Categories | `fetchCategoriesRequest` | `pos/index.jsx` |
| Customers | `fetchUsersListRequest` (role: CUSTOMER, limit 2000) | `pos/index.jsx` |
| Payment methods | Payment modal API | `PosPaymentModal.jsx` |
| Company settings | `fetchCompanyById` / Redux `authCompany` | Printer, stock rules |

### Tasks

- [ ] Create `src/offline/masterSync.js`
  - [ ] Paginate products until all pages fetched
  - [ ] Upsert all records into IndexedDB
  - [ ] Set `meta.last_master_sync_at`, `company_id`, `warehouse_id`
- [ ] Trigger master sync when:
  - [ ] User logs in successfully (POS module enabled)
  - [ ] POS opens and last sync &gt; 4 hours ago (configurable)
  - [ ] User clicks **Refresh catalog**
- [ ] Show progress UI: `Downloading products… 450/1200`

### Files

| Action | Path |
|--------|------|
| New | `src/offline/masterSync.js` |
| Edit | Login flow / `src/routes/pos/index.jsx` (trigger sync) |

### Done when

Run master sync online → IndexedDB has products, categories, customers, payment methods. `meta.last_master_sync_at` is set.

---

## Step 4 — Offline read path (POS catalog)

**Depends on:** Steps 1, 2, 3  
**Blocks:** Step 6

### Goal

POS loads catalog from IndexedDB when offline (or when API fails).

### Tasks

- [ ] `PosProducts.jsx` — if offline → read from `productsRepo`; else API with fallback to cache
- [ ] `pos/index.jsx` — categories + customers from IndexedDB when offline
- [ ] `PosPaymentModal.jsx` — payment methods from IndexedDB when offline
- [ ] If offline and no cache → show: *"Connect to internet once to download catalog"*
- [ ] Barcode / search works on cached products (use Dexie indexes)

### Files

| Action | Path |
|--------|------|
| Edit | `src/routes/pos/PosProducts.jsx` |
| Edit | `src/routes/pos/index.jsx` |
| Edit | `src/routes/pos/PosPaymentModal.jsx` |

### Done when

1. Open `/pos` online → master sync runs  
2. DevTools → Offline  
3. Products, categories, customers, payment methods still load and search works

---

## Step 5 — PWA / app shell

**Depends on:** Step 1  
**Blocks:** Step 10 (offline app open)

### Goal

POS app HTML/JS/CSS loads without network after first visit.

### Tasks

- [ ] `npm install vite-plugin-pwa -D`
- [ ] Configure `vite.config.js` — precache JS, CSS, HTML
- [ ] Add `manifest.json` — app name, icons, `display: standalone`
- [ ] Register service worker in `src/main.jsx`
- [ ] Optional: runtime cache product images from `/uploads`

### Files

| Action | Path |
|--------|------|
| Edit | `vite.config.js` |
| Edit | `src/main.jsx` |
| New | `public/manifest.json` (or via PWA plugin) |

### Done when

`npm run build` → `npm run preview` → airplane mode → `/pos` shell opens (catalog needs Step 3–4 data).

---

## Step 6 — Offline checkout (write path)

**Depends on:** Steps 2, 4  
**Blocks:** Step 8

### Goal

Complete a sale without API. Print receipt immediately. Queue order locally.

### Tasks

- [ ] Create `src/offline/localInvoiceNo.js` — format `OFF-YYYYMMDD-NNN`
- [ ] Create `src/offline/saveOfflineOrder.js`:
  - [ ] Generate `client_order_id` (UUID v4)
  - [ ] Build payload (same shape as `createPosOrderRequest`)
  - [ ] Save to `pending_orders` with `status: pending`
  - [ ] Decrement local stock cache
  - [ ] Store `cart_snapshot` for reprint
- [ ] Edit `src/routes/pos/index.jsx` checkout handler:

  ```
  if (online) → try createPosOrderRequest
                on network error → saveOfflineOrder (fallback)
  if (offline) → saveOfflineOrder
  ```

- [ ] Thermal receipt uses `local_invoice_no` via existing `openThermalReceiptPrint`
- [ ] Receipt footer: *"Offline invoice — will sync when online"*
- [ ] Toast: *"Sale saved offline — will sync when online"*
- [ ] Clear cart after successful offline save

### Files

| Action | Path |
|--------|------|
| New | `src/offline/saveOfflineOrder.js` |
| New | `src/offline/localInvoiceNo.js` |
| Edit | `src/routes/pos/index.jsx` |

### Done when

Offline checkout → receipt prints with `OFF-…` number → order in IndexedDB `pending_orders` → cart clears.

---

## Step 7 — Backend idempotency

**Depends on:** nothing (can run in parallel with Steps 1–6)  
**Blocks:** Step 8

### Goal

Retrying the same offline order must **not** create duplicate orders in MongoDB.

### Tasks (backend team)

- [ ] Add field `client_order_id` (string) to `orders` collection
- [ ] Add unique sparse index on `client_order_id`
- [ ] Update `order_save` handler:
  - [ ] If `client_order_id` sent and order exists → return existing order (HTTP 200)
  - [ ] Else → create order as today
- [ ] Optional: `GET /api/order/sync-status?client_order_id=` for timeout recovery

### Frontend prep (can do before backend is live)

- [ ] Edit `src/features/orders/ordersAPI.js` — append `client_order_id` to FormData when present

### Done when

POST same `client_order_id` twice → one MongoDB document, same response both times.

---

## Step 8 — Order sync queue (upload)

**Depends on:** Steps 6, 7  
**Blocks:** Steps 9, 11

### Goal

When internet returns, pending orders upload automatically to server.

### Sync flow

```
pending_orders (FIFO, oldest first)
        │
        ▼
POST /api/order/order_save + client_order_id
        │
        ├── Success → status: synced, save server _id + invoice no
        └── Failure → status: failed, retry with backoff
```

### Tasks

- [ ] Create `src/offline/syncOrders.js`:
  - [ ] `processSyncQueue()` — one order at a time
  - [ ] Call `createPosOrderRequest` with `client_order_id`
  - [ ] On success: use `pickOrderFromSaveResult` / `pickOrderInvoiceNoFromSaveResponse`
  - [ ] On failure: set `error_message`, increment `retry_count`
  - [ ] Backoff: 5s → 30s → 2m → 10m (cap)
- [ ] Create `src/offline/syncStatus.js` — `{ pending, failed, syncing }`
- [ ] Wire triggers:
  - [ ] `window` `online` event
  - [ ] POS mount when `navigator.onLine`
  - [ ] Manual **Sync now** (Step 9)
  - [ ] Optional: poll every 60s while online and queue non-empty
- [ ] After all orders synced → optional background master sync (refresh stock)
- [ ] Update `OfflineStatusBadge` → **Syncing…** while queue runs

### Sync rules

| Rule | Detail |
|------|--------|
| Order | FIFO — oldest pending first |
| Concurrency | One order at a time |
| Auth | Cached `authToken`; expired token → mark failed, prompt re-login |
| Stock conflict | Server rejects → `failed`, show in Sync UI (Step 9) |

### Files

| Action | Path |
|--------|------|
| New | `src/offline/syncOrders.js` |
| New | `src/offline/syncStatus.js` |
| Edit | `src/features/orders/ordersAPI.js` |
| Edit | `src/components/OfflineStatusBadge.jsx` |

### Done when

Offline sale → go online → order appears in server admin → local status = `synced`.

---

## Step 9 — Sync management UI

**Depends on:** Step 8  
**Blocks:** Step 11

### Goal

Cashier/manager can see and manage pending/failed syncs without DevTools.

### Tasks

- [ ] POS drawer or modal: **Pending sync** list
  - [ ] Columns: local invoice #, time, amount, status, error
- [ ] Actions:
  - [ ] **Sync now**
  - [ ] **Retry failed**
  - [ ] Copy error message
- [ ] Badge on POS header: pending count (e.g. `3 pending`)
- [ ] Failed orders highlighted; do not auto-delete

### Files

| Action | Path |
|--------|------|
| New | `src/components/OfflineSyncPanel.jsx` (or similar) |
| Edit | `src/routes/pos/index.jsx` |

### Done when

Force a failed sync → error visible in UI → **Retry** works.

---

## Step 10 — Login & session offline

**Depends on:** Steps 3, 5  
**Blocks:** Step 11

### Goal

POS works offline after **one successful online login**.

### Tasks

- [ ] Keep existing `localStorage` auth (`authToken`, `userData`, `companyData`)
- [ ] On login success → run master sync (Step 3)
- [ ] If user opens app offline with no cached auth → block with: *"Connect to internet to sign in"*
- [ ] On logout → call `clearOfflineDb()` (or wipe company-scoped data)
- [ ] On company switch → full master sync for new company
- [ ] Optional (backend): longer token TTL for dedicated POS devices

### Files

| Action | Path |
|--------|------|
| Edit | Login / auth flow |
| Edit | Logout handler |

### Done when

Login online → close browser → open offline → `/pos` works with cached catalog.

---

## Step 11 — QA & go-live

**Depends on:** Steps 1–10

### Goal

Production-ready offline POS with documented limits.

### QA checklist

- [ ] Master sync completes for 1000+ products
- [ ] POS fully functional with DevTools offline
- [ ] Checkout saves to `pending_orders`
- [ ] Thermal receipt prints with local invoice number
- [ ] Going online auto-syncs pending orders
- [ ] Duplicate retry does not create duplicate server orders
- [ ] Insufficient stock on server → order marked `failed` (not silent drop)
- [ ] Expired token → clear error message
- [ ] PWA: reload app offline after first online visit
- [ ] Logout clears offline data
- [ ] Local stock decrement prevents overselling same SKU offline
- [ ] Same UI at `/pos` — no URL or layout change

### Document limits (v1)

| Topic | v1 rule |
|-------|---------|
| Offline invoice edit | Disabled — new sales only |
| New customer offline | Walk-in only (or v2 sync queue) |
| Multiple registers | Each device has own IndexedDB |
| Max offline duration | Re-sync catalog every 24h when online |
| Old synced orders | Prune from IndexedDB after 30 days |

### User training

- [ ] Explain Online / Offline / Syncing badge
- [ ] Explain pending sync count
- [ ] Explain what to do when sync fails (retry, call manager)

---

# Reference

---

## Architecture

```
Browser (POS terminal)
├── React POS UI          /pos  (same URL, same UI)
├── Offline layer         read/write IndexedDB
├── Service Worker (PWA)  cache app shell
└── Sync worker           upload when online
         │
         ▼ HTTPS
Backend API + MongoDB
└── POST /api/order/order_save
```

**Principles:**

1. Local-first writes — checkout never waits on network  
2. Server is source of truth after sync  
3. Idempotent sync — no duplicate orders on retry  
4. Cached reads when offline  

---

## IndexedDB schema reference

Database name: `ai_pos_offline`

### `meta`

| Key | Value |
|-----|--------|
| `last_master_sync_at` | ISO timestamp |
| `company_id` | string |
| `warehouse_id` | string |
| `offline_invoice_seq` | number |
| `sync_version` | number |

### `products`

Indexes: `_id`, `sku`, `barcode`, `category_id`  
Fields: name, price, variants, stock per warehouse, image URLs

### `categories` / `customers` / `payment_methods` / `company_settings`

Mirrors API response fields needed by POS.

### `pending_orders`

```javascript
{
  client_order_id: "uuid-v4",
  local_invoice_no: "OFF-20250624-001",
  payload: { /* createPosOrderRequest shape */ },
  cart_snapshot: { /* receipt reprint */ },
  status: "pending" | "syncing" | "synced" | "failed",
  server_order_id: null,
  server_invoice_no: null,
  error_message: null,
  retry_count: 0,
  created_at: "ISO",
  synced_at: null
}
```

### `local_stock_adjustments` (recommended)

Track qty decrements per product/warehouse while offline.

---

## npm packages

```bash
npm install dexie uuid
npm install vite-plugin-pwa -D
# optional
npm install dexie-react-hooks
```

---

## New file layout

```
src/offline/
├── db.js
├── masterSync.js
├── saveOfflineOrder.js
├── syncOrders.js
├── syncStatus.js
├── localInvoiceNo.js
└── repositories/
    ├── metaRepo.js
    ├── productsRepo.js
    ├── categoriesRepo.js
    ├── customersRepo.js
    ├── paymentMethodsRepo.js
    └── ordersRepo.js

src/hooks/
└── useOnlineStatus.js

src/components/
├── OfflineStatusBadge.jsx
└── OfflineSyncPanel.jsx
```

---

## Edge cases

| Topic | Rule |
|-------|------|
| Duplicate sync | `client_order_id` unique index |
| Partial timeout | Retry; idempotency prevents double order |
| Price changed on server | Offline uses cached price at sale time |
| Stock conflict on sync | Mark `failed`; manager resolves manually |
| Storage quota | Monitor size; prune old `synced` orders |

---

*Document version: 2.0 — step-first layout. Same UI, same `/pos` URL.*
