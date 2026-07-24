import 'dotenv/config';

/**
 * Root-level knexfile so `npx knex migrate:latest` etc. work from the CLI
 * without extra flags. Mirrors src/db/knex.js's connection logic — kept as
 * plain env reads here (rather than importing src/config/env.js) so the
 * Knex CLI doesn't need Node's ESM subpath-imports resolution configured.
 */
function buildConnection() {
  const client = process.env.DB_CLIENT || 'sqlite3';

  switch (client) {
    case 'sqlite3':
      return {
        client: 'better-sqlite3',
        useNullAsDefault: true,
        connection: { filename: process.env.SQLITE_FILENAME || './data/dev.sqlite3' },
      };
    case 'mysql2':
      return {
        client: 'mysql2',
        connection: {
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT) || 3306,
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'app_db',
        },
      };
    case 'pg':
      return {
        client: 'pg',
        connection: {
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT) || 5432,
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'app_db',
        },
      };
    default:
      throw new Error(`Unsupported DB_CLIENT "${client}". Use sqlite3, mysql2, or pg.`);
  }
}

export default {
  ...buildConnection(),
  migrations: { directory: './src/db/migrations' },
  seeds: { directory: './src/db/seeds' },
};
