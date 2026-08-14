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
      // Force sqlite3 for tests — they need an isolated, synchronous database
      // with no external dependencies (like a PostgreSQL server). In development
      // and production, respect DB_CLIENT from the environment (see .env).
      client: isTest ? 'sqlite3' : (process.env.DB_CLIENT || 'sqlite3'),
      // sqliteFilename: process.env.SQLITE_FILENAME || './data/dev.sqlite3',
      // If running tests, use a separate test file so dev data stays perfectly safe!
      sqliteFilename: isTest ? './data/test.sqlite3' : (process.env.SQLITE_FILENAME || './data/dev.sqlite3'),
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME || 'app_db',
      ssl: process.env.DB_SSL === 'true',   // ← add this line

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
        passwordResetExpiresIn: process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN || '1h',
    },

    rateLimit: {
      authWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    },

    email: {
      // Defaults target Mailpit (https://mailpit.axllent.org/) running
      // locally with `mailpit` or `docker run -p 1025:1025 -p 8025:8025
      // axllent/mailpit` — no auth needed, view sent mail at
      // http://localhost:8025. Swapping to a real provider (Resend,
      // Brevo, SES, ...) later is just setting these env vars to that
      // provider's SMTP credentials — emailService.js itself never
      // changes.
      host: process.env.EMAIL_HOST || 'localhost',
      port: Number(process.env.EMAIL_PORT) || 1025,
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER || undefined,
      password: process.env.EMAIL_PASSWORD || undefined,
      from: process.env.EMAIL_FROM || 'Slokabase <no-reply@slokabase.local>',
    },
};

export default config;