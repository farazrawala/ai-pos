# Offline POS — QA checklist (Step 11)

Use this before enabling offline POS in production. Frontend implementation is complete; backend Step 7 (idempotency) must be live before testing duplicate-retry scenarios.

## Setup

1. Sign in online once (master sync runs).
2. Open `/pos` and confirm **Online** badge (green).
3. For PWA tests: run production build (`npm run build:live` or preview) and load once online.

## Tests

| # | Test | Steps | Pass |
|---|------|-------|------|
| 1 | Master sync (large catalog) | Login → wait for sync → **Refresh catalog** if needed | [ ] |
| 2 | Offline POS | DevTools → Network → Offline → search products, add to cart, pay | [ ] |
| 3 | Local order queue | After offline sale → Application → IndexedDB → `ai_pos_offline` → `pending_orders` has row | [ ] |
| 4 | Local invoice | Receipt shows `OFF-YYYYMMDD-NNN` | [ ] |
| 5 | Auto sync | Go online → badge shows **Syncing…** → order status `synced` in Pending sync panel | [ ] |
| 6 | Idempotent retry | With backend Step 7: retry same order / duplicate POST → one server order | [ ] |
| 7 | Stock conflict | Sync order that exceeds server stock → status `failed`, error visible | [ ] |
| 8 | Expired token | Clear `authToken` → sync → failed with “sign in again” message | [ ] |
| 9 | PWA offline reload | After first online visit, reload tab offline → POS shell loads | [ ] |
| 10 | Logout clears data | Logout → IndexedDB `ai_pos_offline` empty or recreated empty | [ ] |
| 11 | Local stock guard | Two offline sales same SKU until local qty 0 → second blocked or warned | [ ] |
| 12 | UI unchanged | Same `/pos` layout, payment modal, receipt flow | [ ] |

## Cashier training (2 min)

- **Online** — normal operation; orders go to server immediately.
- **Offline** — sales still work; receipt uses `OFF-…` number.
- **Syncing…** — uploading queued sales; wait before closing browser if possible.
- **N pending** — open **Pending sync** from POS header; use **Sync now** when online.
- **Failed** — read error, **Retry failed** when online; call manager if stock/auth errors persist.

## Known v1 limits

- No offline invoice edit; new sales only.
- New customers offline: walk-in only.
- Each register/device has its own IndexedDB.
- Re-sync catalog when online at least every 24h.
