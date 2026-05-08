import moment from 'moment';

export default function LedgerUserProfileCard({ user, onAction }) {
  if (!user) return null;

  return (
    <div className="card border-0 shadow-sm mb-4 overflow-hidden">
      <div className="card-body p-4 bg-gradient-primary" style={{ background: 'linear-gradient(87deg, #5e72e4 0, #825ee4 100%)' }}>
        <div className="row align-items-center gy-3 text-white">
          <div className="col-lg-8 d-flex align-items-start gap-3">
            <div
              className="avatar avatar-xxl rounded-circle bg-white text-primary d-flex align-items-center justify-content-center shadow"
              style={{ width: '4.5rem', height: '4.5rem', fontSize: '1.35rem' }}
            >
              {user.fullName
                .split(' ')
                .map((s) => s[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h3 className="text-white mb-0 text-truncate">{user.fullName}</h3>
                <span className="badge bg-white text-primary text-xs">{user.role}</span>
              </div>
              <p className="text-sm text-white mb-2 opacity-9">
                <i className="ni ni-mobile-button me-1" />
                {user.phone || '—'} · <i className="ni ni-email-83 ms-1 me-1" />
                {user.email || '—'}
              </p>
              <p className="text-sm mb-0 opacity-8">
                <i className="ni ni-pin-3 me-1" />
                {user.address || '—'}
              </p>
              <div className="d-flex flex-wrap gap-3 mt-3 text-xs opacity-9">
                <span>
                  <strong>Account:</strong> {user.accountStatus || '—'}
                </span>
                <span>
                  <strong>Created:</strong>{' '}
                  {user.createdAt ? moment(user.createdAt).format('DD MMM YYYY') : '—'}
                </span>
                <span>
                  <strong>Last activity:</strong>{' '}
                  {user.lastActivityAt ? moment(user.lastActivityAt).format('DD MMM YYYY HH:mm') : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="d-flex flex-wrap justify-content-lg-end gap-2">
              <button type="button" className="btn btn-sm btn-white mb-0 text-primary" onClick={() => onAction('add')}>
                Add entry
              </button>
              <button type="button" className="btn btn-sm btn-outline-white mb-0" onClick={() => onAction('receive')}>
                Receive payment
              </button>
              <button type="button" className="btn btn-sm btn-outline-white mb-0" onClick={() => onAction('send')}>
                Send payment
              </button>
              <button type="button" className="btn btn-sm btn-outline-white mb-0" onClick={() => onAction('print')}>
                Print
              </button>
              <button type="button" className="btn btn-sm btn-outline-white mb-0" onClick={() => onAction('pdf')}>
                Export PDF
              </button>
              <button type="button" className="btn btn-sm btn-outline-white mb-0" onClick={() => onAction('share')}>
                Share ledger
              </button>
            </div>
            <div className="mt-3 text-end">
              <span
                className={`badge ${user.status === 'active' ? 'bg-success' : 'bg-secondary'} text-white`}
              >
                {user.status === 'active' ? 'Active account' : user.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
