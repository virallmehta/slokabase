import nodemailer from 'nodemailer';
import { config } from '#config/env.js';
import { settingsRepository } from '#services/settingsRepository.js';

/**
 * Provider-agnostic email sending. Every other service (auth, admin user
 * creation, ...) calls `sendEmail({ to, subject, html, text })` and never
 * touches nodemailer or SMTP details directly.
 *
 * SMTP config is a soft setting layered over the EMAIL_* env vars (see
 * backend/CLAUDE.md's "Hard config vs. soft setting vs. plain constant"
 * section): a non-empty/non-zero value in the `smtp_*` app_settings rows
 * wins, otherwise the matching EMAIL_* env var is used. This means the
 * transporter can't be created once and cached like it used to be —
 * settings can change at runtime via the admin UI, so it's rebuilt from
 * the merged config on every call instead. `settingsRepository` already
 * caches its own reads (invalidated on every write), so this isn't a
 * real per-email DB hit in the common case.
 */
let testTransporter;

// Test-only escape hatch — nodemailer's built-in JSON transport
// stringifies the message instead of opening a real SMTP connection, so
// test runs don't depend on Mailpit (or anything else) actually running,
// and don't need settings/DB state to build a transporter at all.
function getTestTransporter() {
  if (!testTransporter) testTransporter = nodemailer.createTransport({ jsonTransport: true });
  return testTransporter;
}

// Exported so the settings controller's "Send test email" action can
// report exactly which values it's about to use without duplicating this
// merge logic.
export async function getEmailConfig() {
  const [host, port, secure, username, password, from] = await Promise.all([
    settingsRepository.get('smtp_host'),
    settingsRepository.get('smtp_port'),
    settingsRepository.get('smtp_secure'),
    settingsRepository.get('smtp_username'),
    settingsRepository.get('smtp_password'),
    settingsRepository.get('smtp_from'),
  ]);

  return {
    host: host || config.email.host,
    // 0 (the seeded default) means "not configured" — fall back to env,
    // same as an empty string does for the string fields below.
    port: port || config.email.port,
    // No "unset" state for a boolean setting — once seeded it's always
    // present, so the DB value is authoritative here rather than falling
    // back per-call (see db/seeds/02_settings.js's comment on smtp_secure).
    secure: typeof secure === 'boolean' ? secure : config.email.secure,
    user: username || config.email.user,
    password: password || config.email.password,
    from: from || config.email.from,
  };
}

function buildTransporter(emailConfig) {
  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    // Mailpit needs no credentials — only set `auth` when one is configured,
    // since nodemailer treats a present-but-empty auth object as a real
    // (failing) auth attempt with most SMTP servers.
    ...(emailConfig.user ? { auth: { user: emailConfig.user, pass: emailConfig.password } } : {}),
  });
}

// Test-only capture of what's been "sent" via the JSON transport — mirrors
// settingsRepository's _invalidateCacheForTests escape hatch. Lets tests
// assert on email content (e.g. extracting a temporary password or reset
// link) without a real inbox to check.
const sentEmailsForTests = [];

export async function sendEmail({ to, subject, html, text }) {
  if (config.nodeEnv === 'test') {
    await getTestTransporter().sendMail({ from: config.email.from, to, subject, html, text });
    sentEmailsForTests.push({ to, subject, html, text });
    return;
  }

  const emailConfig = await getEmailConfig();
  await buildTransporter(emailConfig).sendMail({ from: emailConfig.from, to, subject, html, text });
}

export function _getSentEmailsForTests() {
  return sentEmailsForTests;
}

export function _clearSentEmailsForTests() {
  sentEmailsForTests.length = 0;
}
