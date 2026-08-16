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

  it('denies a manager (lacks settings:read) from listing settings', async () => {
    await managerAgent.get('/api/v1/admin/settings').expect(403);
  });

  it('denies a member (lacks settings:read) from listing settings', async () => {
    await memberAgent.get('/api/v1/admin/settings').expect(403);
  });

  it('lets admin list settings grouped by category, with values already cast to their declared type', async () => {
    const res = await adminAgent.get('/api/v1/admin/settings').expect(200);
    // Alphabetical by category — Email (smtp_*) sorts before General (app_name).
    expect(res.body.groups.map((g) => g.category)).toEqual(['Email', 'General']);

    const generalGroup = res.body.groups.find((g) => g.category === 'General');
    const byKey = Object.fromEntries(generalGroup.settings.map((s) => [s.key, s]));
    expect(byKey.app_name.value).toBe('Slokabase');
    expect(typeof byKey.app_name.value).toBe('string');
  });

  it('never echoes back the smtp_password value, even to an admin', async () => {
    const res = await adminAgent.get('/api/v1/admin/settings').expect(200);
    const emailGroup = res.body.groups.find((g) => g.category === 'Email');
    const byKey = Object.fromEntries(emailGroup.settings.map((s) => [s.key, s]));
    expect(byKey.smtp_password.value).toBe('');
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
    const generalGroup = res.body.groups.find((g) => g.category === 'General');
    const byKey = Object.fromEntries(generalGroup.settings.map((s) => [s.key, s]));
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

  describe('smtp_port validation', () => {
    it('rejects a port outside 1-65535', async () => {
      const res = await adminAgent
        .put('/api/v1/admin/settings/smtp_port')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 70000 })
        .expect(400);
      expect(res.body.message).toMatch(/smtp_port.*must be a valid port number/);
    });

    it('rejects a non-integer port', async () => {
      const res = await adminAgent
        .put('/api/v1/admin/settings/smtp_port')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 25.5 })
        .expect(400);
      expect(res.body.message).toMatch(/smtp_port.*must be a valid port number/);
    });

    it('accepts 0 (the "use the .env default" sentinel)', async () => {
      await adminAgent
        .put('/api/v1/admin/settings/smtp_port')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 0 })
        .expect(200);
    });

    it('accepts a valid port', async () => {
      const res = await adminAgent
        .put('/api/v1/admin/settings/smtp_port')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 587 })
        .expect(200);
      expect(res.body.setting.value).toBe(587);
    });
  });

  describe('smtp_from validation', () => {
    it('rejects a value that is not a valid email address', async () => {
      const res = await adminAgent
        .put('/api/v1/admin/settings/smtp_from')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 'not-an-email' })
        .expect(400);
      expect(res.body.message).toMatch(/smtp_from.*must be a valid email address/);
    });

    it('accepts an empty string (the "use the .env default" sentinel)', async () => {
      await adminAgent
        .put('/api/v1/admin/settings/smtp_from')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: '' })
        .expect(200);
    });

    it('accepts a valid email address', async () => {
      const res = await adminAgent
        .put('/api/v1/admin/settings/smtp_from')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 'no-reply@example.com' })
        .expect(200);
      expect(res.body.setting.value).toBe('no-reply@example.com');
    });
  });

  describe('smtp_password audit logging', () => {
    it('records that it changed without logging the actual value', async () => {
      await adminAgent
        .put('/api/v1/admin/settings/smtp_password')
        .set('X-CSRF-Token', adminCsrf)
        .send({ value: 'super-secret-value' })
        .expect(200);

      const log = await db('audit_logs')
        .where({ entity_type: 'setting', entity_id: 'smtp_password', action: 'update' })
        .orderBy('created_at', 'desc')
        .first();
      expect(log).toBeTruthy();
      expect(JSON.stringify(log.changes)).not.toMatch(/super-secret-value/);
    });
  });

  describe('POST /api/v1/admin/settings/test-email', () => {
    it('denies a manager (lacks settings:manage)', async () => {
      await managerAgent.post('/api/v1/admin/settings/test-email').set('X-CSRF-Token', adminCsrf).expect(403);
    });

    it('rejects a mutating request without a matching CSRF header', async () => {
      await adminAgent.post('/api/v1/admin/settings/test-email').expect(403);
    });

    it('sends a test email to the caller and confirms it in the response', async () => {
      const res = await adminAgent
        .post('/api/v1/admin/settings/test-email')
        .set('X-CSRF-Token', adminCsrf)
        .expect(200);
      expect(res.body.message).toBe(`Test email sent to ${adminCredentials.email}.`);
    });
  });
});
