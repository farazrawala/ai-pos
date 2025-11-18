import { useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const name = useSelector((state) => state.user.name);

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
          href="https://demos.creative-tim.com/argon-dashboard-pro/pages/dashboards/default.html"
          target="_blank"
          rel="noopener noreferrer"
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
      <div className="collapse navbar-collapse  w-auto h-auto" id="sidenav-collapse-main">
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
            <div className="collapse  show " id="dashboardsExamples">
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
            </div>
          </li>
          <li className="nav-item mt-3">
            <h6 className="ps-4  ms-2 text-uppercase text-xs font-weight-bolder opacity-6">
              MANAGEMENT
            </h6>
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
            <NavLink className="nav-link" to="/attributes">
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-tag text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Attributes</span>
            </NavLink>
          </li>
          <li className="nav-item mt-3">
            <h6 className="ps-4  ms-2 text-uppercase text-xs font-weight-bolder opacity-6">
              PAGES
            </h6>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#pagesExamples"
              className="nav-link "
              aria-controls="pagesExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-ungroup text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Pages</span>
            </a>
            <div className="collapse " id="pagesExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#vrExamples"
                  >
                    <span className="sidenav-mini-icon"> V </span>
                    <span className="sidenav-normal">
                      {' '}
                      Virtual Reality <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="vrExamples">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> V </span>
                          <span className="sidenav-normal"> VR Default </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> V </span>
                          <span className="sidenav-normal"> VR Info </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> P </span>
                    <span className="sidenav-normal"> Pricing Page </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> R </span>
                    <span className="sidenav-normal"> RTL </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> W </span>
                    <span className="sidenav-normal"> Widgets </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> C </span>
                    <span className="sidenav-normal"> Charts </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal"> Sweet Alerts </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> N </span>
                    <span className="sidenav-normal"> Notifications </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#accountExamples"
              className="nav-link "
              aria-controls="accountExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-settings-gear-65 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Account</span>
            </a>
            <div className="collapse " id="accountExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal"> Settings </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> B </span>
                    <span className="sidenav-normal"> Billing </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> I </span>
                    <span className="sidenav-normal"> Invoice </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal"> Security </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#applicationsExamples"
              className="nav-link "
              aria-controls="applicationsExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-ui-04 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Applications</span>
            </a>
            <div className="collapse " id="applicationsExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> K </span>
                    <span className="sidenav-normal"> Kanban </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> W </span>
                    <span className="sidenav-normal"> Wizard </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> D </span>
                    <span className="sidenav-normal"> DataTables </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> C </span>
                    <span className="sidenav-normal"> Calendar </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> A </span>
                    <span className="sidenav-normal"> Analytics </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#ecommerceExamples"
              className="nav-link "
              aria-controls="ecommerceExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-archive-2 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Ecommerce</span>
            </a>
            <div className="collapse " id="ecommerceExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> O </span>
                    <span className="sidenav-normal"> Overview </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#productsExample"
                  >
                    <span className="sidenav-mini-icon"> P </span>
                    <span className="sidenav-normal">
                      {' '}
                      Products <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="productsExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> N </span>
                          <span className="sidenav-normal"> New Product </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> E </span>
                          <span className="sidenav-normal"> Edit Product </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> P </span>
                          <span className="sidenav-normal"> Product Page </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> P </span>
                          <span className="sidenav-normal"> Products List </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#ordersExample"
                  >
                    <span className="sidenav-mini-icon"> O </span>
                    <span className="sidenav-normal">
                      {' '}
                      Orders <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="ordersExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> O </span>
                          <span className="sidenav-normal"> Order List </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> O </span>
                          <span className="sidenav-normal"> Order Details </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> R </span>
                    <span className="sidenav-normal"> Referral </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#teamExamples"
              className="nav-link "
              aria-controls="teamExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-world-2 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Team</span>
            </a>
            <div className="collapse " id="teamExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> A </span>
                    <span className="sidenav-normal"> All Projects </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> T </span>
                    <span className="sidenav-normal"> Teams </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> N </span>
                    <span className="sidenav-normal"> New User </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> P </span>
                    <span className="sidenav-normal"> Profile Overview </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> R </span>
                    <span className="sidenav-normal"> Reports </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#projectsExamples"
              className="nav-link "
              aria-controls="projectsExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-building text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Projects</span>
            </a>
            <div className="collapse " id="projectsExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> G </span>
                    <span className="sidenav-normal"> General </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> T </span>
                    <span className="sidenav-normal"> Timeline </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a className="nav-link " href="#">
                    <span className="sidenav-mini-icon"> N </span>
                    <span className="sidenav-normal"> New Project </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#authExamples"
              className="nav-link "
              aria-controls="authExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-single-copy-04 text-dark text-sm opacity-10"></i>
              </div>
              <span className="nav-link-text ms-1">Authentication</span>
            </a>
            <div className="collapse " id="authExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#signinExample"
                  >
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal">
                      {' '}
                      Sign In <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="signinExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> B </span>
                          <span className="sidenav-normal"> Basic </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Cover </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> I </span>
                          <span className="sidenav-normal"> Illustration </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#signupExample"
                  >
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal">
                      {' '}
                      Sign Up <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="signupExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> B </span>
                          <span className="sidenav-normal"> Basic </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Cover </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> I </span>
                          <span className="sidenav-normal"> Illustration </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#resetExample"
                  >
                    <span className="sidenav-mini-icon"> R </span>
                    <span className="sidenav-normal">
                      {' '}
                      Reset Password <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="resetExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> B </span>
                          <span className="sidenav-normal"> Basic </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Cover </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> I </span>
                          <span className="sidenav-normal"> Illustration </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#lockExample"
                  >
                    <span className="sidenav-mini-icon"> L </span>
                    <span className="sidenav-normal">
                      {' '}
                      Lock <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="lockExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> B </span>
                          <span className="sidenav-normal"> Basic </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Cover </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> I </span>
                          <span className="sidenav-normal"> Illustration </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#StepExample"
                  >
                    <span className="sidenav-mini-icon"> 2 </span>
                    <span className="sidenav-normal">
                      {' '}
                      2-Step Verification <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="StepExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> B </span>
                          <span className="sidenav-normal"> Basic </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Cover </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> I </span>
                          <span className="sidenav-normal"> Illustration </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#errorExample"
                  >
                    <span className="sidenav-mini-icon"> E </span>
                    <span className="sidenav-normal">
                      {' '}
                      Error <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="errorExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> E </span>
                          <span className="sidenav-normal"> Error 404 </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a className="nav-link " href="#">
                          <span className="sidenav-mini-icon text-xs"> E </span>
                          <span className="sidenav-normal"> Error 500 </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <hr className="horizontal dark" />
            <h6 className="ps-4  ms-2 text-uppercase text-xs font-weight-bolder opacity-6">DOCS</h6>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#basicExamples"
              className="nav-link "
              aria-controls="basicExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-spaceship text-dark text-sm"></i>
              </div>
              <span className="nav-link-text ms-1">Basic</span>
            </a>
            <div className="collapse " id="basicExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#gettingStartedExample"
                  >
                    <span className="sidenav-mini-icon"> G </span>
                    <span className="sidenav-normal">
                      {' '}
                      Getting Started <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="gettingStartedExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/quick-start/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> Q </span>
                          <span className="sidenav-normal"> Quick Start </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/license/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> L </span>
                          <span className="sidenav-normal"> License </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/overview/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Contents </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/build-tools/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> B </span>
                          <span className="sidenav-normal"> Build Tools </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    data-bs-toggle="collapse"
                    aria-expanded="false"
                    href="#foundationExample"
                  >
                    <span className="sidenav-mini-icon"> F </span>
                    <span className="sidenav-normal">
                      {' '}
                      Foundation <b className="caret"></b>
                    </span>
                  </a>
                  <div className="collapse " id="foundationExample">
                    <ul className="nav nav-sm flex-column">
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/colors/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> C </span>
                          <span className="sidenav-normal"> Colors </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/grid/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> G </span>
                          <span className="sidenav-normal"> Grid </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/typography/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> T </span>
                          <span className="sidenav-normal"> Typography </span>
                        </a>
                      </li>
                      <li className="nav-item">
                        <a
                          className="nav-link "
                          href="https://www.creative-tim.com/learning-lab/bootstrap/icons/argon-dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="sidenav-mini-icon text-xs"> I </span>
                          <span className="sidenav-normal"> Icons </span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              data-bs-toggle="collapse"
              href="#componentsExamples"
              className="nav-link "
              aria-controls="componentsExamples"
              role="button"
              aria-expanded="false"
            >
              <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
                <i className="ni ni-app text-dark text-sm"></i>
              </div>
              <span className="nav-link-text ms-1">Components</span>
            </a>
            <div className="collapse " id="componentsExamples">
              <ul className="nav ms-4">
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/alerts/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> A </span>
                    <span className="sidenav-normal"> Alerts </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/badge/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> B </span>
                    <span className="sidenav-normal"> Badge </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/buttons/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> B </span>
                    <span className="sidenav-normal"> Buttons </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/cards/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> C </span>
                    <span className="sidenav-normal"> Card </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/carousel/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> C </span>
                    <span className="sidenav-normal"> Carousel </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/collapse/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> C </span>
                    <span className="sidenav-normal"> Collapse </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/dropdowns/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> D </span>
                    <span className="sidenav-normal"> Dropdowns </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/forms/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> F </span>
                    <span className="sidenav-normal"> Forms </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/modal/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> M </span>
                    <span className="sidenav-normal"> Modal </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/navs/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> N </span>
                    <span className="sidenav-normal"> Navs </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/navbar/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> N </span>
                    <span className="sidenav-normal"> Navbar </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/pagination/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> P </span>
                    <span className="sidenav-normal"> Pagination </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/popovers/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> P </span>
                    <span className="sidenav-normal"> Popovers </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/progress/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> P </span>
                    <span className="sidenav-normal"> Progress </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/spinners/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> S </span>
                    <span className="sidenav-normal"> Spinners </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/tables/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> T </span>
                    <span className="sidenav-normal"> Tables </span>
                  </a>
                </li>
                <li className="nav-item ">
                  <a
                    className="nav-link "
                    href="https://www.creative-tim.com/learning-lab/bootstrap/tooltips/argon-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sidenav-mini-icon"> T </span>
                    <span className="sidenav-normal"> Tooltips </span>
                  </a>
                </li>
              </ul>
            </div>
          </li>
          <li className="nav-item">
            <a
              className="nav-link"
              href="https://github.com/creativetimofficial/ct-argon-dashboard-pro/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="icon icon-shape icon-sm text-center  me-2 d-flex align-items-center justify-content-center">
                <i className="ni ni-align-left-2 text-dark text-sm"></i>
              </div>
              <span className="nav-link-text ms-1">Changelog</span>
            </a>
          </li>
        </ul>
      </div>
      <div className="sidenav-footer mx-3 my-3">
        <div className="card card-plain shadow-none" id="sidenavCard">
          <img
            className="w-60 mx-auto"
            src="/assets/img/illustrations/icon-documentation.svg"
            alt="sidebar_illustration"
          />
          <div className="card-body text-center p-3 w-100 pt-0">
            <div className="docs-info">
              <h6 className="mb-0">Need help?</h6>
              <p className="text-xs font-weight-bold mb-0">Please check our docs</p>
            </div>
          </div>
        </div>
        <a
          href="https://www.creative-tim.com/learning-lab/bootstrap/overview/argon-dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-dark btn-sm w-100 mb-3"
        >
          Documentation
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
