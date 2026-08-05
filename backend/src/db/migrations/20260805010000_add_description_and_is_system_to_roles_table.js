/**
 * Adds a free-text `description` and an `is_system` flag to `roles`, so
 * the Roles & Permissions module can support custom roles alongside the
 * three starter ones. `is_system` marks admin/manager/member as
 * un-renameable/un-deletable — enforced in modules/roles/controller.js
 * regardless of what the frontend sends, not just hidden client-side.
 *
 * The three starter roles already exist by this point (inserted directly
 * by 20260802120300_add_role_id_to_users_table.js, before seeds run), so
 * this migration backfills them here rather than in the seed script.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  await knex.schema.alterTable('roles', (table) => {
    table.string('description', 255).nullable();
    table.boolean('is_system').notNullable().defaultTo(false);
  });

  await knex('roles').whereIn('key', ['admin', 'manager', 'member']).update({ is_system: true });
}

// PRAGMA foreign_keys is a no-op inside a transaction in SQLite, so the
// down() migration below needs to run outside knex's default per-migration
// transaction wrapper for the toggle to actually take effect.
export const config = { transaction: false };

/**
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  // SQLite's ALTER TABLE DROP COLUMN rebuilds the whole table under the
  // hood; with foreign_keys enforcement on, that rebuild trips over
  // role_permissions/users still referencing `roles` mid-rebuild. Not an
  // issue for `up()` (ADD COLUMN doesn't rebuild), only for this rollback.
  await knex.raw('PRAGMA foreign_keys = OFF');
  await knex.schema.alterTable('roles', (table) => {
    table.dropColumn('description');
    table.dropColumn('is_system');
  });
  await knex.raw('PRAGMA foreign_keys = ON');
}
