import { db } from '#db/knex.js';

export const auditLogRepository = {
  /**
   * `changes` is a plain object of { field: { from, to } } — pass `null`
   * for actions with no meaningful field diff (e.g. a password change,
   * which must never be logged with actual values).
   */
  // `entity_id` is a TEXT-affinity column (see the 20260805020000
  // migration) so any entity id — numeric or string-keyed, like Settings'
  // `key` — can be logged; a raw JS number must be stringified first, or
  // SQLite stores it float-formatted ("2.0") instead of "2".
  record: ({ entityType, entityId, action, changes = null, actorId = null }) =>
    db('audit_logs').insert({
      entity_type: entityType,
      entity_id: String(entityId),
      action,
      changes: changes ? JSON.stringify(changes) : null,
      actor_id: actorId,
    }),

  listFor: async (entityType, entityId) => {
    const rows = await db('audit_logs')
      .leftJoin('users', 'users.id', 'audit_logs.actor_id')
      .where({ entity_type: entityType, entity_id: entityId })
      .select(
        'audit_logs.id',
        'audit_logs.action',
        'audit_logs.changes',
        'audit_logs.created_at',
        'audit_logs.actor_id',
        'users.name as actor_name'
      )
      .orderBy('audit_logs.created_at', 'desc');

    return rows.map((row) => ({
      ...row,
      changes: row.changes ? JSON.parse(row.changes) : null,
    }));
  },

  // Global, filterable view across every entity type any module has ever
  // logged against — this is what the System Audit Log module (see
  // backend/modules/auditLog/) reads. Kept here rather than in that module
  // because `audit_logs` is core, cross-module state (Users and Roles both
  // write to it via this same repository), not something owned by one
  // module — mirrors how roleRepository (core) predates and is reused by
  // the Roles module for the same reason.
  listAll: async ({
    search,
    actorId,
    entityType,
    action,
    dateFrom,
    dateTo,
    page = 1,
    limit = 25,
  } = {}) => {
    const baseQuery = db('audit_logs').leftJoin('users', 'users.id', 'audit_logs.actor_id');

    // `search` matches actor name (substring, case-insensitive) — entity
    // type and action already have dedicated filters, so this is the one
    // free-text dimension worth searching (mirrors userRepository.list's
    // `search`/whereILike convention).
    if (search) baseQuery.whereILike('users.name', `%${search}%`);
    if (actorId) baseQuery.where('audit_logs.actor_id', actorId);
    if (entityType) baseQuery.where('audit_logs.entity_type', entityType);
    if (action) baseQuery.where('audit_logs.action', action);
    if (dateFrom) baseQuery.where('audit_logs.created_at', '>=', dateFrom);
    if (dateTo) baseQuery.where('audit_logs.created_at', '<=', dateTo);

    const countRow = await baseQuery.clone().count({ count: '*' }).first();

    const rows = await baseQuery
      .clone()
      .select(
        'audit_logs.id',
        'audit_logs.entity_type',
        'audit_logs.entity_id',
        'audit_logs.action',
        'audit_logs.changes',
        'audit_logs.created_at',
        'audit_logs.actor_id',
        'users.name as actor_name'
      )
      .orderBy('audit_logs.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      logs: rows.map((row) => ({ ...row, changes: row.changes ? JSON.parse(row.changes) : null })),
      total: Number(countRow.count),
      page,
      limit,
    };
  },

  // Powers the Audit Log page's Module/Action filter dropdowns with
  // whatever values have actually been logged, rather than a hardcoded
  // list that drifts out of sync as modules add new entity types/actions.
  listDistinctEntityTypes: () => db('audit_logs').distinct('entity_type').pluck('entity_type'),
  listDistinctActions: () => db('audit_logs').distinct('action').pluck('action'),
};
