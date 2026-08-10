import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaArrowLeft, FaStore } from 'react-icons/fa6';
import MarketplacePage from '../../components/bigCommerce/MarketplacePage.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { selectBigCommerce } from '../../features/bigCommerce/bigCommerceSlice.js';
import { companyStorePath } from '../../features/bigCommerce/marketplaceUtils.js';
import './big-commerce.css';

/**
 * Single company storefront (Facebook-style marketplace).
 * Route key is `company_slug` (ObjectId still accepted, then rewritten).
 */
export default function BigCommerceStorePage() {
  useRequireModuleAccess('big-commerce');
  const navigate = useNavigate();
  const { companySlug: routeCompanySlug } = useParams();
  const sessionCompanyId = useSelector(selectCompanyId);
  const { company } = useSelector(selectBigCommerce);
  const companyId = String(routeCompanySlug || sessionCompanyId || '').trim();

  useEffect(() => {
    const routeKey = String(routeCompanySlug || '').trim();
    const slug = String(company?.slug || '').trim();
    const loadedId = String(company?.id || '').trim();
    if (!routeKey || !slug || routeKey === slug) return;
    if (routeKey !== loadedId) return;
    navigate(companyStorePath(company), { replace: true });
  }, [company, routeCompanySlug, navigate]);

  return (
    <div className="container-fluid py-4 bc-store-page">
      <div className="bc-store-navigation">
        <Link to="/big-commerce" className="bc-store-back">
          <FaArrowLeft aria-hidden="true" />
          <span>View stores</span>
        </Link>
        <div className="bc-store-context" aria-label="Current section">
          <FaStore aria-hidden="true" />
          <span>Marketplace storefront</span>
        </div>
      </div>
      <MarketplacePage companyId={companyId} />
    </div>
  );
}
