import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/open-sans/300.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import App from './App.jsx';
import store from './store/index.js';
import { ROUTER_BASENAME } from './config/appBase.js';
import './styles.css';

if (typeof window !== 'undefined') {
  import('./offline/syncOrders.js')
    .then(({ wireOrderSyncTriggers }) => wireOrderSyncTriggers())
    .catch((err) => {
      console.warn('[offline] Order sync triggers not started', err);
    });
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
