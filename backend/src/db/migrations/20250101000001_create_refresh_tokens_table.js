/**
 * Refresh tokens are stored hashed (never in plaintext) so a database leak
 * alone doesn't let an attacker mint new sessions. Storing them also
 * enables rotation-with-reuse-detection: each refresh issues a new token
 * and invalidates the old one; if a already-used token is presented again,
 * every token in that family is revoked (a strong signal of token theft).
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('token_hash', 255).notNullable().unique();
    // Tokens issued from the same original login share a family id, so an
    // entire chain can be revoked at once on reuse detection.
    table.string('family_id', 36).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('revoked_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['family_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('refresh_tokens');
}
