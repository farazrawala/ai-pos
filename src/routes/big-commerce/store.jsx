import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
    <div className="container-fluid py-4">
      <div className="mb-3">
        <Link to="/big-commerce" className="btn btn-sm btn-outline-secondary mb-0">
          ← Back to company listing
        </Link>
      </div>
      <MarketplacePage companyId={companyId} />
    </div>
  );
}
