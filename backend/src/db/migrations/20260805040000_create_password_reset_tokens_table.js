/**
 * Only the SHA-256 hash of the reset token is stored (mirrors
 * refresh_tokens' token_hash pattern in tokenService.js) — the raw token
 * only ever exists in the reset email link and the request body, never at
 * rest. `used_at` marks a token consumed (one-time use, not deleted, so a
 * replayed link can be told apart from a token that never existed).
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('password_reset_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 255).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('password_reset_tokens');
}
