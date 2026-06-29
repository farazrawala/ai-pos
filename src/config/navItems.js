import {
  FaBasketShopping,
  FaBox,
  FaBoxArchive,
  FaBoxesStacked,
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
} from 'react-icons/fa6';

/**
 * Single source of truth for app navigation, used by the sidebar.
 * Each item: `{ to, label, icon, end?, adminOnly?, debugOnly? }`.
 */
export const NAV_ITEMS = [
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
  { to: '/warehouse-inventory', label: 'Warehouse inventory', icon: FaBoxesStacked },
  { to: '/stock', label: 'Stock movements', icon: FaBoxArchive },
  { to: '/adjustments', label: 'Adjustments', icon: FaSliders },
  { to: '/company', label: 'Company', icon: FaLandmark },
  { to: '/barcode-print', label: 'Barcode print', icon: FaQrcode },
  { to: '/attributes', label: 'Attributes', icon: FaTags },
  { to: '/users', label: 'Users', icon: FaUser },
  { to: '/amount-transfers', label: 'Amount transfers', icon: FaMoneyBillTransfer },
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
  { to: '/api-workflow', label: 'API workflow', icon: FaPaperPlane },
  { to: '/test-case', label: 'Test case runner', icon: FaFlask },
  { to: '/company-cache', label: 'Company cache', icon: FaDatabase },
  { to: '/company-queues', label: 'Company queues', icon: FaListUl },
];

/**
 * Filter NAV_ITEMS by permissions/flags.
 * @param {object} opts
 * @param {boolean} opts.isAdmin
 * @param {(moduleKey: string) => boolean} opts.canView
 * @param {Record<string, string>} opts.routePermissionModule
 * @param {boolean} [opts.debug]
 */
export function filterNavItems({ isAdmin, canView, routePermissionModule, debug = false }) {
  return NAV_ITEMS.filter(({ to, adminOnly, debugOnly }) => {
    if (debugOnly && !debug) return false;
    if (adminOnly) return isAdmin;
    const moduleKey = routePermissionModule?.[to];
    if (moduleKey == null) return true;
    if (isAdmin) return true;
    return canView(moduleKey);
  });
}
