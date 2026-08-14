import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

process.env.AUTH_RATE_LIMIT_MAX = '50';

const { app } = await import('../app.js');
const { db } = await import('#db/knex.js');
const { resetDatabase } = await import('./testDb.js');
const { settingsRepository } = await import('#services/settingsRepository.js');

function csrfFrom(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Application Settings module — /api/v1/admin/settings', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;
  let managerAgent;
  let memberAgent;

  beforeAll(async () => {
    await resetDatabase();

    adminAgent = request.agent(app);
    const adminLogin = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = csrfFrom(adminLogin);

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Settings Manager', email: 'settings-manager@example.com', password: 'password123' })
      .expect(201);
    const managerReg = await db('users').where({ email: 'settings-manager@example.com' }).first();
    await adminAgent
      .patch(`/api/v1/users/${managerReg.id}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ roleKey: 'manager' })
      .expect(200);
    managerAgent = request.agent(app);
    await managerAgent
      .post('/api/v1/auth/login')
      .send({ email: 'settings-manager@example.com', password: 'password123' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Settings Member', email: 'settings-member@example.com', password: 'password123' })
      .expect(201);
    memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: 'settings-member@example.com', password: 'password123' })
      .expect(200);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/admin/settings').expect(401);
  });

  it('denies a manager (lacks settings:manage) from listing settings', async () => {
    await managerAgent.get('/api/v1/admin/settings').expect(403);
  });

  it('denies a member (lacks settings:manage) from listing settings', async () => {
    await memberAgent.get('/api/v1/admin/settings').expect(403);
  });

  it('lets admin list settings grouped by category, with values already cast to their declared type', async () => {
    const res = await adminAgent.get('/api/v1/admin/settings').expect(200);
    expect(res.body.groups).toEqual([{ category: 'General', settings: expect.any(Array) }]);

    const byKey = Object.fromEntries(res.body.groups[0].settings.map((s) => [s.key, s]));
    expect(byKey.app_name.value).toBe('Slokabase');
    expect(typeof byKey.app_name.value).toBe('string');
  });

  it('404s updating an unknown setting key', async () => {
    await adminAgent
      .put('/api/v1/admin/settings/not_a_real_setting')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: 'anything' })
      .expect(404);
  });

  it('denies a manager from updating a setting', async () => {
    await managerAgent
      .put('/api/v1/admin/settings/app_name')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: 'Nope' })
      .expect(403);
  });

  it('rejects a mutating request without a matching CSRF header', async () => {
    await adminAgent.put('/api/v1/admin/settings/app_name').send({ value: 'Nope' }).expect(403);
  });

  it('rejects a value of the wrong type for the setting (string field, number sent)', async () => {
    const res = await adminAgent
      .put('/api/v1/admin/settings/app_name')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: 123 })
      .expect(400);
    expect(res.body.message).toMatch(/expects a value of type "string"/);
  });

  it('rejects a value of the wrong type for a number field (string sent)', async () => {
    await db('app_settings').insert({
      key: 'test_number_setting',
      value: '10',
      type: 'number',
      category: 'General',
      description: 'Test-only number setting.',
    });
    settingsRepository._invalidateCacheForTests();

    const res = await adminAgent
      .put('/api/v1/admin/settings/test_number_setting')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: 'fifty' })
      .expect(400);
    expect(res.body.message).toMatch(/expects a value of type "number"/);
  });

  it('updates a string setting and records who changed it', async () => {
    const adminUser = await db('users').where({ email: adminCredentials.email }).first();

    const res = await adminAgent
      .put('/api/v1/admin/settings/app_name')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: 'Renamed App' })
      .expect(200);
    expect(res.body.setting.value).toBe('Renamed App');

    const row = await db('app_settings').where({ key: 'app_name' }).first();
    expect(row.value).toBe('Renamed App');
    expect(row.updated_by).toBe(adminUser.id);
  });

  it('updating a setting invalidates the cache — a subsequent read is not stale', async () => {
    await db('app_settings').insert({
      key: 'test_cache_setting',
      value: 'before',
      type: 'string',
      category: 'General',
      description: 'Test-only setting for cache-invalidation coverage.',
    });
    settingsRepository._invalidateCacheForTests();

    await adminAgent
      .put('/api/v1/admin/settings/test_cache_setting')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: 'after' })
      .expect(200);

    const res = await adminAgent.get('/api/v1/admin/settings').expect(200);
    const byKey = Object.fromEntries(res.body.groups[0].settings.map((s) => [s.key, s]));
    expect(byKey.test_cache_setting.value).toBe('after');
  });

  it('updates a boolean-typed setting correctly (round-trips through cast/serialize)', async () => {
    await db('app_settings').insert({
      key: 'maintenance_mode',
      value: 'false',
      type: 'boolean',
      category: 'General',
      description: 'Test-only boolean setting.',
    });
    settingsRepository._invalidateCacheForTests();

    const before = await settingsRepository.get('maintenance_mode');
    expect(before).toBe(false);

    await adminAgent
      .put('/api/v1/admin/settings/maintenance_mode')
      .set('X-CSRF-Token', adminCsrf)
      .send({ value: true })
      .expect(200);

    const after = await settingsRepository.get('maintenance_mode');
    expect(after).toBe(true);
  });
});
