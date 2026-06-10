import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FaBasketShopping,
  FaBox,
  FaBoxArchive,
  FaBoxesStacked,
  FaBuilding,
  FaLandmark,
  FaCartShopping,
  FaChartBar,
  FaChartPie,
  FaClipboardList,
  FaCoins,
  FaDatabase,
  FaCreditCard,
  FaFileInvoice,
  FaFlask,
  FaFolder,
  FaLaptop,
  FaLayerGroup,
  FaMoneyBillTransfer,
  FaPaperPlane,
  FaQrcode,
  FaReceipt,
  FaScaleBalanced,
  FaSliders,
  FaTags,
  FaTruck,
  FaArrowRotateLeft,
  FaUser,
  FaCircleUser,
  FaWarehouse,
  FaXmark,
} from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import SidebarNavIcon from './SidebarNavIcon.jsx';
import { DEBUG } from '../config/env.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { ROUTE_PERMISSION_MODULE } from '../constants/permissionModules.js';

const navItems = [
  { to: '/', label: 'Dashboards', icon: FaLayerGroup, end: true },
  { to: '/pos', label: 'POS', icon: FaLaptop },
  { to: '/orders', label: 'Orders', icon: FaCartShopping },
  { to: '/products', label: 'Products', icon: FaBox },
  { to: '/purchase-orders', label: 'Purchase orders', icon: FaTruck },
  { to: '/purchase-order-returns', label: 'Purchase order returns', icon: FaArrowRotateLeft },
  { to: '/sales-returns', label: 'Sales returns', icon: FaArrowRotateLeft },
  { to: '/categories', label: 'Categories', icon: FaFolder },
  { to: '/warehouse', label: 'Warehouse', icon: FaWarehouse },
  { to: '/warehouse-inventory', label: 'Warehouse inventory', icon: FaBoxesStacked },
  { to: '/stock', label: 'Stock movements', icon: FaBoxArchive },
  { to: '/adjustments', label: 'Adjustments', icon: FaSliders },
  { to: '/company', label: 'Company', icon: FaLandmark },
  { to: '/barcode-print', label: 'Barcode print', icon: FaQrcode },
  { to: '/attributes', label: 'Attributes', icon: FaTags },
  { to: '/users', label: 'Users', icon: FaUser },
  { to: '/amount-transfers', label: 'Amount transfers', icon: FaMoneyBillTransfer },
  { to: '/branch', label: 'Branch', icon: FaBuilding },
  { to: '/accounts', label: 'Accounts', icon: FaCircleUser },
  { to: '/balance-sheet', label: 'Balance sheet', icon: FaChartBar },
  { to: '/advance-balance-sheet', label: 'Advance balance sheet', icon: FaScaleBalanced },
  { to: '/income-statement', label: 'Income statement', icon: FaChartPie },
  { to: '/ledger', label: 'User ledgers', icon: FaFileInvoice },
  { to: '/payments', label: 'Payments', icon: FaBasketShopping },
  { to: '/payment-receipts', label: 'Payment receipts', icon: FaReceipt },
  { to: '/expenses', label: 'Expenses', icon: FaCoins },
  { to: '/transactions', label: 'Transactions', icon: FaCreditCard },
  { to: '/logs', label: 'Logs', icon: FaClipboardList },
  {
    to: '/api-workflow',
    label: 'API workflow',
    icon: FaPaperPlane,
    adminOnly: true,
    debugOnly: true,
  },
  {
    to: '/test-case',
    label: 'Test case runner',
    icon: FaFlask,
    adminOnly: true,
    debugOnly: true,
  },
  { to: '/company-cache', label: 'Company cache', icon: FaDatabase, debugOnly: true },
];

const Sidebar = () => {
  const { isAdmin, canView } = usePermissions();

  const visibleNavItems = useMemo(() => {
    return navItems.filter(({ to, adminOnly, debugOnly }) => {
      if (debugOnly && !DEBUG) return false;
      if (adminOnly) return isAdmin;
      const moduleKey = ROUTE_PERMISSION_MODULE[to];
      if (moduleKey == null) return true;
      if (isAdmin) return true;
      return canView(moduleKey);
    });
  }, [canView, isAdmin]);

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
          {visibleNavItems.map(({ to, label, icon, end }) => (
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
