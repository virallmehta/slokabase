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
    insert: async (data, { actorId = null, changes = null } = {}) => {
      const [id] = await db(tableName).insert(data);
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
