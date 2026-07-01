import OrdersListPage from '../orders/OrdersListPage.jsx';

const OMS_PAGE_CONFIG = {
  permissionModule: 'oms',
  pageTitle: 'OMS',
  pageSubtitle: 'Order Management System',
  idPrefix: 'oms',
  exportFilePrefix: 'oms',
  exportSheetTitle: 'OMS',
  exportPdfTitle: 'OMS (with line items)',
  showFetchSyncToolbar: true,
  showRowSyncButton: true,
  showIntegrationColumn: true,
};

const OMS = () => <OrdersListPage config={OMS_PAGE_CONFIG} />;

export default OMS;
