import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Runtime module registry — plug-and-play modular architecture.
 *
 * Each subdirectory here (e.g. `example-products/`, `example-sales/`) is a
 * fully self-contained feature module: its own config.js (key, basePath,
 * permissions, rolePermissions, menu), migrations/, repository, controller,
 * validators, and routes. Nothing in src/db or app.js needs to be touched
 * to add or remove one — app.js loops this registry to mount routes,
 * src/db/seeds/00_roles_permissions.js loops it to seed permissions, and
 * src/controllers/menu.controller.js loops it to build the menu tree.
 *
 * Migrations are handled separately by modules/migrate.js (each module's
 * migrations run against their own knex_migrations_<key> tracking table,
 * kept isolated from the core src/db migrations).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const moduleDirs = readdirSync(__dirname, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(path.join(__dirname, name, 'config.js')))
  .sort();

const modules = await Promise.all(
  moduleDirs.map(async (name) => {
    const dir = path.join(__dirname, name);
    const { default: config } = await import(pathToFileURL(path.join(dir, 'config.js')).href);
    const { default: routes } = await import(pathToFileURL(path.join(dir, 'routes.js')).href);
    return { ...config, routes };
  })
);

export default modules;
