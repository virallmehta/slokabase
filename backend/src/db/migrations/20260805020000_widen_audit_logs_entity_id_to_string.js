/**
 * entity_id was integer-only, which fit Users/Roles but not every entity a
 * module might audit (e.g. Settings is keyed by a string `key`). Widening
 * to string lets any module's primary key shape (numeric or not) flow
 * through createAuditedRepository without a special case.
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.alterTable('audit_logs', (table) => {
    table.string('entity_id', 100).notNullable().alter();
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.alterTable('audit_logs', (table) => {
    table.integer('entity_id').unsigned().notNullable().alter();
  });
}
