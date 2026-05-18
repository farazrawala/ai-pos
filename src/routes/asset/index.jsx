import { useNavigate } from 'react-router-dom';

const AssetIndex = () => {
  const navigate = useNavigate();

  return (
    <div className="container-fluid py-4 px-0" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card">
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h5 className="mb-0">Assets</h5>
                  <p className="text-sm mb-0 text-muted">Record fixed assets and purchases</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/assets/add')}
                >
                  <i className="fas fa-plus me-1"></i>
                  Add asset
                </button>
              </div>
            </div>
            <div className="card-body pt-3">
              <p className="text-sm text-muted mb-0">
                Use <strong>Add asset</strong> to register a new asset via{' '}
                <code className="text-xs">POST /assets/create</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetIndex;
