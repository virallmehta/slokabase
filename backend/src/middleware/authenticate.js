import { config } from '#config/env.js';
import { verifyAccessToken } from '#services/tokenService.js';
import { ApiError } from '#utils/ApiError.js';
import { asyncHandler } from '#utils/asyncHandler.js';

/**
 * Requires a valid access token cookie. Attaches `req.user = { id }` (from
 * the JWT payload — cheap, no DB hit) for downstream handlers. Role and
 * permissions are not in the token; `authorize()` fetches them from the DB
 * per-request. Controllers that need the full profile call
 * userRepository.findById themselves (see user.controller.js).
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[config.auth.accessCookieName];
  if (!token) throw ApiError.unauthorized('Not authenticated');

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    throw ApiError.unauthorized('Session expired or invalid');
  }
});
