import knexLib from 'knex';
import { config } from '#config/env.js';

/**
 * Builds a Knex connection config for whichever DB_CLIENT is configured.
 * This is the ONE file you'd touch to point the backend at a different
 * database — every migration, seed, and query in the app goes through
 * this same `db` instance and uses Knex's query builder, which is
 * client-agnostic (the same `.where()`/`.insert()` code works against
 * SQLite, MySQL, or Postgres).
 */
function buildConnection() {
  switch (config.db.client) {
    case 'sqlite3':
      return {
        client: 'better-sqlite3',
        useNullAsDefault: true,
        connection: { filename: config.db.sqliteFilename },
      };
    case 'mysql2':
      return {
        client: 'mysql2',
        connection: {
          host: config.db.host,
          port: config.db.port,
          user: config.db.user,
          password: config.db.password,
          database: config.db.name,
        },
        pool: { min: 2, max: 10 },
      };
    case 'pg':
      return {
        client: 'pg',
        connection: {
          host: config.db.host,
          port: config.db.port,
          user: config.db.user,
          password: config.db.password,
          database: config.db.name,
           ...(config.db.ssl && { ssl: { rejectUnauthorized: false } }),
        },
        pool: { min: 2, max: 10 },
      };
    default:
      throw new Error(`Unsupported DB_CLIENT "${config.db.client}". Use sqlite3, mysql2, or pg.`);
  }
}

export const knexConfig = {
  ...buildConnection(),
  migrations: { directory: new URL('./migrations', import.meta.url).pathname },
  seeds: { directory: new URL('./seeds', import.meta.url).pathname },
};

export const db = knexLib(knexConfig);
