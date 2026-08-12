import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '#db/knex.js';
import { settingsRepository, castValue } from '#services/settingsRepository.js';
import { resetDatabase } from './testDb.js';

// Unit-level tests against the repository directly (no HTTP layer) — see
// src/tests/settings.test.js for the API-level auth/validation coverage.
// These focus specifically on the get/set/cache-invalidation logic itself.
describe('settingsRepository (backend/src/services/settingsRepository.js)', () => {
  beforeEach(async () => {
    await resetDatabase();
    // resetDatabase() re-seeds the table but doesn't know about this
    // module's private in-memory cache — clear it too, or a value set by
    // one test (or an out-of-band write within a test) leaks into the next.
    settingsRepository._invalidateCacheForTests();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('castValue', () => {
    it('casts a string type as-is', () => {
      expect(castValue({ type: 'string', value: 'hello' })).toBe('hello');
    });

    it('casts a number type to a JS number', () => {
      expect(castValue({ type: 'number', value: '42' })).toBe(42);
    });

    it('casts a boolean type from the literal string "true"/"false"', () => {
      expect(castValue({ type: 'boolean', value: 'true' })).toBe(true);
      expect(castValue({ type: 'boolean', value: 'false' })).toBe(false);
      // Anything other than the literal string "true" is false — a
      // deliberately strict cast, not `Boolean(value)` (which would make
      // the string "false" truthy).
      expect(castValue({ type: 'boolean', value: 'nope' })).toBe(false);
    });

    it('casts a json type by parsing it', () => {
      expect(castValue({ type: 'json', value: '{"a":1}' })).toEqual({ a: 1 });
    });
  });

  describe('get/getAll', () => {
    it('getAll returns every seeded setting with its value already cast', async () => {
      const settings = await settingsRepository.getAll();
      const byKey = Object.fromEntries(settings.map((s) => [s.key, s]));
      expect(byKey.app_name.value).toBe('Slokabase');
      expect(byKey.items_per_page_default.value).toBe(25);
      expect(typeof byKey.items_per_page_default.value).toBe('number');
    });

    it('get returns a single cast value by key', async () => {
      expect(await settingsRepository.get('app_name')).toBe('Slokabase');
    });

    it('get returns undefined for an unknown key', async () => {
      expect(await settingsRepository.get('does_not_exist')).toBeUndefined();
    });
  });

  describe('cache invalidation', () => {
    it('caches after the first read — a write that bypasses the repository is not seen until invalidated', async () => {
      expect(await settingsRepository.get('app_name')).toBe('Slokabase');

      // Simulate an out-of-band write (e.g. a direct DB edit) that the
      // repository's cache doesn't know about.
      await db('app_settings').where({ key: 'app_name' }).update({ value: 'Changed Behind Cache' });

      // Still stale — this is the cache actually caching, not a no-op.
      expect(await settingsRepository.get('app_name')).toBe('Slokabase');

      settingsRepository._invalidateCacheForTests();
      expect(await settingsRepository.get('app_name')).toBe('Changed Behind Cache');
    });

    it('set() invalidates the cache itself — no manual invalidation needed after a normal write', async () => {
      expect(await settingsRepository.get('app_name')).toBe('Slokabase');

      await settingsRepository.set('app_name', 'Set Through Repository', {});

      expect(await settingsRepository.get('app_name')).toBe('Set Through Repository');
    });

    it('a subsequent getAll() after set() reflects the new value, not a stale cached array', async () => {
      await settingsRepository.getAll(); // populate the cache
      await settingsRepository.set('support_email', 'new-support@example.com', {});

      const settings = await settingsRepository.getAll();
      const byKey = Object.fromEntries(settings.map((s) => [s.key, s]));
      expect(byKey.support_email.value).toBe('new-support@example.com');
    });
  });

  describe('set', () => {
    it('returns null for an unknown key instead of throwing (controller translates this to 404)', async () => {
      expect(await settingsRepository.set('not_a_real_key', 'x', {})).toBeNull();
    });

    it('serializes a number value back to text in storage, cast to a number again on read', async () => {
      await settingsRepository.set('items_per_page_default', 50, {});
      const row = await db('app_settings').where({ key: 'items_per_page_default' }).first();
      expect(row.value).toBe('50');
      expect(await settingsRepository.get('items_per_page_default')).toBe(50);
    });

    it('records updated_by', async () => {
      const admin = await db('users').where({ email: 'admin@example.com' }).first();
      await settingsRepository.set('app_name', 'Attributed Change', { actorId: admin.id });
      const row = await db('app_settings').where({ key: 'app_name' }).first();
      expect(row.updated_by).toBe(admin.id);
    });
  });
});
