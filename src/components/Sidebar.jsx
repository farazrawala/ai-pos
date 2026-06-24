import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import {
  FaBasketShopping,
  FaBox,
  FaBoxArchive,
  FaBoxesStacked,
  FaBuilding,
  FaGlobe,
  FaLandmark,
  FaListUl,
  FaCartShopping,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaClipboardList,
  FaCoins,
  FaDatabase,
  FaCreditCard,
  FaFileInvoice,
  FaFlask,
  FaFolder,
  FaTrademark,
  FaLaptop,
  FaLayerGroup,
  FaMoneyBillTransfer,
  FaPaperPlane,
  FaArrowsRotate,
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
import { DEBUG, APP_NAME } from '../config/env.js';
import {
  pickCompanyLogoUrl,
  extractCompanyFromUser,
  fetchCompanyById,
  getCompanyFromApiBody,
  mergeCompanyRecordForSettings,
} from '../features/company/companyAPI.js';
import { selectCompany, selectCompanyId, setCompany } from '../features/user/userSlice.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { ROUTE_PERMISSION_MODULE } from '../constants/permissionModules.js';

const navItems = [
  { to: '/', label: 'Dashboards', icon: FaLayerGroup, end: true },
  { to: '/pos', label: 'POS', icon: FaLaptop },
  { to: '/products', label: 'Products', icon: FaBox },
  { to: '/orders', label: 'Orders', icon: FaCartShopping },
  { to: '/purchase-orders', label: 'Purchase orders', icon: FaTruck },
  { to: '/purchase-order-returns', label: 'Purchase order returns', icon: FaArrowRotateLeft },
  { to: '/sales-returns', label: 'Sales returns', icon: FaArrowRotateLeft },
  { to: '/categories', label: 'Categories', icon: FaFolder },
  { to: '/brands', label: 'Brands', icon: FaTrademark },
  { to: '/integration', label: 'Integrations', icon: FaGlobe },
  { to: '/processes', label: 'Processes', icon: FaArrowsRotate },
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
  { to: '/profit-vs-gl-gap', label: 'Profit vs GL gap', icon: FaChartLine },
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
    // adminOnly: true,
    // debugOnly: true,
  },
  {
    to: '/test-case',
    label: 'Test case runner',
    icon: FaFlask,
    // adminOnly: true,
    // debugOnly: true,
  },
  { to: '/company-cache', label: 'Company cache', icon: FaDatabase },
  { to: '/company-queues', label: 'Company queues', icon: FaListUl },
];

const Sidebar = () => {
  const dispatch = useDispatch();
  const { isAdmin, canView } = usePermissions();
  const company = useSelector(selectCompany);
  const companyId = useSelector(selectCompanyId);
  const authUser = useSelector((state) => state.user.user);

  const mergedCompany = useMemo(() => {
    const fromUser = extractCompanyFromUser(authUser);
    return { ...(fromUser || {}), ...(company || {}) };
  }, [company, authUser]);

  const logoFetchAttemptedRef = useRef(false);

  useEffect(() => {
    logoFetchAttemptedRef.current = false;
  }, [companyId]);

  useEffect(() => {
    if (!companyId || logoFetchAttemptedRef.current) return undefined;

    const existingLogo =
      pickCompanyLogoUrl(company) || pickCompanyLogoUrl(extractCompanyFromUser(authUser));
    if (existingLogo) return undefined;

    logoFetchAttemptedRef.current = true;
    let cancelled = false;
    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) return;
        dispatch(
          setCompany(
            mergeCompanyRecordForSettings(fetched, company || extractCompanyFromUser(authUser))
          )
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [companyId, dispatch, company, authUser]);

  const brandLabel = useMemo(() => {
    const name = mergedCompany?.company_name || mergedCompany?.name || '';
    return String(name || APP_NAME).trim() || APP_NAME;
  }, [mergedCompany]);

  const brandLogoUrl = useMemo(() => pickCompanyLogoUrl(mergedCompany), [mergedCompany]);

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
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              width={26}
              height={26}
              className="navbar-brand-img h-100"
              alt={`${brandLabel} logo`}
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <span
              className="navbar-brand-img d-inline-flex align-items-center justify-content-center rounded bg-gradient-primary text-white text-xxs fw-bold"
              style={{ width: 26, height: 26, flexShrink: 0 }}
              aria-hidden
            >
              {brandLabel.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="ms-1 font-weight-bold">{brandLabel}</span>
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
