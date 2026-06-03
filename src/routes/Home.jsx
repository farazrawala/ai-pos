import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FaCamera,
  FaCartShopping,
  FaCoins,
  FaFileInvoice,
  FaGlobe,
  FaLightbulb,
  FaTrophy,
} from 'react-icons/fa6';
import NavIcon from '../components/NavIcon.jsx';
import SalesOverviewCard from '../components/dashboard/SalesOverviewCard.jsx';
import { formatCurrency } from '../components/balanceSheet/formatCurrency.js';
import { useCurrentMonthSales } from '../hooks/useCurrentMonthSales.js';
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
                          <h5 className="font-weight-bolder">$53,000</h5>
                          <p className="mb-0">
                            <span className="text-success text-sm font-weight-bolder">+55%</span>
                            since yesterday
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
        <div className="row">
          <div className="col-lg-7 mb-4 mb-lg-0">
            <SalesOverviewCard />
          </div>
          <div className="col-lg-5">
            <div className="card card-carousel overflow-hidden h-100 p-0">
              <div
                id="carouselExampleCaptions"
                className="carousel slide h-100"
                data-bs-ride="carousel"
              >
                <div className="carousel-inner border-radius-lg h-100">
                  <div
                    className="carousel-item h-100 active"
                    style={{
                      backgroundImage: "url('/assets/img/img-2.jpg')",
                      backgroundSize: 'cover',
                    }}
                  >
                    <div className="carousel-caption d-none d-md-block bottom-0 text-start start-0 ms-5">
                      <div className="icon icon-shape icon-sm bg-white text-center border-radius-md mb-3">
                        <NavIcon icon={FaCamera} className="text-dark opacity-10" size={18} />
                      </div>
                      <h5 className="text-white mb-1">Get started with Argon</h5>
                      <p>
                        There's nothing I really wanted to do in life that I wasn't able to get good
                        at.
                      </p>
                    </div>
                  </div>
                  <div
                    className="carousel-item h-100"
                    style={{
                      backgroundImage: "url('/assets/img/img-1.jpg')",
                      backgroundSize: 'cover',
                    }}
                  >
                    <div className="carousel-caption d-none d-md-block bottom-0 text-start start-0 ms-5">
                      <div className="icon icon-shape icon-sm bg-white text-center border-radius-md mb-3">
                        <NavIcon icon={FaLightbulb} className="text-dark opacity-10" size={18} />
                      </div>
                      <h5 className="text-white mb-1">Faster way to create web pages</h5>
                      <p>
                        That's my skill. I'm not really specifically talented at anything except for
                        the ability to learn.
                      </p>
                    </div>
                  </div>
                  <div
                    className="carousel-item h-100"
                    style={{
                      backgroundImage: "url('/assets/img/img-3.jpg')",
                      backgroundSize: 'cover',
                    }}
                  >
                    <div className="carousel-caption d-none d-md-block bottom-0 text-start start-0 ms-5">
                      <div className="icon icon-shape icon-sm bg-white text-center border-radius-md mb-3">
                        <NavIcon icon={FaTrophy} className="text-dark opacity-10" size={18} />
                      </div>
                      <h5 className="text-white mb-1">Share with us your design tips!</h5>
                      <p>
                        Don't be afraid to be wrong because you can't learn anything from a
                        compliment.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  className="carousel-control-prev w-5 me-3"
                  type="button"
                  data-bs-target="#carouselExampleCaptions"
                  data-bs-slide="prev"
                >
                  <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                  <span className="visually-hidden">Previous</span>
                </button>
                <button
                  className="carousel-control-next w-5 me-3"
                  type="button"
                  data-bs-target="#carouselExampleCaptions"
                  data-bs-slide="next"
                >
                  <span className="carousel-control-next-icon" aria-hidden="true"></span>
                  <span className="visually-hidden">Next</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
