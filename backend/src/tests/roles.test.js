import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '#db/knex.js';
import modules from '#modules/index.js';
import { resetDatabase } from './testDb.js';

// Base RBAC permissions/grants defined directly in the seed (not tied to a
// feature module) plus every module's registered permissions and its own
// rolePermissions map — this is what 00_roles_permissions.js is expected
// to seed in total. See src/db/seeds/00_roles_permissions.js.
const basePermissionKeys = [
  'audit:read',
  'roles:manage',
  'roles:read',
  'settings:manage',
  'settings:read',
  'users:delete',
  'users:read',
  'users:write',
];
const baseRolePermissions = {
  admin: [
    'users:read',
    'users:write',
    'users:delete',
    'roles:read',
    'roles:manage',
    'settings:read',
    'settings:manage',
    'audit:read',
  ],
  manager: ['users:read', 'users:write'],
  member: [],
};
const modulePermissionKeys = modules.flatMap((mod) => mod.permissions.map((p) => p.key));
const allPermissionKeys = [...basePermissionKeys, ...modulePermissionKeys].sort();

const adminPermissionKeys = [
  ...baseRolePermissions.admin,
  ...modules.flatMap((mod) => mod.rolePermissions.admin),
].sort();
const managerPermissionKeys = [
  ...baseRolePermissions.manager,
  ...modules.flatMap((mod) => mod.rolePermissions.manager),
].sort();
const memberPermissionKeys = [
  ...baseRolePermissions.member,
  ...modules.flatMap((mod) => mod.rolePermissions.member),
].sort();
// The demo role's grants aren't derived from baseRolePermissions/modules
// (see the comment in db/seeds/00_roles_permissions.js) — mirror that
// curated list here so this test stays in sync with the seed.
const demoPermissionKeys = [
  'users:read',
  'roles:read',
  'settings:read',
  'audit:read',
  'example-products:read',
  'example-sales:read',
].sort();
const totalMappingCount =
  adminPermissionKeys.length +
  managerPermissionKeys.length +
  memberPermissionKeys.length +
  demoPermissionKeys.length;

describe('Roles & permissions schema/seed data', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates the four starter roles', async () => {
    const roles = await db('roles').select('key').orderBy('key');
    expect(roles.map((r) => r.key)).toEqual(['admin', 'demo', 'manager', 'member']);
  });

  it('creates the starter permission set, including every module\'s permissions', async () => {
    const permissions = await db('permissions').select('key').orderBy('key');
    expect(permissions.map((p) => p.key)).toEqual(allPermissionKeys);
  });

  it('maps admin to every permission, manager to a subset, and member to none', async () => {
    const permissionsFor = async (roleKey) =>
      db('role_permissions')
        .join('permissions', 'permissions.id', 'role_permissions.permission_id')
        .join('roles', 'roles.id', 'role_permissions.role_id')
        .where('roles.key', roleKey)
        .pluck('permissions.key');

    expect((await permissionsFor('admin')).sort()).toEqual(adminPermissionKeys);
    expect((await permissionsFor('manager')).sort()).toEqual(managerPermissionKeys);
    expect((await permissionsFor('member')).sort()).toEqual(memberPermissionKeys);
  });

  it('users table has role_id (FK) instead of the old role string column', async () => {
    const columns = await db('users').columnInfo();
    expect(columns).toHaveProperty('role_id');
    expect(columns).not.toHaveProperty('role');
  });

  it('backfills the seeded admin user onto the admin role', async () => {
    const admin = await db('users')
      .join('roles', 'roles.id', 'users.role_id')
      .where('users.email', process.env.SEED_ADMIN_EMAIL || 'admin@example.com')
      .first('roles.key as role');
    expect(admin.role).toBe('admin');
  });

  it('re-running the seed is idempotent (no duplicate rows)', async () => {
    await db.seed.run();
    const roleCount = await db('roles').count({ count: '*' }).first();
    const permissionCount = await db('permissions').count({ count: '*' }).first();
    const mappingCount = await db('role_permissions').count({ count: '*' }).first();

    expect(Number(roleCount.count)).toBe(4);
    expect(Number(permissionCount.count)).toBe(allPermissionKeys.length);
    expect(Number(mappingCount.count)).toBe(totalMappingCount);
  });
});
