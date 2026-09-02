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
    expect(items.find((i) => i.id === 'pl-accounts')?.children?.some((c) => c.to === '/product-pulse')).toBe(
      true
    );
  });

  it('hides permission-gated items for non-admin without view', () => {
    const items = filterNavItems({
      isAdmin: false,
      canView: () => false,
      routePermissionModule: ROUTE_PERMISSION_MODULE,
      debug: false,
    });
    expect(items.some((i) => i.id === 'accounts')).toBe(false);
    expect(items.some((i) => i.to === '/')).toBe(true);
    expect(items.some((i) => i.id === 'pos-products')).toBe(false);
  });

  it('keeps only permitted children inside a nav group', () => {
    const items = filterNavItems({
      isAdmin: false,
      canView: (moduleKey) => moduleKey === 'orders',
      routePermissionModule: ROUTE_PERMISSION_MODULE,
      debug: false,
    });
    const group = items.find((i) => i.id === 'pos-products');
    expect(group).toBeTruthy();
    expect(group.children).toHaveLength(1);
    expect(group.children[0].to).toBe('/orders');
  });
});
