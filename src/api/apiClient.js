import axios from 'axios';
import { showLoader, hideLoader } from '../features/loader/loaderSlice.js';

let storeRef;
let pendingRequests = 0;

export const injectStore = (store) => {
  storeRef = store;
};

const apiClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

const startLoader = () => {
  pendingRequests += 1;
  storeRef?.dispatch(showLoader());
};

const stopLoader = () => {
  pendingRequests = Math.max(pendingRequests - 1, 0);
  if (pendingRequests === 0) {
    storeRef?.dispatch(hideLoader());
  }
};

apiClient.interceptors.request.use(
  (config) => {
    startLoader();

    // Add Bearer token to all requests if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    stopLoader();
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    stopLoader();
    return response;
  },
  (error) => {
    stopLoader();
    return Promise.reject(error);
  }
);

export default apiClient;
