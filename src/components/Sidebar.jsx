import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { FaXmark } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import SidebarNavIcon from './SidebarNavIcon.jsx';
import { DEBUG, APP_NAME } from '../config/env.js';
import { filterNavItems } from '../config/navItems.js';
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
import { useSidenav } from '../context/SidenavContext.jsx';

const Sidebar = () => {
  const dispatch = useDispatch();
  const { close: closeSidenav, mobileMenuOpen } = useSidenav();
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

  const visibleNavItems = useMemo(
    () =>
      filterNavItems({
        isAdmin,
        canView,
        routePermissionModule: ROUTE_PERMISSION_MODULE,
        debug: DEBUG,
      }),
    [canView, isAdmin]
  );

  const handleNavClick = () => {
    if (window.innerWidth < 1200) {
      closeSidenav();
    }
  };

  return (
    <>
      {mobileMenuOpen ? (
        <button
          type="button"
          className="sidenav-mobile-backdrop d-xl-none"
          aria-label="Close menu"
          onClick={closeSidenav}
        />
      ) : null}
      <aside
        className="sidenav bg-white navbar navbar-vertical navbar-expand-xs border-0 border-radius-xl my-3 fixed-start ms-4"
        id="sidenav-main"
      >
        <div className="sidenav-header">
          <button
            type="button"
            className="sidenav-close-btn btn btn-link text-secondary d-xl-none"
            aria-label="Close menu"
            onClick={closeSidenav}
          >
            <NavIcon icon={FaXmark} size={20} />
          </button>
          <NavLink
            className="navbar-brand m-0 sidebar-brand-with-menu"
            rel="noopener noreferrer"
            to="/"
          >
            <span className="sidebar-brand-mark">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  width={64}
                  height={64}
                  className="navbar-brand-img"
                  alt={`${brandLabel} logo`}
                  style={{ objectFit: 'contain' }}
                />
              ) : (
                <span
                  className="navbar-brand-img d-inline-flex align-items-center justify-content-center rounded bg-gradient-primary text-white fw-bold"
                  style={{ width: 64, height: 64, flexShrink: 0, fontSize: '1.25rem' }}
                  aria-hidden
                >
                  {brandLabel.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="sidebar-brand-name font-weight-bold">{brandLabel}</span>
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
                  onClick={handleNavClick}
                >
                  <SidebarNavIcon icon={icon} />
                  <span className="nav-link-text ms-1">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
