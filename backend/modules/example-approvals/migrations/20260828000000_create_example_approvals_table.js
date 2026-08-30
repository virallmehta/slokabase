/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('example_approvals', (table) => {
    table.increments('id').primary();
    table.string('title', 255).notNullable();
    table.string('state', 50).notNullable().defaultTo('draft');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('example_approvals');
}
