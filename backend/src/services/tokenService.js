import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { config } from '#config/env.js';
import { db } from '#db/knex.js';

/** Signs a short-lived access token carrying the user's id and role. */
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.auth.accessSecret, {
    expiresIn: config.auth.accessExpiresIn,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.auth.accessSecret);
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function expiryDate(durationString) {
  // Supports simple "Nd"/"Nh"/"Nm" formats used in JWT_REFRESH_EXPIRES_IN.
  const match = /^(\d+)([dhm])$/.exec(durationString);
  const amount = match ? Number(match[1]) : 30;
  const unit = match ? match[2] : 'd';
  const ms = { d: 86400000, h: 3600000, m: 60000 }[unit] * amount;
  return new Date(Date.now() + ms);
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
