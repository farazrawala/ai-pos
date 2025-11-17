import { configureStore } from '@reduxjs/toolkit';
import userReducer from '../features/user/userSlice.js';
import postsReducer from '../features/posts/postsSlice.js';
import loaderReducer from '../features/loader/loaderSlice.js';
import categoriesReducer from '../features/categories/categoriesSlice.js';
import { injectStore } from '../api/apiClient.js';

const store = configureStore({
  reducer: {
    user: userReducer,
    posts: postsReducer,
    loader: loaderReducer,
    categories: categoriesReducer,
  },
});

injectStore(store);

export default store;
