import { useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';

/** Strip PerfectScrollbar DOM/classes (Argon may init on .sidenav on Windows after React mounts). */
const stripPerfectScrollbar = (el) => {
  if (!el) return;
  el.querySelectorAll('.ps__rail-x, .ps__rail-y').forEach((n) => n.remove());
  el.className = el.className
    .split(/\s+/)
    .filter((c) => c && c !== 'ps' && !c.startsWith('ps__') && !c.startsWith('ps--'))
    .join(' ');
};

const Sidebar = () => {
  const name = useSelector((state) => state.user.name);
  const navigate = useNavigate();
  // useLayoutEffect(() => {
  //   const aside = document.getElementById('sidenav-main');
  //   const nav = document.getElementById('sidenav-collapse-main');
  //   stripPerfectScrollbar(aside);
  //   stripPerfectScrollbar(nav);
  //   if (aside) {
  //     aside.style.setProperty('max-width', '15.625rem', 'important');
  //     aside.style.setProperty('min-width', '13rem', 'important');
  //     aside.style.setProperty('visibility', 'visible', 'important');
  //   }
  //   if (nav) {
  //     nav.style.setProperty('display', 'block', 'important');
  //     nav.style.setProperty('height', 'auto', 'important');
  //     nav.style.setProperty('min-height', '10rem', 'important');
  //     nav.style.setProperty('overflow-y', 'auto', 'important');
  //   }
  // }, []);

  return (
    <aside
      className="sidenav bg-white navbar navbar-vertical navbar-expand-xs border-0 border-radius-xl my-3 fixed-start ms-4"
      id="sidenav-main"
    >
      <div className="sidenav-header">
        <i
          className="fas fa-times p-3 cursor-pointer text-secondary opacity-5 position-absolute end-0 top-0 d-none d-xl-none"
          aria-hidden="true"
          id="iconSidenav"
        ></i>
        <a
          className="navbar-brand m-0"
          rel="noopener noreferrer"
          href="javascript:;"
          onClick={() => {
            navigate('/dashboard');
          }}
        >
          <img
            src="/assets/img/logo-ct-dark.png"
            width={26}
            height={26}
            className="navbar-brand-img h-100"
            alt="main_logo"
          />
          <span className="ms-1 font-weight-bold">Creative Tim</span>
        </a>
      </div>
      <hr className="horizontal dark mt-0" />
      {/* No "collapse" class: Bootstrap 5 hides .collapse:not(.show) and breaks the menu in SPAs. */}
      <div className="navbar-collapse w-auto h-auto" id="sidenav-collapse-main">
        <ul className="navbar-nav">
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#dashboardsExamples"
              className="nav-link active"
              aria-controls="dashboardsExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-shop text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Dashboards</span>
            </a>
            {/* <div className="collapse  show " id="dashboardsExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> L </span>
                    <span className="sidenav-normal"> Landing </span>
                  </a>
                </li>
                <li className="nav-item active">
                  <NavLink className="nav-link active" to="/dashboard">
                    <span className="sidenav-mini-icon"> D </span>
                    <span className="sidenav-normal"> Default </span>
                  </NavLink>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> A </span>
                    <span className="sidenav-normal"> Automotive </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal"> Smart Home </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> C </span>
                    <span className="sidenav-normal"> CRM </span>
                  </a>
                </li>
              </ul>
            </div> */}
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/categories">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-collection text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Categories</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/products">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-box-2 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Products</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/barcode-print">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="fas fa-barcode text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Barcode print</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/attributes">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-tag text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Attributes</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/logs">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-single-copy-04 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Logs</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/users">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-single-02 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Users</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/warehouse">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-delivery-fast text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Warehouse</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/stock">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-archive-2 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Stock movements</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/branch">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-building text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Branch</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/accounts">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-circle-08 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Accounts</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/accounts/balance-sheet">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-chart-bar-32 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Balance sheet</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/accounts/income-statement">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-chart-pie-35 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Income statement</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/accounts/payments">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-wallet-43 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Payments</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/accounts/payment-receipts">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-paper-diploma text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Payment receipts</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/expenses">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-money-coins text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Expenses</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/orders">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-cart text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Orders</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/transactions">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-credit-card text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Transactions</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/ledger">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-collection text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">User ledgers</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/purchase-orders">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-box text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Purchase orders</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/pos">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="fas fa-cash-register text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">POS</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink className="nav-link" to="/api-workflow">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-send text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">API workflow</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
