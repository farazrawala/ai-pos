# Courier Integration Module

## Overview

CRUD for TCS / Leopard courier API credentials in the AI POS app.

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

## Routes

- `/courier-integration` — list
- `/courier-integration/add` — create
- `/courier-integration/edit/:id` — edit

## Fields

| Field | Type | Notes |
| --- | --- | --- |
| `type` | enum `tcs` \| `leopard` | Required, default `tcs` |
| `url` | string | Required API base URL |
| `login` | string | Required courier API login |
| `password` | string | Required on create; optional on edit (leave blank to keep) |
| `status` | `active` \| `inactive` | Default `active` |

Permission module key: `courier-integration`.
