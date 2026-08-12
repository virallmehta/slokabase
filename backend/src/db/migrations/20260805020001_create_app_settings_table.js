/**
 * Generic key-value store for app-wide settings — deliberately not rigid
 * columns (no `app_name`/`support_email`/... columns of their own), so a
 * new setting is a seed-data row, not a migration. `type` drives how
 * `value` (always stored as text) gets cast back on read (see
 * settingsRepository.js's `castValue`); `category` groups settings in the
 * admin UI (see src/db/seeds/02_settings.js for the starter set).
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('app_settings', (table) => {
    table.string('key', 100).primary();
    table.text('value').notNullable();
    table.string('type', 20).notNullable().defaultTo('string');
    table.string('category', 50).notNullable().defaultTo('General');
    table.string('description', 255).nullable();
    table
      .integer('updated_by')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('app_settings');
}
