import { NavLink } from 'react-router-dom';
import {
  FaBasketShopping,
  FaBox,
  FaBoxArchive,
  FaBuilding,
  FaCartShopping,
  FaChartBar,
  FaChartPie,
  FaClipboardList,
  FaCoins,
  FaCreditCard,
  FaFileInvoice,
  FaFolder,
  FaLaptop,
  FaLayerGroup,
  FaPaperPlane,
  FaQrcode,
  FaReceipt,
  FaSliders,
  FaTags,
  FaTruck,
  FaUser,
  FaCircleUser,
  FaWarehouse,
  FaXmark,
} from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import SidebarNavIcon from './SidebarNavIcon.jsx';

const navItems = [
  { to: '/', label: 'Dashboards', icon: FaLayerGroup, end: true },
  { to: '/categories', label: 'Categories', icon: FaFolder },
  { to: '/products', label: 'Products', icon: FaBox },
  { to: '/barcode-print', label: 'Barcode print', icon: FaQrcode },
  { to: '/attributes', label: 'Attributes', icon: FaTags },
  { to: '/logs', label: 'Logs', icon: FaClipboardList },
  { to: '/users', label: 'Users', icon: FaUser },
  { to: '/warehouse', label: 'Warehouse', icon: FaWarehouse },
  { to: '/stock', label: 'Stock movements', icon: FaBoxArchive },
  { to: '/adjustments', label: 'Adjustments', icon: FaSliders },
  { to: '/branch', label: 'Branch', icon: FaBuilding },
  { to: '/accounts', label: 'Accounts', icon: FaCircleUser },
  { to: '/accounts/balance-sheet', label: 'Balance sheet', icon: FaChartBar },
  { to: '/accounts/income-statement', label: 'Income statement', icon: FaChartPie },
  { to: '/accounts/payments', label: 'Payments', icon: FaBasketShopping },
  { to: '/accounts/payment-receipts', label: 'Payment receipts', icon: FaReceipt },
  { to: '/expenses', label: 'Expenses', icon: FaCoins },
  { to: '/orders', label: 'Orders', icon: FaCartShopping },
  { to: '/transactions', label: 'Transactions', icon: FaCreditCard },
  { to: '/ledger', label: 'User ledgers', icon: FaFileInvoice },
  { to: '/purchase-orders', label: 'Purchase orders', icon: FaTruck },
  { to: '/pos', label: 'POS', icon: FaLaptop },
  { to: '/api-workflow', label: 'API workflow', icon: FaPaperPlane },
];

const Sidebar = () => {
  return (
    <aside
      className="sidenav bg-white navbar navbar-vertical navbar-expand-xs border-0 border-radius-xl my-3 fixed-start ms-4"
      id="sidenav-main"
    >
      <div className="sidenav-header">
        <span
          id="iconSidenav"
          className="p-3 cursor-pointer text-secondary opacity-5 position-absolute end-0 top-0 d-none d-xl-none d-inline-flex"
          role="button"
          aria-label="Close sidebar"
        >
          <NavIcon icon={FaXmark} size={18} />
        </span>
        <NavLink className="navbar-brand m-0" rel="noopener noreferrer" to="/">
          <img
            src="/assets/img/logo-ct-dark.png"
            width={26}
            height={26}
            className="navbar-brand-img h-100"
            alt="main_logo"
          />
          <span className="ms-1 font-weight-bold">Creative Tim</span>
        </NavLink>
      </div>
      <hr className="horizontal dark mt-0" />
      <div className="navbar-collapse w-auto h-auto" id="sidenav-collapse-main">
        <ul className="navbar-nav">
          {navItems.map(({ to, label, icon, end }) => (
            <li className="nav-item" key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <SidebarNavIcon icon={icon} />
                <span className="nav-link-text ms-1">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
