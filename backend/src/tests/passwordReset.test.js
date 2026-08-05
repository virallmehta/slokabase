import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

process.env.AUTH_RATE_LIMIT_MAX = '50';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');
const { _getSentEmailsForTests, _clearSentEmailsForTests } = await import('#services/emailService.js');

// API-level smoke tests for the forgot/reset-password endpoints — the
// underlying token generation/expiry/validation logic itself is covered
// unit-level in tokenService.test.js.
describe('Forgot/reset password API — /api/v1/auth/forgot-password, /reset-password', () => {
  const testUser = {
    name: 'Reset Flow User',
    email: 'reset-flow-user@example.com',
    password: 'originalPassword123',
  };

  beforeAll(async () => {
    await resetDatabase();
    await request(app).post('/api/v1/auth/register').send(testUser).expect(201);
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(() => {
    _clearSentEmailsForTests();
  });

  function extractResetToken(emailText) {
    return /token=([a-f0-9]+)/.exec(emailText)[1];
  }

  it('always returns a generic success message, whether or not the email is registered', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: testUser.email })
      .expect(200);
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-here@example.com' })
      .expect(200);

    expect(known.body).toEqual(unknown.body);
  });

  it('sends a reset email only for a registered address', async () => {
    await request(app).post('/api/v1/auth/forgot-password').send({ email: testUser.email }).expect(200);
    expect(_getSentEmailsForTests()).toHaveLength(1);
    expect(_getSentEmailsForTests()[0].to).toBe(testUser.email);

    _clearSentEmailsForTests();
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-here@example.com' })
      .expect(200);
    expect(_getSentEmailsForTests()).toHaveLength(0);
  });

  it('resets the password end-to-end and revokes existing sessions', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send(testUser).expect(200);
    const refreshCookie = loginRes.headers['set-cookie']
      .find((c) => c.startsWith('refresh_token='))
      .split(';')[0];

    await request(app).post('/api/v1/auth/forgot-password').send({ email: testUser.email }).expect(200);
    const token = extractResetToken(_getSentEmailsForTests()[0].text);

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'aBrandNewResetPassword123!' })
      .expect(200);

    // Old session's refresh token no longer works.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(401);

    // Old password no longer works; new one does.
    await request(app).post('/api/v1/auth/login').send(testUser).expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'aBrandNewResetPassword123!' })
      .expect(200);
  });

  it('rejects reset with an invalid or already-used token', async () => {
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'somethingLongEnough123' })
      .expect(400);
  });
});
