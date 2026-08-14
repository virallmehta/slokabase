import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// This file logs in many more times than the default AUTH_RATE_LIMIT_MAX
// (10) allows across its many describe blocks — raise it before importing
// app.js so the limiter doesn't interfere with unrelated assertions (see
// rateLimit.test.js, which uses the same per-file-module-registry trick
// in the other direction).
process.env.AUTH_RATE_LIMIT_MAX = '50';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');

function csrfFrom(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Admin Users module — /api/v1/users, /api/v1/roles', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;
  let managerAgent;
  let managerCsrf;
  let managerId;
  let memberId;

  beforeAll(async () => {
    await resetDatabase();

    adminAgent = request.agent(app);
    const adminLogin = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = csrfFrom(adminLogin);

    // Register two members, then promote one to manager via the admin
    // endpoint itself — exercises role reassignment as part of setup.
    const managerReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Future Manager', email: 'future-manager@example.com', password: 'password123' })
      .expect(201);
    managerId = managerReg.body.user.id;

    const memberReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Plain Member', email: 'plain-member@example.com', password: 'password123' })
      .expect(201);
    memberId = memberReg.body.user.id;

    await adminAgent
      .patch(`/api/v1/users/${managerId}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ roleKey: 'manager' })
      .expect(200);

    managerAgent = request.agent(app);
    const managerLogin = await managerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'future-manager@example.com', password: 'password123' })
      .expect(200);
    managerCsrf = csrfFrom(managerLogin);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('GET /api/v1/roles', () => {
    it('returns the four starter roles', async () => {
      const res = await adminAgent.get('/api/v1/roles').expect(200);
      expect(res.body.roles.map((r) => r.key).sort()).toEqual([
        'admin',
        'demo',
        'manager',
        'member',
      ]);
    });

    it('denies a member (lacks users:read)', async () => {
      const memberAgent = request.agent(app);
      await memberAgent
        .post('/api/v1/auth/login')
        .send({ email: 'plain-member@example.com', password: 'password123' })
        .expect(200);
      await memberAgent.get('/api/v1/roles').expect(403);
    });
  });

  describe('GET /api/v1/users (list/search/filter/pagination)', () => {
    it('lists users with pagination metadata', async () => {
      const res = await adminAgent.get('/api/v1/users').expect(200);
      expect(res.body).toMatchObject({ page: 1, limit: 25 });
      expect(res.body.total).toBeGreaterThanOrEqual(3); // admin + manager + member
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('searches by name/email substring', async () => {
      const res = await adminAgent.get('/api/v1/users?search=future-manager').expect(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].email).toBe('future-manager@example.com');
    });

    it('filters by role', async () => {
      const res = await adminAgent.get('/api/v1/users?role=manager').expect(200);
      expect(res.body.users.every((u) => u.role === 'manager')).toBe(true);
      expect(res.body.users.some((u) => u.id === managerId)).toBe(true);
    });

    it('filters by status', async () => {
      const res = await adminAgent.get('/api/v1/users?status=active').expect(200);
      expect(res.body.users.every((u) => u.status === 'active')).toBe(true);
    });

    it('paginates with limit', async () => {
      const res = await adminAgent.get('/api/v1/users?limit=1&page=1').expect(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.limit).toBe(1);
    });

    it('manager (users:read) can list users too', async () => {
      await managerAgent.get('/api/v1/users').expect(200);
    });

    it('denies a member (lacks users:read)', async () => {
      const memberAgent = request.agent(app);
      await memberAgent
        .post('/api/v1/auth/login')
        .send({ email: 'plain-member@example.com', password: 'password123' })
        .expect(200);
      await memberAgent.get('/api/v1/users').expect(403);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns a single user with status/last_login_at', async () => {
      const res = await adminAgent.get(`/api/v1/users/${memberId}`).expect(200);
      expect(res.body.user).toMatchObject({ id: memberId, status: 'active' });
      expect(res.body.user).toHaveProperty('last_login_at');
    });

    it('404s for a non-existent user', async () => {
      await adminAgent.get('/api/v1/users/999999').expect(404);
    });
  });

  describe('PATCH /api/v1/users/:id (admin edit)', () => {
    it('lets a manager (users:write) edit name/email without touching role', async () => {
      const res = await managerAgent
        .patch(`/api/v1/users/${memberId}`)
        .set('X-CSRF-Token', managerCsrf)
        .send({ name: 'Renamed By Manager' })
        .expect(200);
      expect(res.body.user.name).toBe('Renamed By Manager');
    });

    it('blocks a manager from reassigning a role (lacks roles:manage)', async () => {
      const res = await managerAgent
        .patch(`/api/v1/users/${memberId}`)
        .set('X-CSRF-Token', managerCsrf)
        .send({ roleKey: 'admin' })
        .expect(403);
      expect(res.body.message).toBe('Only users with roles:manage can reassign roles');

      // Confirm the role genuinely didn't change.
      const check = await adminAgent.get(`/api/v1/users/${memberId}`).expect(200);
      expect(check.body.user.role).toBe('member');
    });

    it('lets an admin (roles:manage) reassign a role', async () => {
      const res = await adminAgent
        .patch(`/api/v1/users/${memberId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ roleKey: 'manager' })
        .expect(200);
      expect(res.body.user.role).toBe('manager');

      // Revert for isolation from later tests.
      await adminAgent
        .patch(`/api/v1/users/${memberId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ roleKey: 'member' })
        .expect(200);
    });

    it('lets an admin suspend a user', async () => {
      const res = await adminAgent
        .patch(`/api/v1/users/${memberId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ status: 'suspended' })
        .expect(200);
      expect(res.body.user.status).toBe('suspended');
    });

    it('blocks a suspended user from logging in', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'plain-member@example.com', password: 'password123' })
        .expect(403);
      expect(res.body.message).toBe('This account has been suspended');

      // Reactivate for isolation from later tests.
      await adminAgent
        .patch(`/api/v1/users/${memberId}`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ status: 'active' })
        .expect(200);
    });

    it('denies a plain member from editing other users (lacks users:write)', async () => {
      const memberAgent = request.agent(app);
      const login = await memberAgent
        .post('/api/v1/auth/login')
        .send({ email: 'plain-member@example.com', password: 'password123' })
        .expect(200);
      const csrf = csrfFrom(login);

      await memberAgent
        .patch(`/api/v1/users/${managerId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Hijacked' })
        .expect(403);
    });
  });

  describe('login records last_login_at', () => {
    it('sets last_login_at on successful login', async () => {
      // Dedicated, never-before-logged-in user — plain-member has already
      // logged in several times by this point (earlier permission checks),
      // so its last_login_at wouldn't be null anymore.
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Fresh Login', email: 'fresh-login@example.com', password: 'password123' })
        .expect(201);

      const before = await adminAgent.get(`/api/v1/users/${reg.body.user.id}`).expect(200);
      expect(before.body.user.last_login_at).toBeNull();

      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'fresh-login@example.com', password: 'password123' })
        .expect(200);

      const after = await adminAgent.get(`/api/v1/users/${reg.body.user.id}`).expect(200);
      expect(after.body.user.last_login_at).not.toBeNull();
    });
  });

  describe('PATCH /api/v1/users/me/password', () => {
    it('rejects the wrong current password', async () => {
      const res = await managerAgent
        .patch('/api/v1/users/me/password')
        .set('X-CSRF-Token', managerCsrf)
        .send({ currentPassword: 'totally-wrong', newPassword: 'newpassword123' })
        .expect(401);
      expect(res.body.message).toBe('Current password is incorrect');
    });

    it('rejects a new password shorter than 8 characters', async () => {
      await managerAgent
        .patch('/api/v1/users/me/password')
        .set('X-CSRF-Token', managerCsrf)
        .send({ currentPassword: 'password123', newPassword: 'short' })
        .expect(400);
    });

    it('changes the password and the new one works on next login', async () => {
      await managerAgent
        .patch('/api/v1/users/me/password')
        .set('X-CSRF-Token', managerCsrf)
        .send({ currentPassword: 'password123', newPassword: 'newpassword123' })
        .expect(200);

      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'future-manager@example.com', password: 'newpassword123' })
        .expect(200);

      // The old password no longer works.
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'future-manager@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET/PATCH /api/v1/users/me includes permissions (toPublicUser)', () => {
    it('getProfile includes the permissions array', async () => {
      const res = await adminAgent.get('/api/v1/users/me').expect(200);
      expect(res.body.user.permissions).toContain('roles:manage');
    });

    it('updateProfile response also includes permissions', async () => {
      const res = await adminAgent
        .patch('/api/v1/users/me')
        .set('X-CSRF-Token', adminCsrf)
        .send({ name: 'Admin' })
        .expect(200);
      expect(Array.isArray(res.body.user.permissions)).toBe(true);
      expect(res.body.user.permissions.length).toBeGreaterThan(0);
    });
  });
});
