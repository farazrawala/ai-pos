import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { withBase } from '../config/appBase.js';
import {
  FaBars,
  FaBell,
  FaBox,
  FaChevronDown,
  FaClock,
  FaGear,
  FaRightFromBracket,
  FaMagnifyingGlass,
  FaUser,
} from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import { clearUser, selectIsAuthenticated } from '../features/user/userSlice.js';

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { name, user } = useSelector((state) => state.user);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const pathSegment = location.pathname.split('/').filter(Boolean)[0] || '';
  const firstSegment = pathSegment
    ? pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1)
    : 'Dashboard';

  const handleSignOut = (e) => {
    e.preventDefault();
    dispatch(clearUser());
    navigate('/signin');
  };

  return (
    <nav
      className="navbar navbar-main navbar-expand-lg px-0 mx-4 shadow-none border-radius-xl z-index-sticky"
      id="navbarBlur"
      data-scroll="false"
    >
      <div className="container-fluid py-1 px-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb bg-transparent mb-0 pb-0 pt-1 px-0 me-sm-6 me-5">
            <li className="breadcrumb-item text-sm">
              <a className="text-white d-inline-flex align-items-center" href="javascript:;">
                <NavIcon icon={FaBox} className="text-white" size={14} />
              </a>
            </li>
            <li className="breadcrumb-item text-sm text-white active" aria-current="page">
              {firstSegment}
            </li>
          </ol>
        </nav>
        <div className="sidenav-toggler sidenav-toggler-inner d-xl-block d-none">
          <a href="javascript:;" className="nav-link p-0">
            <div className="sidenav-toggler-inner">
              <i className="sidenav-toggler-line bg-white" />
              <i className="sidenav-toggler-line bg-white" />
              <i className="sidenav-toggler-line bg-white" />
            </div>
          </a>
        </div>
        <button
          type="button"
          className="btn btn-link text-white p-1 ms-2 d-lg-none"
          data-bs-toggle="collapse"
          data-bs-target="#navbar"
          aria-controls="navbar"
          aria-expanded="false"
          aria-label="Open menu"
        >
          <NavIcon icon={FaBars} size={20} className="text-white" />
        </button>
        <div className="collapse navbar-collapse mt-sm-0 mt-2 me-md-0 me-sm-4" id="navbar">
          <ul className="ms-md-auto navbar-nav justify-content-end">
            {isAuthenticated ? (
              <li className="nav-item dropdown pe-2 d-flex align-items-center">
                <a
                  href="javascript:;"
                  className="nav-link text-white p-0"
                  id="userDropdownMenuButton"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <div className="d-flex align-items-center">
                    <NavIcon icon={FaUser} className="text-white me-sm-1" size={16} />
                    <span className="d-sm-inline d-none me-2">
                      {name || user?.name || user?.email || 'User'}
                    </span>
                    <NavIcon icon={FaChevronDown} className="text-white" size={12} />
                  </div>
                </a>
                <ul
                  className="dropdown-menu dropdown-menu-end px-2 py-3 me-sm-n4"
                  aria-labelledby="userDropdownMenuButton"
                >
                  <li className="mb-2">
                    <Link className="dropdown-item border-radius-md" to="/profile">
                      <div className="d-flex align-items-center">
                        <NavIcon icon={FaUser} className="me-2" size={16} />
                        <span>Profile</span>
                      </div>
                    </Link>
                  </li>
                  <li>
                    <a
                      className="dropdown-item border-radius-md text-danger"
                      href="javascript:;"
                      onClick={handleSignOut}
                    >
                      <div className="d-flex align-items-center">
                        <NavIcon icon={FaRightFromBracket} className="me-2" size={16} />
                        <span>Sign Out</span>
                      </div>
                    </a>
                  </li>
                </ul>
              </li>
            ) : (
              <li className="nav-item d-flex align-items-center">
                <Link to="/signin" className="nav-link text-white font-weight-bold px-0">
                  <NavIcon icon={FaUser} className="text-white me-sm-1" size={16} />
                  <span className="d-sm-inline d-none">Sign In</span>
                </Link>
              </li>
            )}
            <li className="nav-item d-xl-none ps-3 d-flex align-items-center">
              <a href="javascript:;" className="nav-link text-white p-0" id="iconNavbarSidenav">
                <div className="sidenav-toggler-inner">
                  <i className="sidenav-toggler-line bg-white" />
                  <i className="sidenav-toggler-line bg-white" />
                  <i className="sidenav-toggler-line bg-white" />
                </div>
              </a>
            </li>
            <li className="nav-item px-3 d-flex align-items-center">
              <a href="javascript:;" className="nav-link text-white p-0">
                <NavIcon
                  icon={FaGear}
                  className="fixed-plugin-button-nav cursor-pointer text-white"
                  size={18}
                />
              </a>
            </li>
            <li className="nav-item dropdown pe-2 d-flex align-items-center">
              <a
                href="javascript:;"
                className="nav-link text-white p-0"
                id="dropdownMenuButton"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <NavIcon icon={FaBell} className="cursor-pointer text-white" size={18} />
              </a>
              <ul
                className="dropdown-menu dropdown-menu-end px-2 py-3 me-sm-n4"
                aria-labelledby="dropdownMenuButton"
              >
                <li className="mb-2">
                  <a className="dropdown-item border-radius-md" href="javascript:;">
                    <div className="d-flex py-1">
                      <div className="my-auto">
                        <img
                          src={withBase('/assets/img/team-2.jpg')}
                          className="avatar avatar-sm me-3"
                          alt="user"
                        />
                      </div>
                      <div className="d-flex flex-column justify-content-center">
                        <h6 className="text-sm font-weight-normal mb-1">
                          <span className="font-weight-bold">New message</span> from Laur
                        </h6>
                        <p className="text-xs text-secondary mb-0 d-flex align-items-center">
                          <NavIcon icon={FaClock} className="me-1" size={12} />
                          13 minutes ago
                        </p>
                      </div>
                    </div>
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header;
