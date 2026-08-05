/**
 * Replaces the flat `role` string column with a `role_id` FK into `roles`.
 * The three starter roles are inserted here (not in a seed) because this
 * migration needs their ids to backfill existing users before the old
 * `role` column can be dropped — seeds run after all migrations, too late
 * for that. src/db/seeds/00_roles_permissions.js owns the *permissions*
 * and role -> permission mappings.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  await knex('roles').insert([
    { key: 'admin', name: 'Admin' },
    { key: 'manager', name: 'Manager' },
    { key: 'member', name: 'Member' },
  ]);
  const roleIdByKey = Object.fromEntries(
    (await knex('roles').select('id', 'key')).map((r) => [r.key, r.id])
  );

  await knex.schema.alterTable('users', (table) => {
    table.integer('role_id').unsigned().nullable().references('id').inTable('roles');
  });

  // Old default was the string 'user' (now 'member'); anything not
  // explicitly 'admin' maps to 'member'.
  const existingUsers = await knex('users').select('id', 'role');
  for (const user of existingUsers) {
    const roleId = user.role === 'admin' ? roleIdByKey.admin : roleIdByKey.member;
    await knex('users').where({ id: user.id }).update({ role_id: roleId });
  }

  await knex.schema.alterTable('users', (table) => {
    table.integer('role_id').unsigned().notNullable().alter();
    table.dropColumn('role');
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('role', 50).notNullable().defaultTo('user');
  });

  const users = await knex('users')
    .join('roles', 'roles.id', 'users.role_id')
    .select('users.id', 'roles.key as roleKey');
  for (const user of users) {
    await knex('users')
      .where({ id: user.id })
      .update({ role: user.roleKey === 'admin' ? 'admin' : 'user' });
  }

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('role_id');
  });
}
