/**
 * Adds an `is_system` flag to `permissions`, marking the base RBAC
 * permissions directly referenced in code (`roles:manage`, `users:read`,
 * `users:write`, `users:delete` — see middleware/authorize.js call sites)
 * as un-deletable. Module-declared permissions (products:*, sales:*, ...)
 * default to `false`: they're freely grantable/revocable per role, and
 * nothing in code hardcodes a dependency on any one of them existing.
 *
 * For a fresh database this backfill is a no-op (permissions don't exist
 * yet at migration time — db/seeds/00_roles_permissions.js sets
 * is_system: true directly when it inserts these four rows); it only
 * matters for a database that already ran the seed before this column
 * existed.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  await knex.schema.alterTable('permissions', (table) => {
    table.boolean('is_system').notNullable().defaultTo(false);
  });

  await knex('permissions')
    .whereIn('key', ['roles:manage', 'users:read', 'users:write', 'users:delete'])
    .update({ is_system: true });
}

// See the matching note in 20260805010000_..._roles_table.js — PRAGMA
// foreign_keys is a no-op inside a transaction in SQLite.
export const config = { transaction: false };

/**
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  // See the matching note in 20260805010000_..._roles_table.js — SQLite's
  // DROP COLUMN rebuild trips over role_permissions' FK to `permissions`
  // unless enforcement is briefly disabled for the rebuild.
  await knex.raw('PRAGMA foreign_keys = OFF');
  await knex.schema.alterTable('permissions', (table) => {
    table.dropColumn('is_system');
  });
  await knex.raw('PRAGMA foreign_keys = ON');
}
