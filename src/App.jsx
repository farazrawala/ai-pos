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

const App = () => {
  const location = useLocation();
  const isAuthenticated = useSelector((state) => Boolean(state.user.name));
  const hideHeader = location.pathname === '/signin' || location.pathname === '/signup';

  // Don't show sidebar/header on signin/signup pages
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
          <Route path="/accounts/edit/:id" element={<AccountsEdit />} />
          <Route path="/orders" element={<Orders />} />
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
    <div className="g-sidenav-show bg-gray-100">
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
          <Route path="/accounts/edit/:id" element={<AccountsEdit />} />
          <Route path="/orders" element={<Orders />} />
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
