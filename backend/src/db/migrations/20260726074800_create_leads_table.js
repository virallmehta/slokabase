/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
    return knex.schema.createTable('leads', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('email').unique().notNullable();
        table.timestamps(true, true);
    });
  
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('leads');
}
