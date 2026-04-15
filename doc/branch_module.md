# Branch Module Documentation

## Overview

The Branch module provides CRUD support for branch management in the AI POS frontend.

## Implemented Structure

```
src/
├── features/
│   └── branch/
│       ├── branchAPI.js
│       └── branchSlice.js
├── routes/
│   └── branch/
│       ├── index.jsx
│       ├── add.jsx
│       └── edit.jsx
```

## API Endpoints

All API calls use `API_BASE_URL` from `src/config/apiConfig.js`.

- List: `GET /branch/get-all-active`
- Get by id: `GET /branch/get/:branchId`
- Create: `POST /branch/create`
- Update: `PATCH /branch/update/:branchId`
- Delete: `DELETE /branch/delete/:branchId`

## Routes

- `/branch` - branch list
- `/branch/add` - create branch
- `/branch/edit/:id` - edit branch

## Features

- Server-side pagination with `skip` + `limit`
- Debounced search (500ms)
- Sort support (`sortBy`, `sortOrder`)
- Add / edit form with basic validation
- Delete action with confirmation
