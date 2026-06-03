import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions.js';

/**
 * Redirect when the logged-in user lacks `view` permission for a module.
 * ADMIN role bypasses all checks.
 */
export function useRequireModuleAccess(module, redirectTo = '/dashboard') {
  const navigate = useNavigate();
  const { canView, isAdmin } = usePermissions(module);

  useEffect(() => {
    if (isAdmin) return;
    if (canView === false) navigate(redirectTo, { replace: true });
  }, [canView, isAdmin, navigate, redirectTo]);

  return { canView, isAdmin };
}
