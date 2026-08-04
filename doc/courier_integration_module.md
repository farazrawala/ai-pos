# Courier Integration Module

## Overview

CRUD for courier API credentials (TCS, Leopard, BlueEx, M&P, Call Courier, Trax, PostEx) in the AI POS app.

## Structure

```
src/
├── features/
│   └── courier/
│       ├── courierAPI.js
│       └── courierSlice.js
├── routes/
│   └── courier-integration/
│       ├── index.jsx
│       ├── add.jsx
│       └── edit.jsx
```

## API Endpoints

Base: `API_BASE_URL` from `src/config/apiConfig.js`. Backend model: `courier`.

- List: `GET /courier/get-all-active`
- Get by id: `GET /courier/get/:id`
- Create: `POST /courier/create`
- Update: `PATCH /courier/update/:id`
- Delete: `DELETE /courier/delete/:id`
- Test credentials: `POST /courier/test/:id` (optional body overrides: `url`, `login`, `password`, `token`, `account_no`, `type`). Blank password/token keep stored secrets. Also `POST /courier/test` for unsaved form values on Add.

## Routes

- `/courier-integration` — list
- `/courier-integration/add` — create
- `/courier-integration/edit/:id` — edit

## Fields

| Field | Type | Notes |
| --- | --- | --- |
| `type` | enum `tcs` \| `leopard` \| `blueex` \| `mnp` \| `call_courier` \| `trax` \| `postex` | Required, default `tcs` |
| `url` | string | Required API base URL |
| `login` | string | Required courier API login |
| `password` | string | Required on create; optional on edit (leave blank to keep) |
| `status` | `active` \| `inactive` | Default `active` |

Permission module key: `courier-integration`.
