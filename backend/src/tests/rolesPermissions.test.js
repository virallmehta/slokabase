import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

process.env.AUTH_RATE_LIMIT_MAX = '50';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');

function csrfFrom(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Roles & Permissions module — /api/v1/admin/roles', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;
  let managerAgent;
  let managerCsrf;
  let memberAgent;
  let memberCsrf;
  let memberRoleId;
  let managerRoleId;
  let adminRoleId;

  beforeAll(async () => {
    await resetDatabase();

    adminAgent = request.agent(app);
    const adminLogin = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = csrfFrom(adminLogin);

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Plain Manager', email: 'roles-manager@example.com', password: 'password123' })
      .expect(201);
    const managerReg = await db('users').where({ email: 'roles-manager@example.com' }).first();
    await adminAgent
      .patch(`/api/v1/users/${managerReg.id}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ roleKey: 'manager' })
      .expect(200);

    managerAgent = request.agent(app);
    const managerLogin = await managerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'roles-manager@example.com', password: 'password123' })
      .expect(200);
    managerCsrf = csrfFrom(managerLogin);

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Plain Member', email: 'roles-member@example.com', password: 'password123' })
      .expect(201);

    memberAgent = request.agent(app);
    const memberLogin = await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: 'roles-member@example.com', password: 'password123' })
      .expect(200);
    memberCsrf = csrfFrom(memberLogin);

    const roles = await db('roles').select('id', 'key');
    adminRoleId = roles.find((r) => r.key === 'admin').id;
    managerRoleId = roles.find((r) => r.key === 'manager').id;
    memberRoleId = roles.find((r) => r.key === 'member').id;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/admin/roles').expect(401);
  });

  it('denies a manager (lacks roles:read) from listing roles', async () => {
    await managerAgent.get('/api/v1/admin/roles').expect(403);
  });

  it('denies a member (lacks roles:manage) from listing roles', async () => {
    await memberAgent.get('/api/v1/admin/roles').expect(403);
  });

  it('lets admin list roles with a permission count', async () => {
    const res = await adminAgent.get('/api/v1/admin/roles').expect(200);
    const manager = res.body.roles.find((r) => r.key === 'manager');
    expect(manager).toBeTruthy();
    expect(Number(manager.permissionCount)).toBeGreaterThan(0);
  });

  it('404s for a non-existent role', async () => {
    await adminAgent.get('/api/v1/admin/roles/999999/permissions').expect(404);
  });

  it("gets a role's permissions grouped by module, with granted flags set", async () => {
    const res = await adminAgent.get(`/api/v1/admin/roles/${memberRoleId}/permissions`).expect(200);

    const moduleNames = res.body.groups.map((g) => g.module).sort();
    expect(moduleNames).toEqual(['Audit', 'Example Products', 'Example Sales', 'Roles', 'Settings', 'Users']);

    // member starts with no permissions granted at all
    const allPermissions = res.body.groups.flatMap((g) => g.permissions);
    expect(allPermissions.every((p) => p.granted === false)).toBe(true);
  });

  it('gets the permission catalog with everything unchecked, for the New role form', async () => {
    const res = await adminAgent.get('/api/v1/admin/roles/permissions/catalog').expect(200);

    const moduleNames = res.body.groups.map((g) => g.module).sort();
    expect(moduleNames).toEqual(['Audit', 'Example Products', 'Example Sales', 'Roles', 'Settings', 'Users']);

    const allPermissions = res.body.groups.flatMap((g) => g.permissions);
    expect(allPermissions.every((p) => p.granted === false)).toBe(true);
    expect(allPermissions.some((p) => p.key === 'roles:manage')).toBe(true);
  });

  it('denies a manager from updating a role\'s permissions', async () => {
    await managerAgent
      .put(`/api/v1/admin/roles/${memberRoleId}/permissions`)
      .set('X-CSRF-Token', managerCsrf)
      .send({ permissionKeys: ['users:read'] })
      .expect(403);
  });

  it('rejects a mutating request without a matching CSRF header', async () => {
    await adminAgent
      .put(`/api/v1/admin/roles/${memberRoleId}/permissions`)
      .send({ permissionKeys: ['users:read'] })
      .expect(403);
  });

  it('rejects an unknown permission key', async () => {
    const res = await adminAgent
      .put(`/api/v1/admin/roles/${memberRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['not-a-real-permission'] })
      .expect(400);
    expect(res.body.message).toBe('Unknown permission key(s)');
  });

  it('grants permissions to a role (toggling on)', async () => {
    const res = await adminAgent
      .put(`/api/v1/admin/roles/${memberRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['users:read', 'example-products:read'] })
      .expect(200);

    const granted = res.body.groups
      .flatMap((g) => g.permissions)
      .filter((p) => p.granted)
      .map((p) => p.key)
      .sort();
    expect(granted).toEqual(['example-products:read', 'users:read']);
  });

  it('revokes a previously granted permission (toggling off) while keeping the other', async () => {
    const res = await adminAgent
      .put(`/api/v1/admin/roles/${memberRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['example-products:read'] })
      .expect(200);

    const granted = res.body.groups
      .flatMap((g) => g.permissions)
      .filter((p) => p.granted)
      .map((p) => p.key);
    expect(granted).toEqual(['example-products:read']);

    const dbKeys = await db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .where('role_permissions.role_id', memberRoleId)
      .pluck('permissions.key');
    expect(dbKeys).toEqual(['example-products:read']);
  });

  it('a manager promoted with a new permission gains access on their very next request', async () => {
    // managerRoleId currently has no example-products:write — grant it, then confirm
    // the already-logged-in manager agent (whose JWT has no permissions
    // baked in) can use it immediately, with no re-login required.
    await adminAgent
      .put(`/api/v1/admin/roles/${managerRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['users:read', 'users:write', 'example-products:read', 'example-products:write'] })
      .expect(200);

    await managerAgent
      .post('/api/v1/example-products')
      .set('X-CSRF-Token', managerCsrf)
      .send({ name: 'Manager Widget', sku: 'MGR-1', price: 1 })
      .expect(201);
  });

  it('refuses to remove roles:manage from the admin role (self-lockout guard)', async () => {
    const res = await adminAgent
      .put(`/api/v1/admin/roles/${adminRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['users:read'] })
      .expect(400);
    expect(res.body.message).toBe('The admin role must always retain roles:manage');
  });

  it('refuses to remove roles:read from the admin role while keeping roles:manage (self-lockout guard)', async () => {
    const res = await adminAgent
      .put(`/api/v1/admin/roles/${adminRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['users:read', 'roles:manage'] })
      .expect(400);
    expect(res.body.message).toBe('The admin role must always retain roles:read');
  });

  it('flags admin/manager/member as system roles, and every seeded permission a module hardcodes as system permissions', async () => {
    const res = await adminAgent.get('/api/v1/admin/roles').expect(200);
    for (const key of ['admin', 'manager', 'member']) {
      expect(res.body.roles.find((r) => r.key === key).is_system).toBeTruthy();
    }

    const permsRes = await adminAgent.get(`/api/v1/admin/roles/${memberRoleId}/permissions`).expect(200);
    const allPermissions = permsRes.body.groups.flatMap((g) => g.permissions);
    const systemKeys = allPermissions.filter((p) => p.isSystem).map((p) => p.key).sort();
    expect(systemKeys).toEqual([
      'audit:read',
      'roles:manage',
      'roles:read',
      'settings:manage',
      'settings:read',
      'users:delete',
      'users:read',
      'users:write',
    ]);
  });

  describe('custom roles: create, rename, delete', () => {
    let customRoleId;

    it('rejects creating a role without a name', async () => {
      const res = await adminAgent
        .post('/api/v1/admin/roles')
        .set('X-CSRF-Token', adminCsrf)
        .send({ description: 'Missing a name' })
        .expect(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('denies a manager (lacks roles:manage) from creating a role', async () => {
      await managerAgent
        .post('/api/v1/admin/roles')
        .set('X-CSRF-Token', managerCsrf)
        .send({ name: 'Should Not Exist' })
        .expect(403);
    });

    it('creates a custom role with an initial permission set', async () => {
      const res = await adminAgent
        .post('/api/v1/admin/roles')
        .set('X-CSRF-Token', adminCsrf)
        .send({
          name: 'Support Agent',
          description: 'Read-only support access',
          permissionKeys: ['users:read', 'example-products:read'],
        })
        .expect(201);

      expect(res.body.role).toMatchObject({
        key: 'support-agent',
        name: 'Support Agent',
        description: 'Read-only support access',
        is_system: false,
      });
      const granted = res.body.groups
        .flatMap((g) => g.permissions)
        .filter((p) => p.granted)
        .map((p) => p.key)
        .sort();
      expect(granted).toEqual(['example-products:read', 'users:read']);
      customRoleId = res.body.role.id;
    });

    it('rejects a duplicate role name', async () => {
      const res = await adminAgent
        .post('/api/v1/admin/roles')
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Support Agent' })
        .expect(409);
      expect(res.body.message).toBe('A role with this name already exists');
    });

    it('renames a custom role and updates its description', async () => {
      const res = await adminAgent
        .patch(`/api/v1/admin/roles/${customRoleId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Support Lead', description: 'Support access, promoted' })
        .expect(200);
      expect(res.body.role).toMatchObject({
        key: 'support-lead',
        name: 'Support Lead',
        description: 'Support access, promoted',
      });
    });

    it('rejects renaming/editing a system role, even with valid admin credentials', async () => {
      const res = await adminAgent
        .patch(`/api/v1/admin/roles/${memberRoleId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Not Allowed' })
        .expect(400);
      expect(res.body.message).toBe(
        'System roles cannot be renamed or have their description changed'
      );

      const stillMember = await db('roles').where({ id: memberRoleId }).first();
      expect(stillMember.key).toBe('member');
    });

    it('rejects deleting a system role, even with valid admin credentials', async () => {
      for (const roleId of [adminRoleId, managerRoleId, memberRoleId]) {
        const res = await adminAgent
          .delete(`/api/v1/admin/roles/${roleId}`)
          .set('X-CSRF-Token', adminCsrf)
          .expect(400);
        expect(res.body.message).toBe('System roles cannot be deleted');
      }

      const roles = await db('roles').select('key');
      expect(roles.map((r) => r.key).sort()).toEqual(
        expect.arrayContaining(['admin', 'manager', 'member'])
      );
    });

    it('denies a manager from deleting a custom role', async () => {
      await managerAgent
        .delete(`/api/v1/admin/roles/${customRoleId}`)
        .set('X-CSRF-Token', managerCsrf)
        .expect(403);
    });

    it('refuses to delete a custom role still assigned to a user', async () => {
      const user = await db('users').where({ email: 'roles-member@example.com' }).first();
      await adminAgent
        .patch(`/api/v1/users/${user.id}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ roleKey: 'support-lead' })
        .expect(200);

      const res = await adminAgent
        .delete(`/api/v1/admin/roles/${customRoleId}`)
        .set('X-CSRF-Token', adminCsrf)
        .expect(409);
      expect(res.body.message).toBe('Cannot delete a role that is still assigned to users');

      // move the user back off the custom role so it can be deleted below
      await adminAgent
        .patch(`/api/v1/users/${user.id}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ roleKey: 'member' })
        .expect(200);
    });

    it('deletes an unassigned custom role', async () => {
      await adminAgent
        .delete(`/api/v1/admin/roles/${customRoleId}`)
        .set('X-CSRF-Token', adminCsrf)
        .expect(204);

      const deleted = await db('roles').where({ id: customRoleId }).first();
      expect(deleted).toBeUndefined();
    });
  });
});
