/**
 * Permission Management Utilities
 * Provides smart permission checking functions and hooks
 */

/**
 * Check if user has ADMIN role
 * @param {Object} state - Redux state
 * @returns {boolean} - True if user has ADMIN role
 */
export const isAdmin = (state) => {
  const user = state?.user?.user;
  if (!user) return false;

  const roles = user.role || [];
  return Array.isArray(roles) && roles.includes('ADMIN');
};

/**
 * Get user permissions from Redux state
 * @param {Object} state - Redux state
 * @returns {Object|null} - Permissions object or null
 */
export const getPermissions = (state) => {
  return state?.user?.user?.permissions || null;
};

/**
 * Get permissions for a specific module
 * @param {Object} state - Redux state
 * @param {string} module - Module name (e.g., 'category', 'order', 'integration')
 * @returns {Object|null} - Module permissions or null
 */
export const getModulePermissions = (state, module) => {
  const permissions = getPermissions(state);
  return permissions?.[module] || null;
};

/**
 * Check if user has a specific permission
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @param {string} action - Action name ('view', 'edit', 'delete', 'create')
 * @returns {boolean} - True if user has permission
 */
export const hasPermission = (state, module, action) => {
  // Admin users have all permissions
  if (isAdmin(state)) return true;

  const modulePermissions = getModulePermissions(state, module);
  if (!modulePermissions) return false;

  // Check if action exists and is true
  return Boolean(modulePermissions[action]);
};

/**
 * Check if user can view a module
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @returns {boolean}
 */
export const canView = (state, module) => {
  // Admin users have all permissions
  if (isAdmin(state)) return true;
  return hasPermission(state, module, 'view');
};

/**
 * Check if user can create in a module
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @returns {boolean}
 */
export const canCreate = (state, module) => {
  // Admin users have all permissions
  if (isAdmin(state)) return true;
  return hasPermission(state, module, 'add');
};

/**
 * Check if user can edit a module
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @returns {boolean}
 */
export const canEdit = (state, module) => {
  // Admin users have all permissions
  if (isAdmin(state)) return true;
  return hasPermission(state, module, 'edit');
};

/**
 * Check if user can delete a module
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @returns {boolean}
 */
export const canDelete = (state, module) => {
  // Admin users have all permissions
  if (isAdmin(state)) return true;
  return hasPermission(state, module, 'delete');
};

/**
 * Check if user has any permission for a module
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @returns {boolean}
 */
export const hasAnyPermission = (state, module) => {
  // Admin users have all permissions
  if (isAdmin(state)) return true;

  const modulePermissions = getModulePermissions(state, module);
  if (!modulePermissions) return false;

  return Object.values(modulePermissions).some((value) => value === true);
};

/**
 * Get all permissions for a module as an object
 * @param {Object} state - Redux state
 * @param {string} module - Module name
 * @returns {Object} - Object with view, create, edit, delete boolean values
 */
export const getModulePermissionObject = (state, module) => {
  // Admin users have all permissions
  if (isAdmin(state)) {
    return {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  }

  const modulePermissions = getModulePermissions(state, module);
  return {
    view: Boolean(modulePermissions?.view),
    create: Boolean(modulePermissions?.add),
    edit: Boolean(modulePermissions?.edit),
    delete: Boolean(modulePermissions?.delete),
  };
};
