import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from './testDb.js';
import { _getSentEmailsForTests, _clearSentEmailsForTests } from '#services/emailService.js';

function csrfFrom(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

function extractTemporaryPassword(emailText) {
  return /Temporary password: (\S+)/.exec(emailText)[1];
}

describe('enforcePasswordChange middleware — forces admin-created users to change their password', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;

  beforeAll(async () => {
    await resetDatabase();
    adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = csrfFrom(loginRes);
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(() => {
    _clearSentEmailsForTests();
  });

  async function createUserAndLogin() {
    const email = `forced-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    await adminAgent
      .post('/api/v1/users')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Forced Change User', email })
      .expect(201);

    const [sent] = _getSentEmailsForTests();
    const temporaryPassword = extractTemporaryPassword(sent.text);

    const userAgent = request.agent(app);
    const loginRes = await userAgent
      .post('/api/v1/auth/login')
      .send({ email, password: temporaryPassword })
      .expect(200);
    const userCsrf = csrfFrom(loginRes);

    return { userAgent, userCsrf, email, temporaryPassword };
  }

  it('sets must_change_password on a newly admin-created user', async () => {
    const { email } = await createUserAndLogin();
    const row = await db('users').where({ email }).first();
    expect(!!row.must_change_password).toBe(true);
  });

  it('blocks an otherwise-permitted route with 403 + a MUST_CHANGE_PASSWORD code', async () => {
    const { userAgent } = await createUserAndLogin();

    const blocked = await userAgent.get('/api/v1/users/me').expect(403);
    expect(blocked.body.errors).toEqual({ code: 'MUST_CHANGE_PASSWORD' });
  });

  it('still allows the allowlisted routes: GET /auth/me, POST /auth/refresh, POST /auth/logout', async () => {
    const { userAgent } = await createUserAndLogin();

    await userAgent.get('/api/v1/auth/me').expect(200);
    // /auth/refresh rotates the CSRF cookie too, so logout must use the
    // fresh token from this response, not the one from the original login.
    const refreshRes = await userAgent.post('/api/v1/auth/refresh').expect(200);
    const refreshedCsrf = csrfFrom(refreshRes);

    await userAgent.post('/api/v1/auth/logout').set('X-CSRF-Token', refreshedCsrf).expect(200);
  });

  it('allows PATCH /api/v1/users/me/password even while must_change_password is true', async () => {
    const { userAgent, userCsrf, temporaryPassword } = await createUserAndLogin();

    await userAgent
      .patch('/api/v1/users/me/password')
      .set('X-CSRF-Token', userCsrf)
      .send({ currentPassword: temporaryPassword, newPassword: 'aBrandNewPassword123!' })
      .expect(200);
  });

  it('clears must_change_password after a successful change, unblocking normal routes', async () => {
    const { userAgent, userCsrf, email, temporaryPassword } = await createUserAndLogin();

    await userAgent
      .patch('/api/v1/users/me/password')
      .set('X-CSRF-Token', userCsrf)
      .send({ currentPassword: temporaryPassword, newPassword: 'aBrandNewPassword123!' })
      .expect(200);

    const row = await db('users').where({ email }).first();
    expect(!!row.must_change_password).toBe(false);

    await userAgent.get('/api/v1/users/me').expect(200);
  });

  it('does not interfere with unauthenticated requests (normal 401, not 403)', async () => {
    await request(app).get('/api/v1/users').expect(401);
  });

  it('does not affect a normal user without must_change_password set', async () => {
    await adminAgent.get('/api/v1/users').expect(200);
  });
});
