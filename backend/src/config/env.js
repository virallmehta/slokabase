import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isTest = process.env.NODE_ENV === 'test'; // Check if Vitest is running

export const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    db: {
      client: process.env.DB_CLIENT || 'sqlite3',
      // sqliteFilename: process.env.SQLITE_FILENAME || './data/dev.sqlite3',
      // If running tests, use a separate test file so dev data stays perfectly safe!
      sqliteFilename: isTest ? './data/test.sqlite3' : (process.env.SQLITE_FILENAME || './data/dev.sqlite3'),
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME || 'app_db',
    },

    auth: {
        provider: process.env.AUTH_PROVIDER || 'local',
        accessSecret: required('JWT_ACCESS_SECRET', 'dev-only-insecure-secret-change-me'),
        refreshSecret: required('JWT_REFRESH_SECRET', 'dev-only-insecure-secret-change-me-2'),
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
        accessCookieName: process.env.ACCESS_COOKIE_NAME || 'access_token',
        refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'refresh_token',
        csrfCookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
        bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
    },
};

export default config;