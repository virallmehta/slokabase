import { db } from '#db/knex.js';

export const roleRepository = {
  findByKey: (key) => db('roles').where({ key }).first(),

  listAll: () => db('roles').select('id', 'key', 'name').orderBy('id'),

  listPermissionKeys: (roleId) =>
    db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .where('role_permissions.role_id', roleId)
      .pluck('permissions.key'),
};
