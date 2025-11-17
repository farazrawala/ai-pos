import { useSelector } from 'react-redux';
import {
  getPermissions,
  getModulePermissions,
  hasPermission,
  canView,
  canCreate,
  canEdit,
  canDelete,
  hasAnyPermission,
  getModulePermissionObject,
} from '../utils/permissions.js';

/**
 * Custom hook to access user permissions
 * @param {string} module - Optional module name to get specific module permissions
 * @returns {Object} - Permission utilities and data
 */
export const usePermissions = (module = null) => {
  const state = useSelector((state) => state);

  // Get all permissions
  const permissions = getPermissions(state);

  // If module is specified, get module-specific permissions
  if (module) {
    const modulePermissions = getModulePermissions(state, module);
    return {
      // All permissions
      all: permissions,
      // Module-specific permissions
      module: modulePermissions,
      // Module permission object with view/create/edit/delete
      modulePermissions: getModulePermissionObject(state, module),
      // Quick checks for this module
      canView: canView(state, module),
      canCreate: canCreate(state, module),
      canEdit: canEdit(state, module),
      canDelete: canDelete(state, module),
      hasAny: hasAnyPermission(state, module),
      // Helper functions
      hasPermission: (action) => hasPermission(state, module, action),
    };
  }

  // Return general permission utilities
  return {
    // All permissions
    all: permissions,
    // Helper functions
    getModulePermissions: (moduleName) => getModulePermissions(state, moduleName),
    hasPermission: (moduleName, action) => hasPermission(state, moduleName, action),
    canView: (moduleName) => canView(state, moduleName),
    canCreate: (moduleName) => canCreate(state, moduleName),
    canEdit: (moduleName) => canEdit(state, moduleName),
    canDelete: (moduleName) => canDelete(state, moduleName),
    hasAnyPermission: (moduleName) => hasAnyPermission(state, moduleName),
    getModulePermissionObject: (moduleName) => getModulePermissionObject(state, moduleName),
  };
};

/**
 * Custom hook for a specific module's permissions
 * @param {string} module - Module name
 * @returns {Object} - Module permissions and helper functions
 */
export const useModulePermissions = (module) => {
  return usePermissions(module);
};
