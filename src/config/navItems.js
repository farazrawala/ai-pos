import {
  FaArrowRotateLeft,
  FaArrowsRotate,
  FaBarcode,
  FaBasketShopping,
  FaBox,
  FaBoxArchive,
  FaBoxesStacked,
  FaCartShopping,
  FaCashRegister,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaCircleUser,
  FaClipboardCheck,
  FaClipboardList,
  FaClone,
  FaCode,
  FaCoins,
  FaComments,
  FaCreditCard,
  FaCubes,
  FaDatabase,
  FaEnvelope,
  FaFileInvoice,
  FaFileLines,
  FaFolder,
  FaGear,
  FaHeadset,
  FaLandmark,
  FaLaptop,
  FaLayerGroup,
  FaLink,
  FaListUl,
  FaMoneyBillTransfer,
  FaPaperPlane,
  FaPlug,
  FaPrint,
  FaQrcode,
  FaReceipt,
  FaRotateLeft,
  FaScaleBalanced,
  FaServer,
  FaSliders,
  FaStore,
  FaTags,
  FaTicket,
  FaTrademark,
  FaTruck,
  FaTruckFast,
  FaUser,
  FaVial,
  FaWallet,
  FaWarehouse,
  FaWhatsapp,
} from 'react-icons/fa6';

/**
 * Single source of truth for app navigation, used by the sidebar.
 * Leaf: `{ to, label, icon, end?, adminOnly?, debugOnly?, routePassword?, routePasswordLiveOnly? }`.
 * Group: `{ id, label, icon, children: leaf[] }` — expands to show children.
 */
/** Shared static password for password-gated routes (warehouses, live developer tools). */
export const ROUTE_PASSWORD = '2525';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboards', icon: FaLayerGroup, end: true },
  { to: '/pos', label: 'POS', icon: FaLaptop, end: true },
  {
    id: 'pos-products',
    label: 'Sales',
    icon: FaCashRegister,
    children: [
      { to: '/orders', label: 'Orders', icon: FaCartShopping },
      { to: '/oms', label: 'OMS', icon: FaClipboardList, routePassword: ROUTE_PASSWORD },
      { to: '/sales-returns', label: 'Sales returns', icon: FaRotateLeft },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: FaTruck,
    children: [
      { to: '/purchase-orders', label: 'Purchase orders', icon: FaTruck },
      { to: '/purchase-order-returns', label: 'Purchase order returns', icon: FaArrowRotateLeft },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: FaBox,
    children: [
      { to: '/products', label: 'Products', icon: FaCubes },
      { to: '/categories', label: 'Categories', icon: FaFolder },
      { to: '/brands', label: 'Brands', icon: FaTrademark },
      { to: '/attributes', label: 'Attributes', icon: FaTags },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: FaWallet,
    children: [
      { to: '/accounts', label: 'Accounts', icon: FaCircleUser },
      { to: '/amount-transfers', label: 'Amount transfers', icon: FaMoneyBillTransfer },
      // { to: '/balance-sheet', label: 'Balance sheet', icon: FaChartBar },
      { to: '/advance-balance-sheet', label: 'balance sheet', icon: FaScaleBalanced },
      { to: '/profit-vs-gl-gap', label: 'Profit vs GL gap', icon: FaChartLine },
      { to: '/profit-report', label: 'Profit report', icon: FaChartBar },
      { to: '/income-statement', label: 'Income statement', icon: FaChartPie },
      { to: '/ledger', label: 'User ledgers', icon: FaFileInvoice },
      { to: '/payments', label: 'Payments', icon: FaBasketShopping },
      // { to: '/payment-receipts', label: 'Payment receipts', icon: FaReceipt },
      { to: '/expenses', label: 'Expenses', icon: FaCoins },
      { to: '/transactions', label: 'Transactions', icon: FaCreditCard },
    ],
  },
  {
    id: 'barcode',
    label: 'Barcode',
    icon: FaQrcode,
    children: [
      { to: '/products/duplicate-barcodes', label: 'Duplicate barcodes', icon: FaClone },
      { to: '/barcode-print', label: 'Barcode print', icon: FaBarcode },
      { to: '/product-print', label: 'Product print', icon: FaPrint },
      { to: '/printer-settings', label: 'Printer settings', icon: FaServer },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: FaWarehouse,
    children: [
      { to: '/warehouse', label: 'Warehouses', icon: FaStore, routePassword: ROUTE_PASSWORD },
      { to: '/warehouse-inventory', label: 'Warehouse inventory', icon: FaBoxesStacked },
      { to: '/stock', label: 'Stock movements', icon: FaBoxArchive },
      { to: '/stock-recounts', label: 'Stock recounts', icon: FaClipboardCheck },
      { to: '/adjustments', label: 'Adjustments', icon: FaSliders },
      { to: '/processes', label: 'Processes', icon: FaArrowsRotate },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: FaGear,
    children: [
      { to: '/company', label: 'Company', icon: FaLandmark },
      { to: '/users', label: 'Users', icon: FaUser },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: FaPlug,
    children: [
      { to: '/integration', label: 'Integrations', icon: FaLink },
      { to: '/courier-integration', label: 'Courier Integration', icon: FaTruckFast },
    ],
  },
  {
    id: 'big-commerce',
    label: 'Big Commerce',
    icon: FaStore,
    children: [
      { to: '/big-commerce', label: 'Company directory', icon: FaStore, end: true },
      { to: '/big-commerce/requests', label: 'Store requests', icon: FaPaperPlane },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: FaWhatsapp,
    children: [
      { to: '/whatsapp-messages', label: 'WhatsApp messages', icon: FaEnvelope },
      { to: '/whatsapp-chat', label: 'WhatsApp chat', icon: FaComments },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    icon: FaHeadset,
    children: [
      { to: '/support', label: 'My tickets', icon: FaClipboardList },
      { to: '/support/new', label: 'Create ticket', icon: FaTicket },
      { to: '/admin/support', label: 'Ticket management', icon: FaClipboardList, adminOnly: true },
    ],
  },
  {
    id: 'developer-tools',
    label: 'Developer tools',
    icon: FaCode,
    children: [
      {
        to: '/logs',
        label: 'Logs',
        icon: FaFileLines,
        routePassword: ROUTE_PASSWORD,
        routePasswordLiveOnly: true,
      },
      {
        to: '/api-workflow',
        label: 'API workflow',
        icon: FaPaperPlane,
        routePassword: ROUTE_PASSWORD,
        routePasswordLiveOnly: true,
      },
      {
        to: '/test-case',
        label: 'Test case runner',
        icon: FaVial,
        routePassword: ROUTE_PASSWORD,
        routePasswordLiveOnly: true,
      },
      {
        to: '/company-cache',
        label: 'Company cache',
        icon: FaDatabase,
        routePassword: ROUTE_PASSWORD,
        routePasswordLiveOnly: true,
      },
      {
        to: '/company-queues',
        label: 'Company queues',
        icon: FaListUl,
        routePassword: ROUTE_PASSWORD,
        routePasswordLiveOnly: true,
      },
    ],
  },
];

function isLeafVisible(item, { canView, routePermissionModule, debug = false }) {
  const { to, adminOnly, debugOnly } = item;
  if (debugOnly && !debug) return false;
  if (adminOnly) return false;
  const moduleKey = routePermissionModule?.[to];
  if (moduleKey == null) return true;
  return canView(moduleKey);
}

/**
 * Filter NAV_ITEMS by permissions/flags.
 * Groups keep only visible children; empty groups are dropped.
 * @param {object} opts
 * @param {boolean} opts.isAdmin
 * @param {(moduleKey: string) => boolean} opts.canView
 * @param {Record<string, string>} opts.routePermissionModule
 * @param {boolean} [opts.debug]
 */
export function filterNavItems({ isAdmin, canView, routePermissionModule, debug = false }) {
  // ADMIN always gets the full sidebar (permissions + debug-only items).
  if (isAdmin) return [...NAV_ITEMS];

  const opts = { canView, routePermissionModule, debug };
  return NAV_ITEMS.reduce((acc, item) => {
    if (Array.isArray(item.children)) {
      const children = item.children.filter((child) => isLeafVisible(child, opts));
      if (children.length === 0) return acc;
      acc.push({ ...item, children });
      return acc;
    }
    if (isLeafVisible(item, opts)) acc.push(item);
    return acc;
  }, []);
}
