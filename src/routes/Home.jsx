import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FaCartShopping,
  FaCoins,
  FaFileInvoice,
  FaGlobe,
} from 'react-icons/fa6';
import NavIcon from '../components/NavIcon.jsx';
import SalesOverviewCard from '../components/dashboard/SalesOverviewCard.jsx';
import PosSalesMonthWiseCard from '../components/dashboard/PosSalesMonthWiseCard.jsx';
import PosPurchasesSummaryCard from '../components/dashboard/PosPurchasesSummaryCard.jsx';
import PosTopProductsCard from '../components/dashboard/PosTopProductsCard.jsx';
import PosPeakHoursCard from '../components/dashboard/PosPeakHoursCard.jsx';
import PosTopVendorsCard from '../components/dashboard/PosTopVendorsCard.jsx';
import PosDailyOrdersCard from '../components/dashboard/PosDailyOrdersCard.jsx';
import PosAvgOrderValueCard from '../components/dashboard/PosAvgOrderValueCard.jsx';
import PosSalesByCategoryCard from '../components/dashboard/PosSalesByCategoryCard.jsx';
import PosAccountsReceivableSummaryCard from '../components/dashboard/PosAccountsReceivableSummaryCard.jsx';
import PosReceivablesByCustomerCard from '../components/dashboard/PosReceivablesByCustomerCard.jsx';
import PosReceivablesAgingCard from '../components/dashboard/PosReceivablesAgingCard.jsx';
import PosExpenseSummaryCard from '../components/dashboard/PosExpenseSummaryCard.jsx';
import PosExpensesByAccountCard from '../components/dashboard/PosExpensesByAccountCard.jsx';
import PosExpenseVsRevenueCard from '../components/dashboard/PosExpenseVsRevenueCard.jsx';
import PosGrossMarginTrendCard from '../components/dashboard/PosGrossMarginTrendCard.jsx';
import PosCogsVsSalesCard from '../components/dashboard/PosCogsVsSalesCard.jsx';
import PosInventoryValueCard from '../components/dashboard/PosInventoryValueCard.jsx';
import PosDiscountTotalsCard from '../components/dashboard/PosDiscountTotalsCard.jsx';
import PosLedgerDebitCreditCard from '../components/dashboard/PosLedgerDebitCreditCard.jsx';
import DashboardChartErrorBoundary from '../components/dashboard/DashboardChartErrorBoundary.jsx';
import LowStockAlertsTable from '../components/dashboard/LowStockAlertsTable.jsx';
import { formatCurrency } from '../components/balanceSheet/formatCurrency.js';
import { useCurrentMonthSales } from '../hooks/useCurrentMonthSales.js';
import { useTodaySales } from '../hooks/useTodaySales.js';
import { useTotalCustomers } from '../hooks/useTotalCustomers.js';
import { useTotalUsers } from '../hooks/useTotalUsers.js';
import { setName, clearUser } from '../features/user/userSlice.js';

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const name = useSelector((state) => state.user.name);
  const { loading: salesLoading, totalAmount, orderCount, momPercent, error: salesError } =
    useCurrentMonthSales();
  const {
    loading: customersLoading,
    customerCount,
    error: customersError,
  } = useTotalCustomers();
  const { loading: usersLoading, userCount, error: usersError } = useTotalUsers();
  const {
    loading: todayLoading,
    todayAmount,
    dodPercent,
    orderCount: todayOrderCount,
    error: todayError,
  } = useTodaySales();

  useEffect(() => {
    const initScrollbar = () => {
      if (window.Scrollbar) {
        try {
          const win = navigator.platform.indexOf('Win') > -1;
          const scrollbarElement = document.querySelector('#sidenav-scrollbar');
          if (win && scrollbarElement) {
            const options = {
              damping: '0.5',
            };
            window.Scrollbar.init(scrollbarElement, options);
          }
        } catch (error) {
          console.error('Scrollbar initialization error:', error);
        }
      }
    };

    // Wait for scripts to load
    const checkAndInit = () => {
      initScrollbar();
    };

    // Try after a delay to ensure scripts are loaded
    const timeoutId = setTimeout(checkAndInit, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-lg-12">
            <div className="row">
              {/* Stats Cards */}
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">
                            Today's Money
                          </p>
                          <h5 className="font-weight-bolder">
                            {todayLoading
                              ? '—'
                              : todayError
                                ? '—'
                                : formatCurrency(todayAmount ?? 0)}
                          </h5>
                          <p className="mb-0">
                            {todayLoading ? (
                              <span className="text-secondary text-sm">Loading…</span>
                            ) : todayError ? (
                              <span className="text-danger text-sm">{todayError}</span>
                            ) : dodPercent != null ? (
                              <>
                                <span
                                  className={`text-sm font-weight-bolder ${
                                    dodPercent >= 0 ? 'text-success' : 'text-danger'
                                  }`}
                                >
                                  {dodPercent >= 0 ? '+' : ''}
                                  {Math.round(dodPercent)}%
                                </span>{' '}
                                since yesterday
                              </>
                            ) : (
                              <span className="text-secondary text-sm">
                                {todayOrderCount ?? 0} order
                                {(todayOrderCount ?? 0) === 1 ? '' : 's'} today
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-primary shadow-primary text-center rounded-circle d-flex align-items-center justify-content-center">
                          <NavIcon icon={FaCoins} className="text-white opacity-10" size={22} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">
                            Today's Users
                          </p>
                          <h5 className="font-weight-bolder">
                            {usersLoading
                              ? '—'
                              : usersError
                                ? '—'
                                : (userCount ?? 0).toLocaleString()}
                          </h5>
                          <p className="mb-0">
                            {usersLoading ? (
                              <span className="text-secondary text-sm">Loading…</span>
                            ) : usersError ? (
                              <span className="text-danger text-sm">{usersError}</span>
                            ) : (
                              <span className="text-secondary text-sm">total users</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-danger shadow-danger text-center rounded-circle">
                          <NavIcon icon={FaGlobe} className="text-white opacity-10" size={22} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">
                            New Clients
                          </p>
                          <h5 className="font-weight-bolder">
                            {customersLoading
                              ? '—'
                              : customersError
                                ? '—'
                                : (customerCount ?? 0).toLocaleString()}
                          </h5>
                          <p className="mb-0">
                            {customersLoading ? (
                              <span className="text-secondary text-sm">Loading…</span>
                            ) : customersError ? (
                              <span className="text-danger text-sm">{customersError}</span>
                            ) : (
                              <span className="text-secondary text-sm">total customers</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-success shadow-success text-center rounded-circle">
                          <NavIcon icon={FaFileInvoice} className="text-white opacity-10" size={22} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-12">
                <div className="card mb-4">
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-8">
                        <div className="numbers">
                          <p className="text-sm mb-0 text-uppercase font-weight-bold">Sales</p>
                          <h5 className="font-weight-bolder">
                            {salesLoading
                              ? '—'
                              : salesError
                                ? '—'
                                : formatCurrency(totalAmount ?? 0)}
                          </h5>
                          <p className="mb-0">
                            {salesLoading ? (
                              <span className="text-secondary text-sm">Loading…</span>
                            ) : salesError ? (
                              <span className="text-danger text-sm">{salesError}</span>
                            ) : momPercent != null ? (
                              <>
                                <span
                                  className={`text-sm font-weight-bolder ${
                                    momPercent >= 0 ? 'text-success' : 'text-danger'
                                  }`}
                                >
                                  {momPercent >= 0 ? '+' : ''}
                                  {Math.round(momPercent)}%
                                </span>{' '}
                                than last month
                              </>
                            ) : (
                              <span className="text-secondary text-sm">
                                {orderCount ?? 0} order{(orderCount ?? 0) === 1 ? '' : 's'} this
                                month
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="col-4 text-end">
                        <div className="icon icon-shape bg-gradient-warning shadow-warning text-center rounded-circle">
                          <NavIcon icon={FaCartShopping} className="text-white opacity-10" size={22} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-7">
            <SalesOverviewCard />
          </div>
          <div className="col-lg-5">
            <PosPurchasesSummaryCard />
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-12">
            <DashboardChartErrorBoundary title="Sales by month">
              <PosSalesMonthWiseCard />
            </DashboardChartErrorBoundary>
          </div>
        </div>
        <div className="row mt-1 mb-2">
          <div className="col-12">
            <h5 className="mb-1">Profit, inventory &amp; ledger</h5>
            <p className="text-sm text-secondary mb-0">
              Gross margin, COGS vs sales, inventory value, discounts, and ledger debit/credit
            </p>
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-7">
            <DashboardChartErrorBoundary title="Gross profit / margin trend">
              <PosGrossMarginTrendCard />
            </DashboardChartErrorBoundary>
          </div>
          <div className="col-lg-5">
            <DashboardChartErrorBoundary title="COGS vs sales">
              <PosCogsVsSalesCard />
            </DashboardChartErrorBoundary>
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-4">
            <DashboardChartErrorBoundary title="Inventory value (COGA)">
              <PosInventoryValueCard />
            </DashboardChartErrorBoundary>
          </div>
          <div className="col-lg-4">
            <DashboardChartErrorBoundary title="Discount totals">
              <PosDiscountTotalsCard />
            </DashboardChartErrorBoundary>
          </div>
          <div className="col-lg-4">
            <DashboardChartErrorBoundary title="Ledger debit / credit">
              <PosLedgerDebitCreditCard />
            </DashboardChartErrorBoundary>
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-4">
            <PosTopProductsCard />
          </div>
          <div className="col-lg-4">
            <PosPeakHoursCard />
          </div>
          <div className="col-lg-4">
            <PosTopVendorsCard />
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-4">
            <PosDailyOrdersCard />
          </div>
          <div className="col-lg-4">
            <PosAvgOrderValueCard />
          </div>
          <div className="col-lg-4">
            <PosExpenseSummaryCard />
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-4">
            <PosAccountsReceivableSummaryCard />
          </div>
          <div className="col-lg-4">
            <PosReceivablesByCustomerCard />
          </div>
          <div className="col-lg-4">
            <PosReceivablesAgingCard />
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            <PosSalesByCategoryCard />
          </div>
          <div className="col-lg-6">
            <PosExpensesByAccountCard />
          </div>
        </div>
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            <PosExpenseVsRevenueCard />
          </div>
        </div>
        <div className="row g-4">
          <div className="col-12">
            <LowStockAlertsTable />
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
