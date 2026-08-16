import { db } from '#db/knex.js';
import { auditLogRepository } from '#services/auditLogRepository.js';

/**
 * Wraps a table's create/update/delete mutations so every module gets audit
 * logging "for free" instead of calling auditLogRepository itself. Callers
 * still own their own diffing/redaction rules (e.g. which fields are
 * auditable, never logging a password) — they pass a `changes` object in,
 * this just persists it alongside the mutation.
 *
 * `insert`/`del` always record an entry (create/delete are unconditional
 * events); `update` only records when `changes` is a non-empty object, so a
 * no-op update (nothing actually changed) doesn't produce a log entry.
 */
export function createAuditedRepository(tableName, moduleName, { idColumn = 'id' } = {}) {
  return {
    // `.insert(data)` with no `.returning()` behaves differently per
    // driver: sqlite3/better-sqlite3 returns the new id directly as
    // `[id]` (which `const [id] = ...` used to rely on), but Postgres
    // returns a raw `QueryResult` object — NOT an array — so that
    // destructure throws "... is not iterable" on every single insert.
    // Passing `[idColumn]` as the second arg forces `.returning()` on
    // every driver that supports it (pg, sqlite3), which normalizes the
    // result to `[{ [idColumn]: id }]`. mysql2 doesn't support
    // `.returning()` at all — knex logs a warning and falls back to its
    // own `insertId`, giving `[id]` (a raw value, not a row object)
    // instead — so the id is only unwrapped from `inserted[idColumn]`
    // when `inserted` actually is an object.
    insert: async (data, { actorId = null, changes = null } = {}) => {
      const [inserted] = await db(tableName).insert(data, [idColumn]);
      const id = inserted && typeof inserted === 'object' ? inserted[idColumn] : inserted;
      await auditLogRepository.record({ entityType: moduleName, entityId: id, action: 'create', changes, actorId });
      return id;
    },

    update: async (id, fields, { actorId = null, changes = null } = {}) => {
      await db(tableName)
        .where({ [idColumn]: id })
        .update({ ...fields, updated_at: db.fn.now() });

      if (changes && Object.keys(changes).length > 0) {
        await auditLogRepository.record({ entityType: moduleName, entityId: id, action: 'update', changes, actorId });
      }
      return id;
    },

    del: async (id, { actorId = null, changes = null } = {}) => {
      await db(tableName)
        .where({ [idColumn]: id })
        .del();
      await auditLogRepository.record({ entityType: moduleName, entityId: id, action: 'delete', changes, actorId });
      return id;
    },
  };
}
