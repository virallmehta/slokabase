import { describe, it, expect, afterAll } from 'vitest';

/**
 * Regression coverage for the "(intermediate value) is not iterable" bug:
 * createAuditedRepository's `insert()` used to do `const [id] = await
 * db(table).insert(data)`, which only works because sqlite3/better-sqlite3
 * happen to return `[id]` directly. Postgres, with no `.returning()`,
 * hands back a raw `QueryResult` object — not an array — so that
 * destructure threw on every single insert against a pg-backed database.
 *
 * This can't be caught by the normal suite: every other test file forces
 * `DB_CLIENT=sqlite3` (see backend/CLAUDE.md's test command), and sqlite
 * never hit this bug in the first place — that's exactly why it shipped
 * unnoticed. This file is intentionally excluded from that path and only
 * runs meaningful assertions when explicitly pointed at Postgres:
 *
 *   DB_CLIENT=pg npx vitest run src/tests/auditedRepository.pg.test.js
 *
 * against a real Postgres database (e.g. this repo's own dev `.env`
 * config, or a disposable one — never production). Under the standard
 * `npm test` (sqlite3), this file's tests are skipped with a clear reason
 * rather than silently passing on the wrong driver.
 */
const isPg = process.env.DB_CLIENT === 'pg';

describe.skipIf(!isPg)('createAuditedRepository().insert() against Postgres', () => {
  afterAll(async () => {
    if (!isPg) return;
    const { db } = await import('#db/knex.js');
    await db.destroy();
  });

  it('returns a usable numeric id instead of throwing "not iterable"', async () => {
    const { db } = await import('#db/knex.js');
    const { createAuditedRepository } = await import('#services/auditedRepository.js');
    const audited = createAuditedRepository('roles', 'role');

    const key = `pg_test_probe_${Date.now()}`;
    let id;
    try {
      id = await audited.insert({ key, name: 'PG Test Probe', is_system: false }, {});

      expect(typeof id).toBe('number');

      const row = await db('roles').where({ id }).first();
      expect(row).toMatchObject({ id, key, name: 'PG Test Probe' });

      const auditRow = await db('audit_logs')
        .where({ entity_type: 'role', entity_id: id, action: 'create' })
        .first();
      expect(auditRow).toBeTruthy();
    } finally {
      if (id) {
        await db('audit_logs').where({ entity_type: 'role', entity_id: id }).del();
        await db('roles').where({ id }).del();
      }
    }
  });

  it('respects a non-default idColumn (mirrors settingsRepository\'s { idColumn: "key" })', async () => {
    const { db } = await import('#db/knex.js');
    const { createAuditedRepository } = await import('#services/auditedRepository.js');
    // app_settings is keyed by `key`, not `id` — exercises the same
    // idColumn-aware unwrap path settingsRepository relies on.
    const audited = createAuditedRepository('app_settings', 'setting', { idColumn: 'key' });

    const key = `pg_test_setting_${Date.now()}`;
    try {
      const returnedKey = await audited.insert(
        { key, value: 'probe', type: 'string', category: 'General', description: 'PG regression probe.' },
        {}
      );

      expect(returnedKey).toBe(key);

      const row = await db('app_settings').where({ key }).first();
      expect(row).toMatchObject({ key, value: 'probe' });
    } finally {
      await db('audit_logs').where({ entity_type: 'setting', entity_id: key }).del();
      await db('app_settings').where({ key }).del();
    }
  });
});

describe.skipIf(isPg)('createAuditedRepository().insert() against Postgres (skipped)', () => {
  it('documents why this file has no coverage under the standard sqlite-backed test run', () => {
    // No assertion needed — describe.skipIf above already skips the real
    // tests. This one visible, always-passing test exists so `npm test`'s
    // output shows this file was *seen*, not silently absent, with a
    // pointer to how to actually run the Postgres-specific coverage.
    expect(
      'Run `DB_CLIENT=pg npx vitest run src/tests/auditedRepository.pg.test.js` against a real Postgres database to exercise this file.'
    ).toBeTruthy();
  });
});
