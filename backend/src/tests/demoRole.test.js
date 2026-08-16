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

describe('Demo role and demo user seed', () => {
  const demoCredentials = {
    email: process.env.SEED_DEMO_EMAIL || 'demo@example.com',
    password: process.env.SEED_DEMO_PASSWORD || 'DemoOnly123!',
  };

  let demoAgent;
  let demoCsrf;

  beforeAll(async () => {
    await resetDatabase();

    demoAgent = request.agent(app);
    const loginRes = await demoAgent.post('/api/v1/auth/login').send(demoCredentials).expect(200);
    demoCsrf = csrfFrom(loginRes);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('logs in without hitting the forced-password-change gate', async () => {
    const meRes = await demoAgent.get('/api/v1/auth/me').expect(200);
    expect(meRes.body.user.mustChangePassword).toBe(false);
  });

  it('is granted exactly the demo role\'s read-only permission set', async () => {
    const meRes = await demoAgent.get('/api/v1/auth/me').expect(200);
    expect(meRes.body.user.role).toBe('demo');
    expect([...meRes.body.user.permissions].sort()).toEqual([
      'audit:read',
      'example-products:read',
      'example-sales:read',
      'roles:read',
      'settings:read',
      'users:read',
    ]);
  });

  it('can view every admin section it has :read for', async () => {
    await demoAgent.get('/api/v1/users').expect(200);
    await demoAgent.get('/api/v1/admin/roles').expect(200);
    await demoAgent.get('/api/v1/admin/settings').expect(200);
    await demoAgent.get('/api/v1/admin/audit-logs').expect(200);
    await demoAgent.get('/api/v1/example-products').expect(200);
    await demoAgent.get('/api/v1/example-sales').expect(200);
  });

  it('cannot mutate anything — every write/delete/manage action is forbidden', async () => {
    await demoAgent
      .post('/api/v1/users')
      .set('X-CSRF-Token', demoCsrf)
      .send({ name: 'Should Fail', email: 'should-fail@example.com' })
      .expect(403);

    await demoAgent
      .put('/api/v1/admin/settings/app_name')
      .set('X-CSRF-Token', demoCsrf)
      .send({ value: 'Hijacked' })
      .expect(403);

    await demoAgent
      .post('/api/v1/admin/roles')
      .set('X-CSRF-Token', demoCsrf)
      .send({ name: 'Should Fail' })
      .expect(403);

    await demoAgent
      .post('/api/v1/example-products')
      .set('X-CSRF-Token', demoCsrf)
      .send({ name: 'Should Fail', sku: 'FAIL-1', price: 1 })
      .expect(403);
  });
});
