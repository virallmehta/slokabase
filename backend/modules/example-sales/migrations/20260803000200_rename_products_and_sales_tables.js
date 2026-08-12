/**
 * Renames the products/sales demo tables to example_products/example_sales
 * to match the modules/example-products//example-sales/ rename. Lives here
 * (in example-sales' own migration history, not example-products') because
 * modules/migrate.js runs each module's ENTIRE migration history to
 * completion before starting the next module's (alphabetical dir order:
 * example-products, then example-sales) — by the time this file runs,
 * both create-table migrations (products in example-products' history,
 * sales in example-sales' own history just before this one) have already
 * completed, so both tables safely exist to rename. Doing the rename
 * inside example-products' own history instead would rename `products`
 * away before example-sales' create_sales_table migration (which still
 * references `products` by name for its FK) gets a chance to run.
 *
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
  return knex.schema
    .renameTable('products', 'example_products')
    .then(() => knex.schema.renameTable('sales', 'example_sales'));
}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {
  return knex.schema
    .renameTable('example_sales', 'sales')
    .then(() => knex.schema.renameTable('example_products', 'products'));
}
