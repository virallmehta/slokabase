import { config } from '#config/env.js';
import { localProvider } from '#services/authProviders/localProvider.js';
import { wordpressProvider } from '#services/authProviders/wordpressProvider.js';
import { wagtailProvider } from '#services/authProviders/wagtailProvider.js';

const PROVIDERS = {
  local: localProvider,
  wordpress: wordpressProvider,
  wagtail: wagtailProvider,
};

/**
 * Selects the active identity provider based on AUTH_PROVIDER in .env.
 * Every provider implements the same `{ register, login }` shape
 * returning `{ user }` with our own internal user row — the rest of the
 * app (controllers, JWT issuance, RBAC) never needs to know or care which
 * provider is active.
 */
export function getAuthProvider() {
  const provider = PROVIDERS[config.auth.provider];
  if (!provider) {
    throw new Error(
      `Unknown AUTH_PROVIDER "${config.auth.provider}". Use "local", "wordpress", or "wagtail".`
    );
  }
  return provider;
}
