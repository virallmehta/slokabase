import modules from '#modules/index.js';

/**
 * Idempotently ensures the starter roles exist (normally already present
 * from the add_role_id_to_users_table migration — this only matters if
 * that table were ever truncated), then seeds the starter permission set
 * and role -> permission mappings.
 *
 * Feature modules (backend/modules/<name>/config.js) each register their
 * own `permissions` array and a `rolePermissions` map saying which of the
 * core roles (admin/manager/member) get which of those permissions —
 * modules only grant onto the existing role set, they never define new
 * roles. Both are merged in here alongside the base RBAC permissions, so a
 * new module's permissions get seeded automatically with no edits needed
 * to this file.
 *
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
  const roles = [
    { key: 'admin', name: 'Admin' },
    { key: 'manager', name: 'Manager' },
    { key: 'member', name: 'Member' },
  ];
  for (const role of roles) {
    const existing = await knex('roles').where({ key: role.key }).first();
    if (!existing) await knex('roles').insert(role);
  }

  const basePermissions = [
    { key: 'users:read', description: 'View other users', is_system: true },
    { key: 'users:write', description: 'Edit other users', is_system: true },
    { key: 'users:delete', description: 'Delete users', is_system: true },
    { key: 'roles:manage', description: 'Manage roles and permissions', is_system: true },
  ];
  const baseRolePermissions = {
    admin: ['users:read', 'users:write', 'users:delete', 'roles:manage'],
    manager: ['users:read', 'users:write'],
    member: [],
  };

  const permissions = [...basePermissions, ...modules.flatMap((mod) => mod.permissions || [])];

  const rolePermissions = {
    admin: [...baseRolePermissions.admin],
    manager: [...baseRolePermissions.manager],
    member: [...baseRolePermissions.member],
  };
  for (const mod of modules) {
    for (const [roleKey, permissionKeys] of Object.entries(mod.rolePermissions || {})) {
      rolePermissions[roleKey] = [...(rolePermissions[roleKey] || []), ...permissionKeys];
    }
  }

  for (const permission of permissions) {
    const existing = await knex('permissions').where({ key: permission.key }).first();
    if (!existing) await knex('permissions').insert(permission);
  }

  const roleIdByKey = Object.fromEntries(
    (await knex('roles').select('id', 'key')).map((r) => [r.key, r.id])
  );
  const permissionIdByKey = Object.fromEntries(
    (await knex('permissions').select('id', 'key')).map((p) => [p.key, p.id])
  );

  for (const [roleKey, permissionKeys] of Object.entries(rolePermissions)) {
    for (const permissionKey of permissionKeys) {
      const roleId = roleIdByKey[roleKey];
      const permissionId = permissionIdByKey[permissionKey];
      const existing = await knex('role_permissions')
        .where({ role_id: roleId, permission_id: permissionId })
        .first();
      if (!existing) await knex('role_permissions').insert({ role_id: roleId, permission_id: permissionId });
    }
  }
}
