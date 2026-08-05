import { db } from '#db/knex.js';
import { migrateModules, rollbackModules, seedModules } from '#modules/migrate.js';

/**
 * Resets both the core (src/db) schema and every feature module's own
 * tables to a clean, fully-seeded state. Modules run against isolated
 * knex_migrations_<key> tracking tables (see modules/migrate.js), so they
 * need their own rollback/migrate calls alongside the core ones — a plain
 * `db.migrate.rollback(null, true)` only ever touches core migrations.
 * `seedModules()` runs each module's own seeds/ directory (e.g. Settings'
 * starter rows) — mirrors what `npm run seed` does outside tests.
 */
export async function resetDatabase() {
  await rollbackModules();
  await db.migrate.rollback(null, true);
  await db.migrate.latest();
  await migrateModules();
  await db.seed.run();
  await seedModules();
}
