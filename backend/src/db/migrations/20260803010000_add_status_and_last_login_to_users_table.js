/**
 * Adds the two columns the admin Users module needs that didn't exist
 * yet: `status` (active/suspended — enforced at login, see
 * auth.controller.js) and `last_login_at` (set on every successful
 * login, see userRepository.touchLastLogin).
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.string('status', 20).notNullable().defaultTo('active');
    table.timestamp('last_login_at').nullable();
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('status');
    table.dropColumn('last_login_at');
  });
}
