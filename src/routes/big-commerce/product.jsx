import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaArrowLeft, FaBoxOpen } from 'react-icons/fa6';
import MarketplacePage from '../../components/bigCommerce/MarketplacePage.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import { selectBigCommerce } from '../../features/bigCommerce/bigCommerceSlice.js';
import {
  companyProductPath,
  companyStorePath,
} from '../../features/bigCommerce/marketplaceUtils.js';
import './big-commerce.css';

/**
 * Full marketplace product details page for a store catalog item.
 */
export default function BigCommerceProductPage() {
  useRequireModuleAccess('big-commerce');
  const navigate = useNavigate();
  const { companySlug: routeCompanySlug, productId } = useParams();
  const sessionCompanyId = useSelector(selectCompanyId);
  const { company } = useSelector(selectBigCommerce);
  const companyId = String(routeCompanySlug || sessionCompanyId || '').trim();
  const storePath = companyStorePath(company?.slug || company?.id || companyId);

  useEffect(() => {
    const routeKey = String(routeCompanySlug || '').trim();
    const slug = String(company?.slug || '').trim();
    const loadedId = String(company?.id || '').trim();
    const id = String(productId || '').trim();
    if (!routeKey || !slug || !id || routeKey === slug) return;
    if (routeKey !== loadedId) return;
    navigate(companyProductPath(company, id), { replace: true });
  }, [company, routeCompanySlug, productId, navigate]);

  return (
    <div className="container-fluid py-4 px-3 bc-store-page" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="bc-store-navigation">
        <Link to={storePath} className="bc-store-back">
          <FaArrowLeft aria-hidden="true" />
          <span>Back to catalog</span>
        </Link>
        <div className="bc-store-context" aria-label="Current section">
          <FaBoxOpen aria-hidden="true" />
          <span>Product details</span>
        </div>
      </div>
      <MarketplacePage companyId={companyId} productId={String(productId || '').trim()} />
    </div>
  );
}
