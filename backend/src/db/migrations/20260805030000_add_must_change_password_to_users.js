/**
 * Set on admin-created users (they get a system-generated temporary
 * password) so the app can force a change on first login. Cleared by
 * userController.changePassword once the user sets their own password.
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.boolean('must_change_password').notNullable().defaultTo(false);
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('must_change_password');
  });
}
