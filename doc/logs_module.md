# Logs Module Documentation

## Overview

The Logs module is a **read-only** list of API/audit log entries from the backend. It mirrors the category list pattern: Redux Toolkit, server-side pagination, debounced search, optional column sorting, and the same UI shell (card, table, pagination controls).

This is **not** the same as the optional **project dev log file** used during Vite dev (`vite-plugin-project-dev-log.js` → `logs.txt`). That file captures client-side diagnostic lines; this module displays **server-stored** log documents.

---

## Architecture

```
src/
├── features/
│   └── logs/
│       ├── logsAPI.js       # GET logs/get-all-active
│       └── logsSlice.js     # fetchLogs, pagination, search, sort
├── routes/
│   └── logs/
│       └── index.jsx        # List page at /logs
└── store/index.js           # logs reducer registered
```

---

## API

### `GET /api/logs/get-all-active`

- **Auth:** Bearer token (`localStorage.authToken`), same as other modules.
- **Query (optional):** `skip`, `limit`, `search`, `sortBy`, `sortOrder` — sent when the list page loads or filters change. The client converts `page` + `limit` to `skip = (page - 1) * limit`.

### Response shape (normalized in `logsAPI.js`)

The client accepts any of:

- `{ data: [...], pagination: { total, skip, limit } }`
- `{ logs: [...], pagination: { ... } }`
- `{ data: [...], total, page, ... }` (legacy)
- A bare array (client-side pagination math as fallback)

### Document fields (typical row)

| Field           | Description                                      |
|----------------|--------------------------------------------------|
| `_id`          | Mongo-style id                                   |
| `action`       | e.g. `GET GET-ALL-ACTIVE`                        |
| `url`          | Request path                                     |
| `tags`         | string array (`api`, `get`, `authenticated`, …) |
| `description`  | Human-readable line                              |
| `company_id`   | Tenant/company                                   |
| `created_by`   | User id                                          |
| `status`       | e.g. `active`                                    |
| `deletedAt`    | Usually null for active list                     |
| `createdAt`    | ISO timestamp                                    |
| `updatedAt`    | ISO timestamp                                    |

---

## Redux (`logsSlice.js`)

- **Thunk:** `fetchLogs(params)` → `fetchLogsRequest`.
- **State:** `status`, `list`, `error`, `pagination` `{ page, limit, total, totalPages }`, `search`, `sort` `{ sortBy, sortOrder }`.
- **Actions:** `setSearch`, `setPage`, `setLimit`, `setSort`, `clearError`.
- **Default page size:** 25 (category uses 10; logs are often denser).

---

## Route and navigation

- **URL:** `/logs`
- **Component:** `src/routes/logs/index.jsx`
- **Routes:** Registered in `src/App.jsx` in both route trees (with and without sidebar layout), consistent with categories/pos.
- **Sidebar:** `src/components/Sidebar.jsx` → MANAGEMENT → **Logs** (`NavLink` to `/logs`).

---

## Permissions

The list page uses `usePermissions('logs')` and redirects to `/dashboard` when `canView === false`, matching the category module pattern.

- **Admins** (`role` includes `ADMIN`) always pass `canView`.
- **Other roles** need `permissions.logs.view === true` in the user payload returned by your auth API. If the backend does not yet expose a `logs` module in permissions, non-admin users will be redirected away from `/logs` until that is added.

---

## UI behavior

- Debounced search (500 ms) updates Redux `search` and resets to page 1.
- Sort: single-click toggles asc/desc on a column; double-click clears sort. Columns wired: `action`, `url`, `description`, `status`, `createdAt` (only effective if the API honors `sortBy` / `sortOrder`).
- Tags render as small badges; long URL/description use wrapping / `text-break`.

---

## Troubleshooting

1. **Empty list / 401:** Confirm token and that the backend route matches `API_BASE_URL` + `logs/get-all-active`.
2. **Pagination wrong:** Ensure the API returns a `pagination` object with `total`, `skip`, and `limit` so the client can compute `page` and `totalPages`.
3. **Non-admins cannot open Logs:** Add `logs: { view: true }` (or equivalent) to their role permissions in the API, or temporarily relax the guard in `routes/logs/index.jsx` if the product should allow all authenticated users.
