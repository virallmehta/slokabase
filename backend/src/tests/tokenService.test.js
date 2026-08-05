import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '#db/knex.js';
import {
  issuePasswordResetToken,
  consumePasswordResetToken,
} from '#services/tokenService.js';
import { resetDatabase } from './testDb.js';

// Unit-level tests against tokenService directly (no HTTP layer) — see
// auth.test.js for the API-level forgot/reset-password coverage. These
// focus on the reset-token generation/expiry/consumption logic itself.
describe('tokenService — password reset tokens', () => {
  let userId;

  beforeEach(async () => {
    await resetDatabase();
    const admin = await db('users').where({ email: 'admin@example.com' }).first();
    userId = admin.id;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('issuePasswordResetToken', () => {
    it('returns a long random raw token and stores only its hash, never the raw value', async () => {
      const token = await issuePasswordResetToken(userId);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThanOrEqual(48); // 32 random bytes, hex-encoded

      const row = await db('password_reset_tokens').where({ user_id: userId }).first();
      expect(row).toBeTruthy();
      expect(row.token_hash).not.toBe(token);
      expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex digest
    });

    it('sets expires_at roughly config.auth.passwordResetExpiresIn (default 1h) in the future', async () => {
      const before = Date.now();
      await issuePasswordResetToken(userId);
      const after = Date.now();

      const row = await db('password_reset_tokens').where({ user_id: userId }).first();
      const expiresAt = new Date(row.expires_at).getTime();

      expect(expiresAt).toBeGreaterThan(before + 59 * 60 * 1000);
      expect(expiresAt).toBeLessThan(after + 61 * 60 * 1000);
    });

    it('invalidates any previously issued, still-usable token for the same user', async () => {
      const first = await issuePasswordResetToken(userId);
      await issuePasswordResetToken(userId);

      const firstResult = await consumePasswordResetToken(first);
      expect(firstResult).toEqual({ valid: false, reason: 'used' });
    });

    it('does not touch another user\'s existing valid token', async () => {
      const [otherUser] = await db('users').insert({
        name: 'Other User',
        email: 'other-token-user@example.com',
        password_hash: 'irrelevant',
        role_id: (await db('roles').where({ key: 'member' }).first()).id,
      });

      const otherToken = await issuePasswordResetToken(otherUser);
      await issuePasswordResetToken(userId);

      const otherRow = await db('password_reset_tokens').where({ user_id: otherUser }).first();
      expect(otherRow.used_at).toBeNull();

      const result = await consumePasswordResetToken(otherToken);
      expect(result.valid).toBe(true);
    });
  });

  describe('consumePasswordResetToken', () => {
    it('accepts a valid, unexpired, unused token and returns the owning userId', async () => {
      const token = await issuePasswordResetToken(userId);
      const result = await consumePasswordResetToken(token);
      expect(result).toEqual({ valid: true, userId });
    });

    it('is single-use — a second consumption of the same token fails', async () => {
      const token = await issuePasswordResetToken(userId);
      await consumePasswordResetToken(token);

      const second = await consumePasswordResetToken(token);
      expect(second).toEqual({ valid: false, reason: 'used' });
    });

    it('rejects a token that was never issued', async () => {
      const result = await consumePasswordResetToken('not-a-real-token');
      expect(result).toEqual({ valid: false, reason: 'not-found' });
    });

    it('rejects an expired token without consuming it', async () => {
      const token = await issuePasswordResetToken(userId);
      await db('password_reset_tokens')
        .where({ user_id: userId })
        .update({ expires_at: new Date(Date.now() - 1000) });

      const result = await consumePasswordResetToken(token);
      expect(result).toEqual({ valid: false, reason: 'expired' });

      // Still not marked used — an expired token is rejected, not silently consumed.
      const row = await db('password_reset_tokens').where({ user_id: userId }).first();
      expect(row.used_at).toBeNull();
    });
  });
});
