const ACTIONS = [
  { key: 'view', letter: 'V' },
  { key: 'add', letter: 'A' },
  { key: 'edit', letter: 'E' },
  { key: 'delete', letter: 'D' },
];

/**
 * Compact permissions grid for the users list table.
 */
const UsersPermissionsCell = ({ permissions }) => {
  if (!permissions || typeof permissions !== 'object') {
    return <span className="text-muted text-sm">—</span>;
  }

  const modules = Object.entries(permissions);
  if (modules.length === 0) {
    return <span className="text-muted text-sm">—</span>;
  }

  return (
    <div className="users-permissions">
      {modules.map(([moduleName, actions]) => (
        <div key={moduleName} className="users-permissions-row">
          <span className="users-permissions-module" title={moduleName}>
            {moduleName}
          </span>
          <span className="users-permissions-actions">
            {ACTIONS.map(({ key, letter }) => {
              const on = Boolean(actions?.[key]);
              return (
                <span
                  key={key}
                  className={`users-permissions-pill ${on ? 'is-on' : 'is-off'}`}
                  title={`${key}: ${on ? 'allowed' : 'denied'}`}
                >
                  {letter}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
};

export default UsersPermissionsCell;
