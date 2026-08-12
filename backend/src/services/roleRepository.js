import { db } from '#db/knex.js';
import { createAuditedRepository } from '#services/auditedRepository.js';

const audited = createAuditedRepository('roles', 'role');

export const roleRepository = {
  // Lightweight list — powers the Users module's role filter/assignment
  // dropdown (GET /api/v1/roles). Keep this shape stable; the fuller
  // admin listing lives in listAllWithPermissionCounts below.
  listAll: () => db('roles').select('id', 'key', 'name').orderBy('id'),

  findByKey: (key) => db('roles').where({ key }).first(),

  findById: (id) => db('roles').where({ id }).first(),

  listPermissionKeys: (roleId) =>
    db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .where('role_permissions.role_id', roleId)
      .pluck('permissions.key'),

  // Same query as listPermissionKeys — kept as a separate name because
  // the Roles & Permissions admin controller (role.controller.js) reads
  // better calling it "granted" permissions for a specific role.
  listGrantedPermissionKeys: (roleId) => roleRepository.listPermissionKeys(roleId),

  // Full admin listing — powers the Roles & Permissions module's table
  // (GET /api/v1/admin/roles): every column plus a per-role granted-
  // permission count via a join. Distinct from listAll (the light
  // dropdown query) to avoid the two colliding under one name.
  listAllWithPermissionCounts: () =>
    db('roles')
      .select('roles.id', 'roles.key', 'roles.name', 'roles.description', 'roles.is_system')
      .count({ permissionCount: 'role_permissions.permission_id' })
      .leftJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .groupBy('roles.id', 'roles.key', 'roles.name', 'roles.description', 'roles.is_system')
      .orderBy('roles.id'),

  create: async ({ key, name, description = null }, { actorId, changes } = {}) => {
    const id = await audited.insert({ key, name, description, is_system: false }, { actorId, changes });
    return roleRepository.findById(id);
  },

  update: async (id, fields, { actorId, changes } = {}) => {
    await audited.update(id, fields, { actorId, changes });
    return roleRepository.findById(id);
  },

  remove: (id, { actorId, changes } = {}) => audited.del(id, { actorId, changes }),

  countUsersWithRole: async (roleId) => {
    const result = await db('users').where({ role_id: roleId }).count({ count: '*' }).first();
    return Number(result.count);
  },

  listAllPermissions: () =>
    db('permissions').select('id', 'key', 'description', 'is_system').orderBy('key'),

  // Replaces the role's entire permission set in one transaction rather
  // than diffing grants/revokes individually — simpler and just as safe
  // since role_permissions has no metadata beyond the (role_id, permission_id) pair.
  setPermissions: (roleId, permissionIds) =>
    db.transaction(async (trx) => {
      await trx('role_permissions').where({ role_id: roleId }).del();
      if (permissionIds.length > 0) {
        await trx('role_permissions').insert(
          permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId }))
        );
      }
    }),
};
