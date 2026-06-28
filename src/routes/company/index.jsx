import CompanySettingsView from '../../components/company/CompanySettingsView.jsx';
import './company-settings.css';

const CompanyPage = () => {
  return (
    <div className="company-page">
      <div className="company-shell">
        <div className="company-page-header">
          <span className="company-page-eyebrow">
            <i className="fas fa-building" aria-hidden="true" />
            Settings
          </span>
          <h4 className="company-page-title">Company</h4>
          <p className="company-page-subtitle">
            Manage your company profile, invoice printer options, and POS product behavior.
          </p>
        </div>
        <CompanySettingsView />
      </div>
    </div>
  );
};

export default CompanyPage;
