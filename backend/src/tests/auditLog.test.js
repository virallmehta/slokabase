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

describe('System Audit Log module — /api/v1/admin/audit-logs', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;
  let managerAgent;
  let memberAgent;
  let adminUserId;
  let customRoleId;

  beforeAll(async () => {
    await resetDatabase();

    adminAgent = request.agent(app);
    const adminLogin = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = csrfFrom(adminLogin);
    const adminUser = await db('users').where({ email: adminCredentials.email }).first();
    adminUserId = adminUser.id;

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Audit Manager', email: 'audit-manager@example.com', password: 'password123' })
      .expect(201);
    const managerReg = await db('users').where({ email: 'audit-manager@example.com' }).first();
    await adminAgent
      .patch(`/api/v1/users/${managerReg.id}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ roleKey: 'manager' })
      .expect(200);

    managerAgent = request.agent(app);
    await managerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'audit-manager@example.com', password: 'password123' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Audit Member', email: 'audit-member@example.com', password: 'password123' })
      .expect(201);
    memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: 'audit-member@example.com', password: 'password123' })
      .expect(200);

    // Generate some activity: a user update (existing Users audit trail)
    // and a role create + permission update (this task's new Roles trail).
    await adminAgent
      .patch(`/api/v1/users/${managerReg.id}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Audit Manager Renamed' })
      .expect(200);

    const createRes = await adminAgent
      .post('/api/v1/admin/roles')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Auditable Role', permissionKeys: ['users:read'] })
      .expect(201);
    customRoleId = createRes.body.role.id;

    await adminAgent
      .put(`/api/v1/admin/roles/${customRoleId}/permissions`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ permissionKeys: ['users:read', 'products:read'] })
      .expect(200);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/admin/audit-logs').expect(401);
  });

  it('denies a manager (lacks audit:read) from listing audit logs', async () => {
    await managerAgent.get('/api/v1/admin/audit-logs').expect(403);
  });

  it('denies a member (lacks audit:read) from listing audit logs', async () => {
    await memberAgent.get('/api/v1/admin/audit-logs').expect(403);
  });

  it('lets admin list audit logs, newest first, with actor names resolved', async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs').expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.logs)).toBe(true);

    const timestamps = res.body.logs.map((l) => new Date(l.created_at).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));

    const roleCreateEntry = res.body.logs.find(
      (l) => l.entity_type === 'role' && l.action === 'create' && l.entity_id === String(customRoleId)
    );
    expect(roleCreateEntry).toBeTruthy();
    expect(roleCreateEntry.actor_name).toBe('Admin');
    expect(roleCreateEntry.changes).toEqual({ name: { from: null, to: 'Auditable Role' } });
  });

  it("unifies Users' and Roles' activity into one log — both entity types are present", async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs').expect(200);
    const entityTypes = new Set(res.body.logs.map((l) => l.entity_type));
    expect(entityTypes.has('user')).toBe(true);
    expect(entityTypes.has('role')).toBe(true);
  });

  it('records a role permission change as update_permissions with a before/after diff', async () => {
    const res = await adminAgent
      .get('/api/v1/admin/audit-logs')
      .query({ entityType: 'role', action: 'update_permissions' })
      .expect(200);

    const entry = res.body.logs.find((l) => l.entity_id === String(customRoleId));
    expect(entry).toBeTruthy();
    expect(entry.changes.permissions.from.sort()).toEqual(['users:read']);
    expect(entry.changes.permissions.to.sort()).toEqual(['products:read', 'users:read']);
  });

  it('filters by actor', async () => {
    const res = await adminAgent
      .get('/api/v1/admin/audit-logs')
      .query({ actorId: adminUserId })
      .expect(200);
    expect(res.body.logs.every((l) => l.actor_id === adminUserId)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });

  it('filters by search (actor name substring, case-insensitive)', async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs').query({ search: 'admin' }).expect(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(res.body.logs.every((l) => l.actor_name?.toLowerCase().includes('admin'))).toBe(true);
  });

  it('filters by entity type (module)', async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs').query({ entityType: 'role' }).expect(200);
    expect(res.body.logs.every((l) => l.entity_type === 'role')).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });

  it('filters by action', async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs').query({ action: 'create' }).expect(200);
    expect(res.body.logs.every((l) => l.action === 'create')).toBe(true);
  });

  it('filters by date range (dateFrom in the future excludes everything)', async () => {
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const res = await adminAgent
      .get('/api/v1/admin/audit-logs')
      .query({ dateFrom: farFuture })
      .expect(200);
    expect(res.body.logs).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('paginates', async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs').query({ limit: 1, page: 1 }).expect(200);
    expect(res.body.logs.length).toBe(1);
    expect(res.body.limit).toBe(1);
  });

  it('rejects an unrecognized query param combination gracefully (bad date)', async () => {
    await adminAgent.get('/api/v1/admin/audit-logs').query({ dateFrom: 'not-a-date' }).expect(400);
  });

  it('lets admin fetch filter options derived from what has actually been logged', async () => {
    const res = await adminAgent.get('/api/v1/admin/audit-logs/filter-options').expect(200);
    expect(res.body.entityTypes).toEqual(expect.arrayContaining(['user', 'role']));
    expect(res.body.actions).toEqual(expect.arrayContaining(['create', 'update', 'update_permissions']));
  });

  it('denies a manager from fetching filter options', async () => {
    await managerAgent.get('/api/v1/admin/audit-logs/filter-options').expect(403);
  });
});
