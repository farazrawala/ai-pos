# AI POS React Starter

Minimal React 18 + React Router + Redux Toolkit setup that lives directly at the repository root. Everything is wired for navigation, global state, and fast iteration with Vite.

## Prerequisites

- Node.js 18+
- npm 9+ (or Yarn 1.22+)

## Install

```bash
npm install
# or
yarn install
```

## Available scripts

- `npm start` – launch Vite dev server at http://localhost:5173
- `npm run build` – bundle for production
- `npm test` – placeholder test command
- `npm run lint` – placeholder lint command

## Run locally

```bash
npm start
# or
yarn start
```

## Build

```bash
npm run build
# or
yarn build
```

## Project structure

- `src/index.js` – React entry that wraps `<App />` with `Provider` and `BrowserRouter`
- `src/App.jsx` – shared layout and top-level routes
- `src/routes/*` – Home, About, Profile pages
- `src/features/user/*` – Redux slice and connected component
- `src/store/index.js` – store configuration
- `src/styles.css` – small styling baseline

Home dispatches `setName('Guest')`, navigates to Profile, and Profile reads the Redux state via `useSelector`. `UserProfile` shows how to dispatch another action from a nested component.

