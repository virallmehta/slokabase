import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Scaffolds a migration file for a feature module, mirroring what
 * `knex migrate:make` does for core (src/db/migrations/) but targeting
 * modules/<module>/migrations/ instead — knex's own migrate:make is
 * hardcoded to knexfile.js's single `migrations.directory` (core only)
 * and has no concept of a per-module migrations folder.
 *
 * Usage: npm run module:migrate:make -- <module> <migration_name>
 * e.g.   npm run module:migrate:make -- example-products add_category_to_products
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.join(__dirname, '..', 'modules');

const [moduleName, migrationName] = process.argv.slice(2);

if (!moduleName || !migrationName) {
  console.error('Usage: npm run module:migrate:make -- <module> <migration_name>');
  process.exit(1);
}

const moduleDir = path.join(modulesDir, moduleName);

if (!existsSync(path.join(moduleDir, 'config.js'))) {
  console.error(`"${moduleName}" isn't a module directory under modules/ (expected modules/${moduleName}/config.js).`);
  process.exit(1);
}

const migrationsDir = path.join(moduleDir, 'migrations');
mkdirSync(migrationsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const fileName = `${timestamp}_${migrationName}.js`;
const filePath = path.join(migrationsDir, fileName);

const stub = `/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {

}

/**
 * @param { import("knex").Knex } knex
 */
export function down(knex) {

}
`;

writeFileSync(filePath, stub);
console.log(`Created modules/${moduleName}/migrations/${fileName}`);
