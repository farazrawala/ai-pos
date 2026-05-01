import { configureStore } from '@reduxjs/toolkit';
import userReducer from '../features/user/userSlice.js';
import postsReducer from '../features/posts/postsSlice.js';
import loaderReducer from '../features/loader/loaderSlice.js';
import categoriesReducer from '../features/categories/categoriesSlice.js';
import productsReducer from '../features/products/productsSlice.js';
import attributesReducer from '../features/attributes/attributesSlice.js';
import logsReducer from '../features/logs/logsSlice.js';
import usersReducer from '../features/users/usersSlice.js';
import warehouseReducer from '../features/warehouse/warehouseSlice.js';
import branchReducer from '../features/branch/branchSlice.js';
import accountsReducer from '../features/accounts/accountsSlice.js';
import ordersReducer from '../features/orders/ordersSlice.js';
import purchaseOrdersReducer from '../features/purchaseOrders/purchaseOrdersSlice.js';
import transactionsReducer from '../features/transactions/transactionsSlice.js';
import stockMovementReducer from '../features/stockMovement/stockMovementSlice.js';
import incomeStatementReducer from '../features/incomeStatement/incomeStatementSlice.js';
import { injectStore } from '../api/apiClient.js';

const store = configureStore({
  reducer: {
    user: userReducer,
    posts: postsReducer,
    loader: loaderReducer,
    categories: categoriesReducer,
    products: productsReducer,
    attributes: attributesReducer,
    logs: logsReducer,
    users: usersReducer,
    warehouse: warehouseReducer,
    branch: branchReducer,
    accounts: accountsReducer,
    orders: ordersReducer,
    purchaseOrders: purchaseOrdersReducer,
    transactions: transactionsReducer,
    stockMovement: stockMovementReducer,
    incomeStatement: incomeStatementReducer,
  },
});

injectStore(store);

export default store;
