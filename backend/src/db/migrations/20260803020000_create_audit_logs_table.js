/**
 * Generic audit trail — not user-specific in schema (entity_type/entity_id
 * so it could log changes to any entity later), even though the Users
 * module is the first consumer (its detail page's Activity log).
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.string('entity_type', 50).notNullable();
    table.integer('entity_id').unsigned().notNullable();
    table.string('action', 50).notNullable();
    // JSON-encoded { field: { from, to } } — never contains secrets
    // (password changes are logged as an action with no field diff).
    table.text('changes').nullable();
    table
      .integer('actor_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['entity_type', 'entity_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('audit_logs');
}
