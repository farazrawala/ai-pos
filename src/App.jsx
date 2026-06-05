import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Home from './routes/Home.jsx';
import About from './routes/About.jsx';
import Profile from './routes/Profile.jsx';
import SignIn from './routes/SignIn.jsx';
import SignUp from './routes/SignUp.jsx';
import Loader from './components/Loader.jsx';
import Dashboard from './routes/Dashboard.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Category from './routes/Category/index.jsx';
import CategoryAdd from './routes/category/add.jsx';
import CategoryEdit from './routes/category/edit.jsx';
import Product from './routes/product/index.jsx';
import ProductAdd from './routes/product/add.jsx';
import ProductEdit from './routes/product/edit.jsx';
import Attribute from './routes/attribute/index.jsx';
import AttributeAdd from './routes/attribute/add.jsx';
import AttributeEdit from './routes/attribute/edit.jsx';
import Pos from './routes/pos/index.jsx';
import PosInvoice from './routes/pos/invoice.jsx';
import Logs from './routes/logs/index.jsx';
import Users from './routes/users/index.jsx';
import UsersAdd from './routes/users/add.jsx';
import UsersEdit from './routes/users/edit.jsx';
import Warehouse from './routes/warehouse/index.jsx';
import WarehouseAdd from './routes/warehouse/add.jsx';
import WarehouseEdit from './routes/warehouse/edit.jsx';
import Branch from './routes/branch/index.jsx';
import BranchAdd from './routes/branch/add.jsx';
import BranchEdit from './routes/branch/edit.jsx';
import Accounts from './routes/accounts/index.jsx';
import AccountsEdit from './routes/accounts/edit.jsx';
import Orders from './routes/orders/index.jsx';
import PurchaseOrderLookup from './routes/purchase_order/index.jsx';
import PurchaseOrderAdd from './routes/purchase_order/add.jsx';
import PurchaseOrderEdit from './routes/purchase_order/edit.jsx';
import PurchaseOrderReturnLookup from './routes/purchase_order_return/index.jsx';
import PurchaseOrderReturnAdd from './routes/purchase_order_return/add.jsx';
import PurchaseOrderReturnEdit from './routes/purchase_order_return/edit.jsx';
import SalesReturnLookup from './routes/sales_order_return/index.jsx';
import SalesReturnAdd from './routes/sales_order_return/add.jsx';
import SalesReturnEdit from './routes/sales_order_return/edit.jsx';
import Transactions from './routes/transactions/index.jsx';
import StockListing from './routes/stock/index.jsx';
import WarehouseInventoryListing from './routes/warehouse_inventory/index.jsx';
import LedgerListingPage from './routes/ledger/index.jsx';
import UserLedgerDetailPage from './routes/ledger/UserLedgerDetailPage.jsx';
import BalanceSheetPage from './routes/balanceSheet/index.jsx';
import IncomeStatementPage from './routes/incomeStatement/index.jsx';
import PaymentManagementPage from './routes/payments/index.jsx';
import PaymentReceiptsList from './routes/payment_receipt/index.jsx';
import PaymentReceiptEditPage from './routes/payment_receipt/edit.jsx';
import ApiWorkflowRunner from './routes/ApiWorkflowRunner.jsx';
import CompanyCachePage from './routes/companyCache/index.jsx';
import BarcodePrint from './routes/barcodePrint/index.jsx';
import ExpenseIndex from './routes/expense/index.jsx';
import ExpenseAdd from './routes/expense/add.jsx';
import ExpenseEdit from './routes/expense/edit.jsx';
import AssetIndex from './routes/asset/index.jsx';
import AssetAdd from './routes/asset/add.jsx';
import AssetEdit from './routes/asset/edit.jsx';
import AdjustmentIndex from './routes/adjustment/index.jsx';
import AdjustmentAdd from './routes/adjustment/add.jsx';
import AmountTransferIndex from './routes/amount_transfer/index.jsx';
import AmountTransferAdd from './routes/amount_transfer/add.jsx';
import AmountTransferEdit from './routes/amount_transfer/edit.jsx';
import { selectIsAuthenticated } from './features/user/userSlice.js';

const App = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const hideHeader =
    location.pathname === '/signin' ||
    location.pathname === '/signup' ||
    (!isAuthenticated && location.pathname === '/api-workflow');

  // Argon "mini" mode adds body.g-sidenav-hidden (≥1200px): sidebar shrinks to ~6rem and labels get width:0 / opacity:0.
  useEffect(() => {
    const sync = () => {
      document.body.classList.remove('g-sidenav-hidden');
      document.body.classList.add('g-sidenav-show', 'g-sidenav-pinned');
    };
    sync();
    const raf = requestAnimationFrame(sync);
    const t = window.setTimeout(sync, 0);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  // Don't show sidebar/header on signin/signup, or on API workflow when logged out (public tool).
  if (hideHeader) {
    return (
      <>
        <Loader />
        <Routes>
          <Route path="/categories" element={<Category />} />
          <Route path="/categories/add" element={<CategoryAdd />} />
          <Route path="/categories/edit/:id" element={<CategoryEdit />} />
          <Route path="/products" element={<Product />} />
          <Route path="/products/add" element={<ProductAdd />} />
          <Route path="/products/edit/:id" element={<ProductEdit />} />
          <Route path="/barcode-print" element={<BarcodePrint />} />
          <Route path="/attributes" element={<Attribute />} />
          <Route path="/attributes/add" element={<AttributeAdd />} />
          <Route path="/attributes/edit/:id" element={<AttributeEdit />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/pos/invoice" element={<PosInvoice />} />
          <Route path="/pos/invoice/:invoiceId" element={<PosInvoice />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/add" element={<UsersAdd />} />
          <Route path="/users/edit/:id" element={<UsersEdit />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/warehouse/add" element={<WarehouseAdd />} />
          <Route path="/warehouse/edit/:id" element={<WarehouseEdit />} />
          <Route path="/branch" element={<Branch />} />
          <Route path="/branch/add" element={<BranchAdd />} />
          <Route path="/branch/edit/:id" element={<BranchEdit />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="/income-statement" element={<IncomeStatementPage />} />
          <Route path="/payments" element={<PaymentManagementPage />} />
          <Route path="/payment-receipts" element={<PaymentReceiptsList />} />
          <Route path="/payment-receipts/edit/:id" element={<PaymentReceiptEditPage />} />
          <Route path="/accounts/edit/:id" element={<AccountsEdit />} />
          <Route path="/expenses" element={<ExpenseIndex />} />
          <Route path="/expenses/add" element={<ExpenseAdd />} />
          <Route path="/expenses/edit/:id" element={<ExpenseEdit />} />
          <Route path="/assets" element={<AssetIndex />} />
          <Route path="/assets/add" element={<AssetAdd />} />
          <Route path="/assets/edit/:id" element={<AssetEdit />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/ledger" element={<LedgerListingPage />} />
          <Route path="/ledger/:userId" element={<UserLedgerDetailPage />} />
          <Route path="/stock" element={<StockListing />} />
          <Route path="/warehouse-inventory" element={<WarehouseInventoryListing />} />
          <Route path="/adjustments" element={<AdjustmentIndex />} />
          <Route path="/adjustments/add" element={<AdjustmentAdd />} />
          <Route path="/amount-transfers" element={<AmountTransferIndex />} />
          <Route path="/amount-transfers/add" element={<AmountTransferAdd />} />
          <Route path="/amount-transfers/edit/:id" element={<AmountTransferEdit />} />
          <Route path="/purchase-orders" element={<PurchaseOrderLookup />} />
          <Route path="/purchase-orders/add" element={<PurchaseOrderAdd />} />
          <Route path="/purchase-orders/edit/:id" element={<PurchaseOrderEdit />} />
          <Route path="/purchase-order-returns" element={<PurchaseOrderReturnLookup />} />
          <Route path="/purchase-order-returns/add" element={<PurchaseOrderReturnAdd />} />
          <Route path="/purchase-order-returns/edit/:id" element={<PurchaseOrderReturnEdit />} />
          <Route path="/sales-returns" element={<SalesReturnLookup />} />
          <Route path="/sales-returns/add" element={<SalesReturnAdd />} />
          <Route path="/sales-returns/edit/:id" element={<SalesReturnEdit />} />
          <Route path="/api-workflow" element={<ApiWorkflowRunner />} />
          <Route
            path="/"
            element={isAuthenticated ? <Home /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/about"
            element={isAuthenticated ? <About /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/signin"
            element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
          />
          <Route
            path="/signup"
            element={isAuthenticated ? <Navigate to="/" replace /> : <SignUp />}
          />
        </Routes>
      </>
    );
  }

  return (
    <div className="g-sidenav-show g-sidenav-pinned bg-gray-100">
      <Loader />
      <div className="min-height-300 bg-dark position-absolute w-100"></div>
      <Sidebar />
      <main className="main-content position-relative border-radius-lg">
        <Header />
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Home /> : <Navigate to="/signin" replace />}
          />
          <Route path="/categories" element={<Category />} />
          <Route path="/categories/add" element={<CategoryAdd />} />
          <Route path="/categories/edit/:id" element={<CategoryEdit />} />
          <Route path="/products" element={<Product />} />
          <Route path="/products/add" element={<ProductAdd />} />
          <Route path="/products/edit/:id" element={<ProductEdit />} />
          <Route path="/barcode-print" element={<BarcodePrint />} />
          <Route path="/attributes" element={<Attribute />} />
          <Route path="/attributes/add" element={<AttributeAdd />} />
          <Route path="/attributes/edit/:id" element={<AttributeEdit />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/pos/invoice" element={<PosInvoice />} />
          <Route path="/pos/invoice/:invoiceId" element={<PosInvoice />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/add" element={<UsersAdd />} />
          <Route path="/users/edit/:id" element={<UsersEdit />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/warehouse/add" element={<WarehouseAdd />} />
          <Route path="/warehouse/edit/:id" element={<WarehouseEdit />} />
          <Route path="/branch" element={<Branch />} />
          <Route path="/branch/add" element={<BranchAdd />} />
          <Route path="/branch/edit/:id" element={<BranchEdit />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="/income-statement" element={<IncomeStatementPage />} />
          <Route path="/payments" element={<PaymentManagementPage />} />
          <Route path="/payment-receipts" element={<PaymentReceiptsList />} />
          <Route path="/payment-receipts/edit/:id" element={<PaymentReceiptEditPage />} />
          <Route path="/accounts/edit/:id" element={<AccountsEdit />} />
          <Route path="/expenses" element={<ExpenseIndex />} />
          <Route path="/expenses/add" element={<ExpenseAdd />} />
          <Route path="/expenses/edit/:id" element={<ExpenseEdit />} />
          <Route path="/assets" element={<AssetIndex />} />
          <Route path="/assets/add" element={<AssetAdd />} />
          <Route path="/assets/edit/:id" element={<AssetEdit />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/ledger" element={<LedgerListingPage />} />
          <Route path="/ledger/:userId" element={<UserLedgerDetailPage />} />
          <Route path="/stock" element={<StockListing />} />
          <Route path="/warehouse-inventory" element={<WarehouseInventoryListing />} />
          <Route path="/adjustments" element={<AdjustmentIndex />} />
          <Route path="/adjustments/add" element={<AdjustmentAdd />} />
          <Route path="/amount-transfers" element={<AmountTransferIndex />} />
          <Route path="/amount-transfers/add" element={<AmountTransferAdd />} />
          <Route path="/amount-transfers/edit/:id" element={<AmountTransferEdit />} />
          <Route path="/purchase-orders" element={<PurchaseOrderLookup />} />
          <Route path="/purchase-orders/add" element={<PurchaseOrderAdd />} />
          <Route path="/purchase-orders/edit/:id" element={<PurchaseOrderEdit />} />
          <Route path="/purchase-order-returns" element={<PurchaseOrderReturnLookup />} />
          <Route path="/purchase-order-returns/add" element={<PurchaseOrderReturnAdd />} />
          <Route path="/purchase-order-returns/edit/:id" element={<PurchaseOrderReturnEdit />} />
          <Route path="/sales-returns" element={<SalesReturnLookup />} />
          <Route path="/sales-returns/add" element={<SalesReturnAdd />} />
          <Route path="/sales-returns/edit/:id" element={<SalesReturnEdit />} />
          <Route path="/api-workflow" element={<ApiWorkflowRunner />} />
          <Route path="/company-cache" element={<CompanyCachePage />} />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/about"
            element={isAuthenticated ? <About /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/signin" replace />}
          />
        </Routes>
        <Footer />
      </main>
    </div>
  );
};

export default App;
