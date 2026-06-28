# Backend — Step 7 (Offline POS idempotency)

The frontend sends `client_order_id` on `POST /api/order/order_save` when syncing offline sales. The backend must treat it as an idempotency key.

## Required changes (MongoDB / API)

1. Add field `client_order_id` (string, optional) to the `orders` collection.
2. Create a **unique sparse** index on `client_order_id`.
3. Update `order_save`:
   - If request includes `client_order_id` and a matching order exists → return that order (HTTP 200), do **not** create a duplicate.
   - Otherwise → create the order as today.

## Optional

- `GET /api/order/sync-status?client_order_id=` — for timeout recovery when the client is unsure if save succeeded.

## Frontend (done)

- `createPosOrderRequest` appends `client_order_id` to FormData when present.
- Offline queue in `src/offline/syncOrders.js` uploads pending orders with the same `client_order_id` stored at sale time.

## Verify

POST the same `client_order_id` twice → one MongoDB document, identical success response both times.
