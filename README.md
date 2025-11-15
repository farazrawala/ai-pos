# AI POS React Starter

React 18 + React Router + Redux Toolkit starter that now demonstrates async data flows with Axios, loader interceptors, and a posts feature powered by JSONPlaceholder. Everything runs directly at the repository root via Vite.

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

## Project structure (highlights)

- `src/api/apiClient.js` – Axios instance + loader-aware interceptors
- `src/features/posts/` – async thunks (`postsSlice.js`) + API helpers
- `src/features/loader/loaderSlice.js` – global loader boolean
- `src/components/PostList.jsx` – fetch list + create post form
- `src/components/Loader.jsx` – overlay tied to loader slice
- `src/routes/SignIn.jsx` – Argon-inspired hero sign-in form that seeds the user slice
- `src/routes/SignUp.jsx` – matching hero layout for account creation
- `src/routes/Home.jsx` – renders `PostList` plus existing demo controls
- `src/store/index.js` – wires user, posts, loader reducers and injects store into Axios interceptors
- `src/styles.css` – adds loader + post list styling

Home still demonstrates the original user slice behavior and now also surfaces the posts experience on the same page.

