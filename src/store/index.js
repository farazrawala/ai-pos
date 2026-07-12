import { configureStore } from '@reduxjs/toolkit';
import userReducer from '../features/user/userSlice.js';
import postsReducer from '../features/posts/postsSlice.js';
import loaderReducer from '../features/loader/loaderSlice.js';
import categoriesReducer from '../features/categories/categoriesSlice.js';
import brandsReducer from '../features/brands/brandsSlice.js';
import productsReducer from '../features/products/productsSlice.js';
import attributesReducer from '../features/attributes/attributesSlice.js';
import logsReducer from '../features/logs/logsSlice.js';
import usersReducer from '../features/users/usersSlice.js';
import warehouseReducer from '../features/warehouse/warehouseSlice.js';
import branchReducer from '../features/branch/branchSlice.js';
import courierReducer from '../features/courier/courierSlice.js';
import accountsReducer from '../features/accounts/accountsSlice.js';
import ordersReducer from '../features/orders/ordersSlice.js';
import purchaseOrdersReducer from '../features/purchaseOrders/purchaseOrdersSlice.js';
import purchaseOrderReturnsReducer from '../features/purchaseOrderReturns/purchaseOrderReturnsSlice.js';
import salesReturnsReducer from '../features/salesReturns/salesReturnsSlice.js';
import transactionsReducer from '../features/transactions/transactionsSlice.js';
import stockMovementReducer from '../features/stockMovement/stockMovementSlice.js';
import incomeStatementReducer from '../features/incomeStatement/incomeStatementSlice.js';
import advanceBalanceSheetReducer from '../features/advanceBalanceSheet/advanceBalanceSheetSlice.js';
import profitVsGlGapReducer from '../features/profitVsGlGap/profitVsGlGapSlice.js';
import paymentReceiptsReducer from '../features/paymentReceipts/paymentReceiptsSlice.js';
import expensesReducer from '../features/expenses/expensesSlice.js';
import assetsReducer from '../features/assets/assetsSlice.js';
import adjustmentsReducer from '../features/adjustments/adjustmentsSlice.js';
import amountTransfersReducer from '../features/amountTransfers/amountTransfersSlice.js';
import warehouseInventoryReducer from '../features/warehouseInventory/warehouseInventorySlice.js';
import integrationReducer from '../features/integration/integrationSlice.js';
import processReducer from '../features/process/processSlice.js';
import printersReducer from '../features/printers/printersSlice.js';
import profitReportReducer from '../features/profitReport/profitReportSlice.js';
import { injectStore } from '../api/apiClient.js';

const store = configureStore({
  reducer: {
    user: userReducer,
    posts: postsReducer,
    loader: loaderReducer,
    categories: categoriesReducer,
    brands: brandsReducer,
    products: productsReducer,
    attributes: attributesReducer,
    logs: logsReducer,
    users: usersReducer,
    warehouse: warehouseReducer,
    branch: branchReducer,
    courier: courierReducer,
    accounts: accountsReducer,
    orders: ordersReducer,
    purchaseOrders: purchaseOrdersReducer,
    purchaseOrderReturns: purchaseOrderReturnsReducer,
    salesReturns: salesReturnsReducer,
    transactions: transactionsReducer,
    stockMovement: stockMovementReducer,
    incomeStatement: incomeStatementReducer,
    advanceBalanceSheet: advanceBalanceSheetReducer,
    profitVsGlGap: profitVsGlGapReducer,
    paymentReceipts: paymentReceiptsReducer,
    expenses: expensesReducer,
    assets: assetsReducer,
    adjustments: adjustmentsReducer,
    amountTransfers: amountTransfersReducer,
    warehouseInventory: warehouseInventoryReducer,
    integration: integrationReducer,
    process: processReducer,
    printers: printersReducer,
    profitReport: profitReportReducer,
  },
});

injectStore(store);

export default store;
