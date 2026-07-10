import { describe, it, expect } from 'vitest';
import { isAdmin, normalizeRoles, getUserRoleLabels } from './permissions.js';
import { filterNavItems, NAV_ITEMS } from '../config/navItems.js';
import { ROUTE_PERMISSION_MODULE } from '../constants/permissionModules.js';

describe('isAdmin', () => {
  it('detects ADMIN from user.role string', () => {
    expect(isAdmin({ user: { user: { role: 'ADMIN' }, roles: [] } })).toBe(true);
  });

  it('detects ADMIN case-insensitively', () => {
    expect(isAdmin({ user: { user: { role: 'admin' }, roles: [] } })).toBe(true);
  });

  it('detects ADMIN from role array', () => {
    expect(isAdmin({ user: { user: { role: ['USER', 'ADMIN'] }, roles: [] } })).toBe(true);
  });

  it('detects ADMIN from session roles when user.role is missing', () => {
    expect(isAdmin({ user: { user: {}, roles: ['ADMIN'] } })).toBe(true);
  });

  it('detects ADMIN from user.roles field', () => {
    expect(isAdmin({ user: { user: { roles: ['ADMIN'] }, roles: [] } })).toBe(true);
  });

  it('detects ADMIN from object-shaped role', () => {
    expect(isAdmin({ user: { user: { role: { name: 'ADMIN' } }, roles: [] } })).toBe(true);
  });

  it('returns false for non-admin users', () => {
    expect(isAdmin({ user: { user: { role: 'USER' }, roles: [] } })).toBe(false);
  });
});

describe('normalizeRoles / getUserRoleLabels', () => {
  it('normalizes mixed role shapes', () => {
    expect(normalizeRoles(['admin', { name: 'User' }])).toEqual(['ADMIN', 'USER']);
  });

  it('merges user and session roles', () => {
    const labels = getUserRoleLabels({
      user: { user: { role: 'USER' }, roles: ['ADMIN'] },
    });
    expect(labels).toContain('USER');
    expect(labels).toContain('ADMIN');
  });
});

describe('filterNavItems admin access', () => {
  it('returns every nav item for ADMIN regardless of permissions or debug', () => {
    const items = filterNavItems({
      isAdmin: true,
      canView: () => false,
      routePermissionModule: ROUTE_PERMISSION_MODULE,
      debug: false,
    });
    expect(items).toHaveLength(NAV_ITEMS.length);
    expect(items.some((i) => i.to === '/profit-report')).toBe(true);
  });

  it('hides permission-gated items for non-admin without view', () => {
    const items = filterNavItems({
      isAdmin: false,
      canView: () => false,
      routePermissionModule: ROUTE_PERMISSION_MODULE,
      debug: false,
    });
    expect(items.some((i) => i.to === '/profit-report')).toBe(false);
    expect(items.some((i) => i.to === '/')).toBe(true);
  });
});
