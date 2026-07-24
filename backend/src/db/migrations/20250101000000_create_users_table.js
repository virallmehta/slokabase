/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    // Null when the account was created via an external provider
    // (WordPress/Wagtail) rather than local email+password.
    table.string('password_hash', 255).nullable();
    // Simple RBAC: a single role per user is enough for most apps. See
    // src/middleware/authorize.js for how this is enforced, and the
    // README for how to extend this to a full roles/permissions table.
    table.string('role', 50).notNullable().defaultTo('user');
    // Which auth provider owns this identity — useful when AUTH_PROVIDER
    // support for multiple providers is enabled, or during a migration
    // between providers.
    table.string('auth_provider', 50).notNullable().defaultTo('local');
    // The user's id/username on the external provider (WP user ID, etc.)
    table.string('external_id', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['email']);
    table.index(['auth_provider', 'external_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('users');
}
