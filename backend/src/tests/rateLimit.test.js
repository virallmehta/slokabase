import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Set a low limit before importing app.js so config/env.js picks it up —
// vitest gives each test file its own module registry, so this doesn't
// leak into other test files. Keeps this test fast instead of firing the
// default 10+ requests.
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');

describe('Auth rate limiter', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('allows attempts under the configured max', async () => {
    const credentials = { email: 'nobody@example.com', password: 'wrong-password' };

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/v1/auth/login').send(credentials);
      expect(res.status).toBe(401); // wrong credentials, but not yet rate-limited
    }
  });

  it('blocks further attempts once the max is exceeded', async () => {
    const credentials = { email: 'nobody@example.com', password: 'wrong-password' };

    const res = await request(app).post('/api/v1/auth/login').send(credentials);
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many attempts/i);
  });
});
