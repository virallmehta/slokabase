/**
 * Upgrade path for the roles:manage -> roles:read + roles:manage and
 * settings:manage -> settings:read + settings:manage split. Before that
 * split, holding *:manage was enough to see the Roles/Settings admin
 * sections; the GET routes now gate on *:read specifically (no implication
 * hierarchy), so any pre-existing custom role that already held *:manage
 * would silently lose list/view access without this backfill. Grants the
 * matching *:read permission to every role that already has *:manage and
 * doesn't already hold *:read.
 *
 * Safe to run even if the roles:read/settings:read permission rows or the
 * roles holding roles:manage/settings:manage don't exist yet (e.g. a brand
 * new install where 00_roles_permissions.js's seed hasn't run) — every
 * step below is a no-op in that case.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  await backfillReadPermission(knex, 'roles');
  await backfillReadPermission(knex, 'settings');
}

/**
 * @param { import("knex").Knex } knex
 * @param {string} resource - 'roles' or 'settings'
 */
async function backfillReadPermission(knex, resource) {
  const managePermission = await knex('permissions').where({ key: `${resource}:manage` }).first();
  const readPermission = await knex('permissions').where({ key: `${resource}:read` }).first();
  if (!managePermission || !readPermission) return;

  const roleIdsWithManage = (
    await knex('role_permissions').where({ permission_id: managePermission.id }).select('role_id')
  ).map((row) => row.role_id);

  const roleIdsWithRead = new Set(
    (
      await knex('role_permissions').where({ permission_id: readPermission.id }).select('role_id')
    ).map((row) => row.role_id)
  );

  const rowsToInsert = roleIdsWithManage
    .filter((roleId) => !roleIdsWithRead.has(roleId))
    .map((roleId) => ({ role_id: roleId, permission_id: readPermission.id }));

  if (rowsToInsert.length > 0) {
    await knex('role_permissions').insert(rowsToInsert);
  }
}

/**
 * No-op-safe rollback: only removes the exact roles:read/settings:read
 * grants this migration's up() would have added (i.e. grants held
 * alongside the corresponding *:manage permission), not every *:read
 * grant a role might hold independently.
 *
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  await revertReadPermission(knex, 'roles');
  await revertReadPermission(knex, 'settings');
}

/**
 * @param { import("knex").Knex } knex
 * @param {string} resource - 'roles' or 'settings'
 */
async function revertReadPermission(knex, resource) {
  const managePermission = await knex('permissions').where({ key: `${resource}:manage` }).first();
  const readPermission = await knex('permissions').where({ key: `${resource}:read` }).first();
  if (!managePermission || !readPermission) return;

  const roleIdsWithManage = (
    await knex('role_permissions').where({ permission_id: managePermission.id }).select('role_id')
  ).map((row) => row.role_id);

  if (roleIdsWithManage.length > 0) {
    await knex('role_permissions')
      .where({ permission_id: readPermission.id })
      .whereIn('role_id', roleIdsWithManage)
      .del();
  }
}
