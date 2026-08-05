import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { config } from '#config/env.js';
import { db } from '#db/knex.js';

/**
 * Signs a short-lived access token carrying only the user's id. Role and
 * permissions are deliberately NOT embedded — they're fetched fresh from
 * the DB on every request (see middleware/authorize.js), so a role change
 * takes effect immediately instead of waiting up to accessExpiresIn.
 */
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, config.auth.accessSecret, {
    expiresIn: config.auth.accessExpiresIn,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.auth.accessSecret);
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Supports simple "Nd"/"Nh"/"Nm" formats used in JWT_ACCESS_EXPIRES_IN /
// JWT_REFRESH_EXPIRES_IN — also used by auth.controller.js/csrf.js to keep
// cookie maxAge in sync with the JWT's own expiry instead of defaulting to
// a browser-session cookie.
export function parseDurationMs(durationString) {
  const match = /^(\d+)([dhm])$/.exec(durationString);
  const amount = match ? Number(match[1]) : 30;
  const unit = match ? match[2] : 'd';
  return { d: 86400000, h: 3600000, m: 60000 }[unit] * amount;
}

function expiryDate(durationString) {
  return new Date(Date.now() + parseDurationMs(durationString));
}

/**
 * Issues a new refresh token, storing only its hash in the DB. `familyId`
 * links every token descended from the same original login so the whole
 * chain can be revoked together on reuse detection.
 */
export async function issueRefreshToken(userId, familyId = uuid()) {
  const token = crypto.randomBytes(48).toString('hex');
  await db('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    family_id: familyId,
    expires_at: expiryDate(config.auth.refreshExpiresIn),
  });
  return { token, familyId };
}

/**
 * Validates a presented refresh token and rotates it: the old one is
 * marked revoked, a new one is issued in the same family. If a token that
 * was ALREADY revoked is presented again, that's a strong signal of theft
 * (someone replayed a stolen token after the legitimate rotation already
 * happened) — the entire family is revoked and the caller must re-login.
 */
export async function rotateRefreshToken(presentedToken) {
  const tokenHash = hashToken(presentedToken);
  const record = await db('refresh_tokens').where({ token_hash: tokenHash }).first();

  if (!record) return { valid: false };

  if (record.revoked_at) {
    // Reuse of a revoked token — revoke the whole family defensively.
    await db('refresh_tokens').where({ family_id: record.family_id }).update({
      revoked_at: db.fn.now(),
    });
    return { valid: false, reason: 'reuse-detected' };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  await db('refresh_tokens').where({ id: record.id }).update({ revoked_at: db.fn.now() });
  const { token, familyId } = await issueRefreshToken(record.user_id, record.family_id);

  return { valid: true, userId: record.user_id, token, familyId };
}

export async function revokeRefreshToken(presentedToken) {
  const tokenHash = hashToken(presentedToken);
  await db('refresh_tokens').where({ token_hash: tokenHash }).update({ revoked_at: db.fn.now() });
}

export async function revokeAllUserSessions(userId) {
  await db('refresh_tokens').where({ user_id: userId, revoked_at: null }).update({
    revoked_at: db.fn.now(),
  });
}

/**
 * Issues a forgot-password reset token, storing only its hash (same
 * pattern as issueRefreshToken above) with a short expiry
 * (config.auth.passwordResetExpiresIn, default 1h). Any of the user's
 * still-usable previous reset tokens are invalidated first, so at most one
 * reset link is ever valid at a time — an old, un-clicked email can't be
 * used after a newer forgot-password request superseded it.
 */
export async function issuePasswordResetToken(userId) {
  await db('password_reset_tokens')
    .where({ user_id: userId, used_at: null })
    .update({ used_at: db.fn.now() });

  const token = crypto.randomBytes(32).toString('hex');
  await db('password_reset_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiryDate(config.auth.passwordResetExpiresIn),
  });
  return token;
}

/**
 * Validates a presented reset token and, if valid, marks it used in the
 * same call — a token is single-use regardless of whether the caller goes
 * on to actually change the password. Mirrors rotateRefreshToken's
 * { valid, reason } shape.
 */
export async function consumePasswordResetToken(presentedToken) {
  const tokenHash = hashToken(presentedToken);
  const record = await db('password_reset_tokens').where({ token_hash: tokenHash }).first();

  if (!record) return { valid: false, reason: 'not-found' };
  if (record.used_at) return { valid: false, reason: 'used' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, reason: 'expired' };

  await db('password_reset_tokens').where({ id: record.id }).update({ used_at: db.fn.now() });
  return { valid: true, userId: record.user_id };
}
