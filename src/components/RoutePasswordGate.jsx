import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_PREFIX = 'posRouteUnlock:';

/**
 * Blocks a route until the user enters a static password.
 * Unlock is remembered for the browser tab via sessionStorage.
 *
 * @param {{
 *   password?: string;
 *   children: import('react').ReactNode;
 *   title?: string;
 *   storageKey?: string;
 * }} props
 */
export default function RoutePasswordGate({
  password,
  children,
  title = 'Enter password to continue',
  storageKey: storageKeyOverride,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = useMemo(() => {
    if (storageKeyOverride) return `${STORAGE_PREFIX}${storageKeyOverride}`;
    // Unlock covers the whole route family (e.g. /warehouse and /warehouse/edit/…).
    const base = `/${String(location.pathname || '')
      .split('/')
      .filter(Boolean)[0] || ''}`;
    return `${STORAGE_PREFIX}${base || 'root'}`;
  }, [location.pathname, storageKeyOverride]);

  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  if (!password) return children;
  if (unlocked) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (String(value) === String(password)) {
      try {
        window.sessionStorage.setItem(storageKey, '1');
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setError('');
      return;
    }
    setError('Incorrect password.');
  };

  return (
    <div className="container-fluid py-5">
      <div className="row justify-content-center">
        <div className="col-md-5 col-lg-4">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h5 className="mb-1">{title}</h5>
              <p className="text-sm text-muted mb-3">This section is password protected.</p>
              <form onSubmit={handleSubmit}>
                <label htmlFor="route-password-gate" className="form-label">
                  Password
                </label>
                <input
                  id="route-password-gate"
                  type="password"
                  className={`form-control ${error ? 'is-invalid' : ''}`}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  autoComplete="current-password"
                />
                {error ? <div className="invalid-feedback d-block">{error}</div> : null}
                <div className="d-flex gap-2 mt-3">
                  <button type="submit" className="btn btn-primary mb-0">
                    Unlock
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary mb-0"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
