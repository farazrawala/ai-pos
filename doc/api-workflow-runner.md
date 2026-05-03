# API Workflow Runner

Internal SPA tool for **running HTTP steps in order**, chaining data between calls with **saved variables** and **`{{placeholders}}`**. Implementation lives under `src/routes/ApiWorkflowRunner.jsx`, `src/components/apiWorkflow/`, and `src/utils/apiWorkflow/`.

## Access

| URL | Notes |
|-----|--------|
| `/api-workflow` | Available **without logging in** (minimal layout). When logged in, it also appears in the sidebar as **API workflow**. |

During local dev, Vite proxies paths under **`/api/`** (see `vite.config.js`): only URLs like `/api/signup` go to the backend. The SPA route **`/api-workflow`** is intentionally *not* under `/api/` so it is not proxied (a proxy rule on `/api` alone would catch `/api-workflow` and cause “Cannot GET” from the API server).

## Where to define your APIs

Edit **`createInitialSteps()`** (returns the workflow array) in:

`src/routes/ApiWorkflowRunner.jsx`

Each array entry is one step. Order in the array is execution order for **Run all**.

## Example: first API — master user + company

**Endpoint (your spec):** `{{url}}api/user/user_company`

- In the runner, **`{{url}}`** is always set for you: **trailing slash + API root**
  - If **Base URL** is empty → `{{url}}` = `http://localhost:5173/` (current page origin) so the resolved URL hits the Vite dev server and **`/api/...` is proxied** to your backend.
  - If **Base URL** is `http://localhost:8000` → `{{url}}` = `http://localhost:8000/`, so the request goes straight to that host.
- After substitution you get: `{url}api/user/user_company` → e.g. `http://localhost:5173/api/user/user_company`.

**Method:** `POST`

**Body (JSON)** — default in `createInitialSteps()` matches this shape:

| Field | Value |
|--------|--------|
| `name` | `Master user` |
| `email` | `company_{random_id}@gmail.com` — the app generates **`company_<timestamp>@gmail.com`** on each full page load so repeated runs are less likely to clash. |
| `password` | Same string as `email`. |
| `company_name` | `company 1` |
| `address` | `new york.` |
| `company_email` | `company_name@gmail.com` |
| `permissions` | Nested booleans for `category`, `integration`, `order`, and `process` as in your list. |

**Permissions mapping** (default uses `process` for the last block; all keys are lowercase):

- `category`: view, add, edit, delete → `true`
- `integration`: add, view, edit, delete → `true`
- `order`: add, view, edit, delete → `true`
- `process`: add, view → `true`; edit, delete → `false`

If your backend expects the typo key **`proces`** (not `process`) for edit/delete, change that key in `createInitialSteps()` to match the API.

**`save`:** left empty (`{}`) until you know the response JSON; then add entries such as `token: 'response.data.token'` for later steps.

## Step shape

| Field | Required | Description |
|--------|-----------|-------------|
| `name` | Yes | Short label shown in the left list. |
| `method` | Yes | `GET`, `POST`, `PUT`, `DELETE`, or `HEAD` (uppercase in UI; values are normalized to uppercase). |
| `url` | Yes | Path or full path. Combined with **Base URL** in the UI: `fullUrl = baseUrl + url` (slash handling is automatic). Supports `{{variables}}`. |
| `body` | Yes | JSON object for the request body. Ignored for **GET** and **HEAD** (no body is sent). |
| `save` | Optional | Object mapping **variable names** → **paths** into the Axios response (see below). Only applied when the step returns HTTP **2xx**. |

### Example: login then fetch with token

```javascript
{
  name: 'Login',
  method: 'POST',
  url: '/api/login',
  body: {
    email: 'admin@example.com',
    password: 'secret',
  },
  save: {
    token: 'response.data.token',
  },
},
{
  name: 'List products',
  method: 'GET',
  url: '/api/products?page=1',
  body: {},
  save: {
    first_product_id: 'response.data.0.id', // if your API returns an array at data
  },
},
```

Paths depend on your API’s JSON shape under Axios’s `response.data`.

## Saved variables (`save`)

After a **successful** step (status 2xx), each `save` entry runs:

- **Key** → name stored in the global variable map (also shown in **Saved variables** on the right).
- **Value** → dotted path evaluated from root `{ response: axiosResponse }`, where `response` is the full Axios response object.

Common paths:

| Path | Meaning |
|------|--------|
| `response.data` | Parsed response body (typical JSON API). |
| `response.data.id` | Field `id` on that body. |
| `response.data.user.email` | Nested field. |
| `response.headers.authorization` | Header access (if needed). |

`save` can be `{}` or omitted if nothing should be stored.

## Using variables in URLs and bodies (`{{name}}`)

Variables from earlier steps are substituted before each request.

### URLs

Plain string replacement: every `{{varName}}` is replaced with `String(value)` (empty string if missing/null).

Example: `"/api/users/{{user_id}}"` after `user_id` was saved as `42` becomes `"/api/users/42"`.

Built-in **`{{url}}`** (see section **Base URL and built-in `url` variable**) is merged before other variables so you can write step URLs like `{{url}}api/user/user_company`.

### JSON body

Rules (see `src/utils/apiWorkflow/variableReplace.js`):

1. **Whole string is only a placeholder**  
   If a string value is exactly `{{varName}}` (optional spaces), it is replaced by the **actual JavaScript value** (number, boolean, object, array, string, etc.).  
   Example: `"count": "{{total}}"` with `total` number `10` → JSON number `10` if the field was the exact token `{{total}}` as the entire string.

2. **Mixed text**  
   If the string contains other characters, each `{{varName}}` is replaced with `String(value)` so the result must remain valid JSON after substitution.

Tips:

- For IDs in URLs, `{{id}}` is enough.
- For typed JSON fields, prefer a body field whose value is exactly `{{myVar}}` so numbers and booleans stay typed.

## Controls

| Control | Behavior |
|---------|-----------|
| **Run all** | Clears saved variables, resets step statuses, runs steps **0 → n−1** in order. Stops on the first failed step. |
| **Run this step** | Runs only the selected step using **current** saved variables (does not reset the workflow). |
| **Reset** | Clears variables, statuses, and the last response panel. |
| **Enter** | Runs the **next** step (selected index + 1). Skipped when focus is in an `input` or `textarea` so the JSON editor keeps normal Enter. |

## Base URL and built-in `url` variable

Optional **Base URL** in the UI:

- **Empty** → for steps that use **`{{url}}`…** in `url`, the tool sets `{{url}}` to **`window.location.origin/`** (e.g. `http://localhost:5173/`), so `{{url}}api/user/...` becomes same-origin and **`/api/`** is still proxied by Vite.
- **Set** (e.g. `http://localhost:8000`) → `{{url}}` becomes `http://localhost:8000/` for interpolation.

For paths **without** `{{url}}` (e.g. `/api/foo` only), Base URL is still prefixed as before: empty base keeps a relative path resolved by the browser against the current origin.

Variables from **`save`** overwrite `url` if you ever store a variable named `url` (unusual).

## Success, errors, and timing

- **2xx** → step status **success**; `save` runs.
- **Non-2xx** (including 4xx/5xx with a body) → step **failed**; `save` does **not** run; response body and status still appear in **Response**.
- **Network / thrown errors** → **failed**; message and optional `error.response` data are shown.
- **Response time** is shown in milliseconds for the last completed attempt.

## UI modules

| File | Role |
|------|------|
| `src/components/apiWorkflow/WorkflowList.jsx` | Left: steps + status badges. |
| `src/components/apiWorkflow/ApiEditor.jsx` | JSON body editor for the selected step. |
| `src/components/apiWorkflow/ResponseViewer.jsx` | Status, timing, JSON body, headers. |

## Adding more APIs (checklist)

1. Open `src/routes/ApiWorkflowRunner.jsx`.
2. Append objects to the array returned from **`createInitialSteps()`** (or insert in the middle if order matters).
3. For each step, set `method`, `url`, and `body` (use `{}` for GET/HEAD).
4. Add **`save`** on steps whose responses you need later; pick paths from real responses (use browser devtools or **Response** panel once).
5. In later steps, reference those names in **`url`** or **`body`** as `{{variable_name}}`.
6. Use **Run all** to verify the chain; use **Reset** between full runs if you want a clean variable set ( **Run all** already clears variables at start ).

## Technical notes

- Requests use **`axios`** directly (not `src/api/apiClient.js`), so app-wide API client defaults and loaders do not apply to this tool.
- **DELETE** / **PUT** / **POST** send `Content-Type: application/json` and the interpolated `body`.
- Variable names in `{{...}}` for the “whole string” rule match `[\w.]+` (letters, digits, underscore, dot).

## Related files

- `src/App.jsx` — route `/api-workflow`; public minimal shell when logged out.
- `src/components/Sidebar.jsx` — nav link when using the full layout.
