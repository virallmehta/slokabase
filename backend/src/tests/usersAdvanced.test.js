import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Many logins across many describe blocks — same rationale as
// users.test.js.
process.env.AUTH_RATE_LIMIT_MAX = '50';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');
const { _getSentEmailsForTests, _clearSentEmailsForTests } = await import('#services/emailService.js');

function extractTemporaryPassword(emailText) {
  return /Temporary password: (\S+)/.exec(emailText)[1];
}

function csrfFrom(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Users module — create/delete/audit-logs/related-sales', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;
  let managerAgent;
  let managerCsrf;
  let managerId;

  beforeAll(async () => {
    await resetDatabase();

    adminAgent = request.agent(app);
    const adminLogin = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = csrfFrom(adminLogin);

    const managerReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Manager Two', email: 'manager-two@example.com', password: 'password123' })
      .expect(201);
    managerId = managerReg.body.user.id;
    await adminAgent
      .patch(`/api/v1/users/${managerId}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ roleKey: 'manager' })
      .expect(200);

    managerAgent = request.agent(app);
    const managerLogin = await managerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'manager-two@example.com', password: 'password123' })
      .expect(200);
    managerCsrf = csrfFrom(managerLogin);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /api/v1/users (admin create)', () => {
    it('creates a user with a generated temporary password, emailed (not returned), forcing a password change', async () => {
      _clearSentEmailsForTests();
      const res = await adminAgent
        .post('/api/v1/users')
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Created User', email: 'created-user@example.com' })
        .expect(201);

      expect(res.body.user).toMatchObject({ name: 'Created User', email: 'created-user@example.com' });
      // Never a second exposure channel for the temp password alongside the email.
      expect(res.body.temporaryPassword).toBeUndefined();

      const [sent] = _getSentEmailsForTests();
      expect(sent.to).toBe('created-user@example.com');
      const temporaryPassword = extractTemporaryPassword(sent.text);
      expect(temporaryPassword.length).toBeGreaterThan(8);

      const created = await db('users').where({ email: 'created-user@example.com' }).first();
      expect(!!created.must_change_password).toBe(true);

      // The generated password actually works.
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'created-user@example.com', password: temporaryPassword })
        .expect(200);
    });

    it('rejects a duplicate email', async () => {
      await adminAgent
        .post('/api/v1/users')
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Dup', email: 'created-user@example.com' })
        .expect(409);
    });

    it('lets an admin (roles:manage) create a user with a specific role', async () => {
      const res = await adminAgent
        .post('/api/v1/users')
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Created Manager', email: 'created-manager@example.com', roleKey: 'manager' })
        .expect(201);
      expect(res.body.user.role).toBe('manager');
    });

    it('blocks a manager (lacks roles:manage) from specifying a role on create', async () => {
      const res = await managerAgent
        .post('/api/v1/users')
        .set('X-CSRF-Token', managerCsrf)
        .send({ name: 'Sneaky', email: 'sneaky@example.com', roleKey: 'admin' })
        .expect(403);
      expect(res.body.message).toBe('Only users with roles:manage can assign a role');
    });

    it('lets a manager (users:write) create a user without specifying a role (defaults to member)', async () => {
      const res = await managerAgent
        .post('/api/v1/users')
        .set('X-CSRF-Token', managerCsrf)
        .send({ name: 'Manager Created', email: 'manager-created@example.com' })
        .expect(201);
      expect(res.body.user.role).toBe('member');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    let targetId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'To Delete', email: 'to-delete@example.com', password: 'password123' })
        .expect(201);
      targetId = res.body.user.id;
    });

    it('denies a manager (lacks users:delete)', async () => {
      await managerAgent
        .delete(`/api/v1/users/${targetId}`)
        .set('X-CSRF-Token', managerCsrf)
        .expect(403);
    });

    it("blocks an admin from deleting their own account", async () => {
      const meRes = await adminAgent.get('/api/v1/users/me').expect(200);
      const res = await adminAgent
        .delete(`/api/v1/users/${meRes.body.user.id}`)
        .set('X-CSRF-Token', adminCsrf)
        .expect(400);
      expect(res.body.message).toBe("You can't delete your own account");
    });

    it('lets an admin (users:delete) delete another user', async () => {
      await adminAgent.delete(`/api/v1/users/${targetId}`).set('X-CSRF-Token', adminCsrf).expect(204);
      await adminAgent.get(`/api/v1/users/${targetId}`).expect(404);
    });
  });

  describe('GET /api/v1/users/:id/audit-logs', () => {
    it('records an update entry with a readable field diff', async () => {
      await adminAgent
        .patch(`/api/v1/users/${managerId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Manager Two Renamed' })
        .expect(200);

      const res = await adminAgent.get(`/api/v1/users/${managerId}/audit-logs`).expect(200);
      const entry = res.body.logs.find(
        (log) => log.action === 'update' && log.changes?.name?.to === 'Manager Two Renamed'
      );
      expect(entry).toBeDefined();
      expect(entry.changes.name).toEqual({ from: 'Manager Two', to: 'Manager Two Renamed' });
      expect(entry.actor_name).toBe('Admin');
    });

    it('records a role-reassignment entry', async () => {
      await adminAgent
        .patch(`/api/v1/users/${managerId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ roleKey: 'admin' })
        .expect(200);

      const res = await adminAgent.get(`/api/v1/users/${managerId}/audit-logs`).expect(200);
      const entry = res.body.logs.find((log) => log.changes?.role);
      expect(entry.changes.role).toEqual({ from: 'manager', to: 'admin' });

      // Revert.
      await adminAgent
        .patch(`/api/v1/users/${managerId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ roleKey: 'manager' })
        .expect(200);
    });

    it('records a password_change entry with no field diff (never logs the password)', async () => {
      await managerAgent
        .patch('/api/v1/users/me/password')
        .set('X-CSRF-Token', managerCsrf)
        .send({ currentPassword: 'password123', newPassword: 'freshpassword123' })
        .expect(200);

      const res = await adminAgent.get(`/api/v1/users/${managerId}/audit-logs`).expect(200);
      const entry = res.body.logs.find((log) => log.action === 'password_change');
      expect(entry).toBeDefined();
      expect(entry.changes).toBeNull();
      expect(JSON.stringify(entry)).not.toContain('freshpassword123');
      expect(JSON.stringify(entry)).not.toContain('password123');
    });

    it('does not log a no-op update (no fields actually changed)', async () => {
      const before = await adminAgent.get(`/api/v1/users/${managerId}/audit-logs`).expect(200);
      const countBefore = before.body.logs.length;

      await adminAgent
        .patch(`/api/v1/users/${managerId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Manager Two Renamed' }) // same value as already set
        .expect(200);

      const after = await adminAgent.get(`/api/v1/users/${managerId}/audit-logs`).expect(200);
      expect(after.body.logs.length).toBe(countBefore);
    });

    it('denies a member (lacks users:read)', async () => {
      const memberAgent = request.agent(app);
      await memberAgent
        .post('/api/v1/auth/register')
        .send({ name: 'Plain', email: 'plain-audit@example.com', password: 'password123' })
        .expect(201);
      await memberAgent.get(`/api/v1/users/${managerId}/audit-logs`).expect(403);
    });
  });

  describe('GET /api/v1/users/:id/related-sales', () => {
    it("returns sales the user has recorded, gated by users:read + example-sales:read", async () => {
      const productRes = await adminAgent
        .post('/api/v1/example-products')
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Widget', sku: 'AUD-1', price: 10, stock: 100 })
        .expect(201);

      await adminAgent
        .post('/api/v1/example-sales')
        .set('X-CSRF-Token', adminCsrf)
        .send({ productId: productRes.body.product.id, quantity: 2, unitPrice: 10 })
        .expect(201);

      const meRes = await adminAgent.get('/api/v1/users/me').expect(200);
      const res = await adminAgent.get(`/api/v1/users/${meRes.body.user.id}/related-sales`).expect(200);

      expect(Array.isArray(res.body.sales)).toBe(true);
      expect(res.body.sales.some((s) => s.product_name === 'Widget')).toBe(true);
    });

    it('denies a member (lacks users:read and example-sales:read)', async () => {
      const memberAgent = request.agent(app);
      await memberAgent
        .post('/api/v1/auth/register')
        .send({ name: 'Plain2', email: 'plain-related@example.com', password: 'password123' })
        .expect(201);
      await memberAgent.get(`/api/v1/users/${managerId}/related-sales`).expect(403);
    });
  });
});
