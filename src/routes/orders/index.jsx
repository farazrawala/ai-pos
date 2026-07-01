import OrdersListPage from './OrdersListPage.jsx';

const ORDERS_PAGE_CONFIG = {
  permissionModule: 'orders',
  pageTitle: 'Orders',
  idPrefix: 'orders',
  exportFilePrefix: 'orders',
  exportSheetTitle: 'Orders',
  exportPdfTitle: 'Orders (with line items)',
  showFetchSyncToolbar: false,
  showRowSyncButton: false,
  showIntegrationColumn: false,
};

const Orders = () => <OrdersListPage config={ORDERS_PAGE_CONFIG} />;

export default Orders;
