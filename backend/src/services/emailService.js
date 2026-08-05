import nodemailer from 'nodemailer';
import { config } from '#config/env.js';

/**
 * Provider-agnostic email sending. Every other service (auth, admin user
 * creation, ...) calls `sendEmail({ to, subject, html, text })` and never
 * touches nodemailer or SMTP details directly — swapping from Mailpit to a
 * real provider (Resend, Brevo, SES, ...) later is just changing the
 * EMAIL_* env vars in `.env`, not any calling code.
 *
 * The transporter is created once and reused across calls (nodemailer
 * pools/reuses the underlying SMTP connection itself).
 */
let transporter;

function getTransporter() {
  if (transporter) return transporter;

  // In tests, nodemailer's built-in JSON transport stringifies the
  // message instead of opening a real SMTP connection — so test runs
  // don't depend on Mailpit (or anything else) actually running.
  if (config.nodeEnv === 'test') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    // Mailpit needs no credentials — only set `auth` when one is configured,
    // since nodemailer treats a present-but-empty auth object as a real
    // (failing) auth attempt with most SMTP servers.
    ...(config.email.user ? { auth: { user: config.email.user, pass: config.email.password } } : {}),
  });
  return transporter;
}

// Test-only capture of what's been "sent" via the JSON transport — mirrors
// settingsRepository's _invalidateCacheForTests escape hatch. Lets tests
// assert on email content (e.g. extracting a temporary password or reset
// link) without a real inbox to check.
const sentEmailsForTests = [];

export async function sendEmail({ to, subject, html, text }) {
  await getTransporter().sendMail({ from: config.email.from, to, subject, html, text });
  if (config.nodeEnv === 'test') sentEmailsForTests.push({ to, subject, html, text });
}

export function _getSentEmailsForTests() {
  return sentEmailsForTests;
}

export function _clearSentEmailsForTests() {
  sentEmailsForTests.length = 0;
}
