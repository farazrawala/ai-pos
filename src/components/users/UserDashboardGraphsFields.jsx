import UserPermCheckbox from './UserPermCheckbox.jsx';
import {
  DASHBOARD_GRAPH_KEYS,
  DASHBOARD_GRAPH_OPTIONS,
} from '../../constants/dashboardGraphs.js';

export default function UserDashboardGraphsFields({
  selected = [],
  onToggle,
  onSetAll,
  disabled = false,
  adminSeesAll = false,
  idPrefix = 'user-graph',
}) {
  const grantedCount = selected.length;
  const allGranted = grantedCount === DASHBOARD_GRAPH_KEYS.length;
  const noneGranted = grantedCount === 0;
  const chipsDisabled = disabled || adminSeesAll;

  return (
    <div className="user-form-section">
      <div className="user-form-section-title">
        <i className="fas fa-chart-line text-primary" aria-hidden="true" />
        Dashboard graphs
      </div>
      <p className="user-form-section-hint">
        Choose which charts this user can see on the dashboard.
        {adminSeesAll ? ' Admin users always see every graph.' : ''}
      </p>

      {adminSeesAll ? (
        <div className="alert alert-info py-2 px-3 mb-3" role="status">
          This user has the ADMIN role, so every dashboard graph is shown.
        </div>
      ) : null}

      <div className="user-perm-toolbar">
        <UserPermCheckbox
          id={`${idPrefix}-grant-all`}
          label="Grant all graphs"
          checked={allGranted || adminSeesAll}
          onChange={(e) => onSetAll(e.target.checked)}
          disabled={chipsDisabled}
        />
        <UserPermCheckbox
          id={`${idPrefix}-remove-all`}
          label="Remove all graphs"
          checked={noneGranted && !adminSeesAll}
          onChange={(e) => {
            if (e.target.checked) onSetAll(false);
          }}
          disabled={chipsDisabled}
        />
      </div>

      <div className="user-role-chips">
        {DASHBOARD_GRAPH_OPTIONS.map((option) => {
          const active = adminSeesAll || selected.includes(option.key);
          return (
            <label
              key={option.key}
              className={`user-role-chip ${active ? 'is-active' : ''} ${chipsDisabled ? 'is-disabled' : ''}`}
              htmlFor={`${idPrefix}-${option.key}`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(option.key)}
                id={`${idPrefix}-${option.key}`}
                disabled={chipsDisabled}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
