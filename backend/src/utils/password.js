import bcrypt from 'bcryptjs';
import { config } from '#config/env.js';

/** Hash a plaintext password with bcrypt. Never store or log plaintext passwords. */
export function hashPassword(plain) {
  return bcrypt.hash(plain, config.auth.bcryptSaltRounds);
}

/** Compare a plaintext password against a stored bcrypt hash. */
export function verifyPassword(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
