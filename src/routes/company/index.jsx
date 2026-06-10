import CompanySettingsView from '../../components/company/CompanySettingsView.jsx';

const CompanyPage = () => {
  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-2">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="mb-4" style={{ maxWidth: '720px', margin: '0 auto' }}>
            <h4 className="mb-1">Company</h4>
            <p className="text-sm text-muted mb-0">
              Manage company profile and invoice printer options.
            </p>
          </div>
          <CompanySettingsView />
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;
