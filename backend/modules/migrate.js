import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db } from '#db/knex.js';

/**
 * Migration/seed runner for feature modules (see modules/index.js for the
 * general architecture). Each module's migrations/ and seeds/ directories
 * are run against the SAME database connection as the core app, but with
 * an isolated `knex_migrations_<key>` tracking table per module — so
 * adding, removing, or rolling back one module never touches src/db's own
 * migration history or another module's.
 *
 * Wired into `npm run migrate` / `migrate:rollback` / `seed` (package.json)
 * so a single command still sets up the whole app; also imported directly
 * by tests that need to reset module tables between suites.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function discoverModuleDirs() {
  return readdirSync(__dirname, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(__dirname, name, 'config.js')))
    .sort()
    .map((name) => path.join(__dirname, name));
}

async function loadConfig(dir) {
  const { default: config } = await import(pathToFileURL(path.join(dir, 'config.js')).href);
  return config;
}

export async function migrateModules() {
  for (const dir of discoverModuleDirs()) {
    const migrationsDir = path.join(dir, 'migrations');
    if (!existsSync(migrationsDir)) continue;
    const config = await loadConfig(dir);
    await db.migrate.latest({ directory: migrationsDir, tableName: `knex_migrations_${config.key}` });
  }
}

export async function rollbackModules() {
  for (const dir of discoverModuleDirs().reverse()) {
    const migrationsDir = path.join(dir, 'migrations');
    if (!existsSync(migrationsDir)) continue;
    const config = await loadConfig(dir);
    await db.migrate.rollback({ directory: migrationsDir, tableName: `knex_migrations_${config.key}` }, true);
  }
}

export async function seedModules() {
  for (const dir of discoverModuleDirs()) {
    const seedsDir = path.join(dir, 'seeds');
    if (!existsSync(seedsDir)) continue;
    await db.seed.run({ directory: seedsDir });
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const actions = { migrate: migrateModules, rollback: rollbackModules, seed: seedModules };
  const action = actions[process.argv[2]];
  if (!action) {
    console.error('Usage: node modules/migrate.js <migrate|rollback|seed>');
    process.exit(1);
  }
  await action();
  await db.destroy();
}
