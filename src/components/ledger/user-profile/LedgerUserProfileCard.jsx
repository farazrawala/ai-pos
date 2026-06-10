import moment from 'moment';
import { fmtMoney, balanceTextClass } from '../ledgerUtils.js';

export default function LedgerUserProfileCard({ user, viewMode, onViewModeChange }) {
  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="card shadow-sm ledger-profile-card overflow-hidden">
      <div className="ledger-profile-accent" aria-hidden />
      <div className="card-body p-4">
        <div className="row align-items-center gy-3">
          <div className="col-lg-7">
            <div className="d-flex align-items-start gap-3">
              <div className="ledger-profile-avatar avatar rounded-circle bg-gradient-primary text-white d-flex align-items-center justify-content-center">
                {initials}
              </div>
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <h4 className="mb-0 text-dark text-truncate">{user.fullName}</h4>
                  <span className="badge bg-light text-primary border text-xxs text-uppercase">
                    {user.role}
                  </span>
                  <span
                    className={`badge text-xxs ${
                      user.accountStatus === 'Active' || user.status === 'active'
                        ? 'bg-gradient-success'
                        : 'bg-gradient-secondary'
                    }`}
                  >
                    {user.accountStatus || user.status || '—'}
                  </span>
                </div>
                <p className="text-sm text-muted mb-2">
                  {user.phone || '—'}
                  <span className="mx-2 text-secondary">·</span>
                  {user.email || '—'}
                </p>
                {user.address ? (
                  <p className="text-sm text-muted mb-0">{user.address}</p>
                ) : null}
                <div className="d-flex flex-wrap gap-3 mt-3 text-xs text-muted">
                  <span>
                    <strong className="text-dark">Created:</strong>{' '}
                    {user.createdAt ? moment(user.createdAt).format('DD MMM YYYY') : '—'}
                  </span>
                  <span>
                    <strong className="text-dark">Last activity:</strong>{' '}
                    {user.lastActivityAt || user.lastTransactionAt
                      ? moment(user.lastActivityAt || user.lastTransactionAt).format('DD MMM YYYY HH:mm')
                      : '—'}
                  </span>
                  <span>
                    <strong className="text-dark">Current balance:</strong>{' '}
                    <span className={`font-weight-bold ${balanceTextClass(user.currentBalance)}`}>
                      {fmtMoney(user.currentBalance)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="ledger-profile-view-toggle text-lg-end">
              <h6 className="mb-1">Ledger view</h6>
              <p className="text-xs text-muted mb-2">
                Switch between table and classic T-account layout
              </p>
              <div
                className="btn-group btn-group-sm d-inline-flex"
                role="group"
                aria-label="Ledger view mode"
              >
                <button
                  type="button"
                  className={`btn mb-0 ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onViewModeChange?.('table')}
                >
                  Table view
                </button>
                <button
                  type="button"
                  className={`btn mb-0 ${viewMode === 'taccount' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onViewModeChange?.('taccount')}
                >
                  T-account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
