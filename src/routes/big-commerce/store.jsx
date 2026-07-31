import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaArrowLeft, FaStore } from 'react-icons/fa6';
import MarketplacePage from '../../components/bigCommerce/MarketplacePage.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { selectCompanyId } from '../../features/user/userSlice.js';
import './big-commerce.css';

/**
 * Single company storefront (Facebook-style marketplace).
 */
export default function BigCommerceStorePage() {
  useRequireModuleAccess('big-commerce');
  const { companyId: routeCompanyId } = useParams();
  const sessionCompanyId = useSelector(selectCompanyId);
  const companyId = String(routeCompanyId || sessionCompanyId || '').trim();

  return (
    <div className="container-fluid py-4 bc-store-page">
      <div className="bc-store-navigation">
        <Link to="/big-commerce" className="bc-store-back">
          <FaArrowLeft aria-hidden="true" />
          <span>Company directory</span>
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
