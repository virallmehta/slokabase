import { config } from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';
import { userRepository } from '#services/userRepository.js';

/**
 * Defers identity to an existing WordPress install instead of maintaining
 * separate passwords in this app's DB. Requires the "JWT Authentication
 * for WP REST API" plugin (or an equivalent that exposes the same three
 * endpoints) active on the WordPress site.
 *
 * How it works: this backend acts as a gateway — it exchanges the user's
 * WP credentials for a WP JWT (server-to-server, never exposed to the
 * browser), fetches the WP user profile, and mirrors a matching row in
 * our own `users` table (so roles/permissions/joins work the same way
 * regardless of which provider is active). The frontend never talks to
 * WordPress directly and never sees the WP token.
 */
export const wordpressProvider = {
  // WordPress owns account creation (wp-admin or its own registration
  // flow) — this app doesn't create WP accounts.
  async register() {
    throw ApiError.badRequest(
      'Registration is managed by WordPress for this deployment. Create the account in wp-admin.'
    );
  },

  async login({ email, password }) {
    if (!config.wordpress.url) {
      throw ApiError.internal('WORDPRESS_URL is not configured');
    }

    // WP's JWT plugin authenticates by username, not necessarily email —
    // adjust this if your WP site logs in by email.
    const tokenRes = await fetch(`${config.wordpress.url}${config.wordpress.tokenPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });

    if (!tokenRes.ok) {
      throw ApiError.unauthorized('Invalid WordPress credentials');
    }
    const { token: wpToken } = await tokenRes.json();

    const meRes = await fetch(`${config.wordpress.url}${config.wordpress.userMePath}`, {
      headers: { Authorization: `Bearer ${wpToken}` },
    });
    if (!meRes.ok) throw ApiError.unauthorized('Could not fetch WordPress user profile');
    const wpUser = await meRes.json();

    // Mirror the WP identity into our own users table so downstream code
    // (roles, joins, other tables referencing user_id) works uniformly.
    let user = await userRepository.findByExternalId('wordpress', String(wpUser.id));
    if (!user) {
      user = await userRepository.create({
        name: wpUser.name,
        email: wpUser.email || email,
        authProvider: 'wordpress',
        externalId: String(wpUser.id),
        roleKey: wpUser.roles?.includes('administrator') ? 'admin' : 'member',
      });
    }

    return { user };
  },
};
