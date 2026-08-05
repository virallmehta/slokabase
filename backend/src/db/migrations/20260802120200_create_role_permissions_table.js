/**
 * Join table linking roles to the permissions they grant. Composite
 * primary key (no surrogate id needed) — a role either has a permission
 * or it doesn't. Cascades on delete in both directions so removing a role
 * or a permission cleans up its mappings automatically.
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema.createTable('role_permissions', (table) => {
    table
      .integer('role_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table
      .integer('permission_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    table.primary(['role_id', 'permission_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('role_permissions');
}
