import { config } from '#config/env.js';
import { ApiError } from '#utils/ApiError.js';
import { userRepository } from '#services/userRepository.js';

/**
 * Defers identity to an existing Wagtail/Django backend. Wagtail itself
 * has no bundled JWT plugin the way WordPress does — this assumes the
 * Django backend exposes token auth via `djangorestframework-simplejwt`
 * (the common choice) at the paths configured in `.env`. If your Django
 * setup differs (DRF TokenAuthentication, session auth, a custom view),
 * adjust the two fetch calls below to match — the rest of this app
 * doesn't need to change.
 *
 * Same gateway pattern as the WordPress provider: this backend holds the
 * Django token server-side only, and mirrors the identity into our own
 * `users` table.
 */
export const wagtailProvider = {
  async register() {
    throw ApiError.badRequest(
      'Registration is managed by the Wagtail/Django backend for this deployment.'
    );
  },

  async login({ email, password }) {
    if (!config.wagtail.url) {
      throw ApiError.internal('WAGTAIL_URL is not configured');
    }

    const tokenRes = await fetch(`${config.wagtail.url}${config.wagtail.tokenPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // simplejwt's default TokenObtainPairView expects a USERNAME_FIELD
      // key (often "email" or "username" depending on your Django user
      // model) plus "password".
      body: JSON.stringify({ email, password }),
    });

    if (!tokenRes.ok) {
      throw ApiError.unauthorized('Invalid Wagtail/Django credentials');
    }
    const { access: djangoAccessToken } = await tokenRes.json();

    const meRes = await fetch(`${config.wagtail.url}${config.wagtail.userMePath}`, {
      headers: { Authorization: `Bearer ${djangoAccessToken}` },
    });
    if (!meRes.ok) throw ApiError.unauthorized('Could not fetch Wagtail/Django user profile');
    const djangoUser = await meRes.json();

    let user = await userRepository.findByExternalId('wagtail', String(djangoUser.id));
    if (!user) {
      user = await userRepository.create({
        name: djangoUser.name || djangoUser.username || email,
        email: djangoUser.email || email,
        authProvider: 'wagtail',
        externalId: String(djangoUser.id),
        role: djangoUser.is_staff || djangoUser.is_superuser ? 'admin' : 'user',
      });
    }

    return { user };
  },
};
