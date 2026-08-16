import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

process.env.AUTH_RATE_LIMIT_MAX = '50';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');

describe('Public Settings — GET /api/v1/settings/public', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let memberAgent;

  beforeAll(async () => {
    await resetDatabase();

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Public Settings Member', email: 'public-settings-member@example.com', password: 'password123' })
      .expect(201);
    memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: 'public-settings-member@example.com', password: 'password123' })
      .expect(200);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/settings/public').expect(401);
  });

  it('lets a plain member (no settings:read, no settings:manage) read exactly appName', async () => {
    const res = await memberAgent.get('/api/v1/settings/public').expect(200);
    expect(res.body).toEqual({ appName: 'Slokabase' });
  });

  it('lets an admin read the same shape (no elevated fields leak through)', async () => {
    const adminAgent = request.agent(app);
    await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);

    const res = await adminAgent.get('/api/v1/settings/public').expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['appName']);
  });
});
