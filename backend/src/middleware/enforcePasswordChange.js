import { config } from '#config/env.js';
import { verifyAccessToken } from '#services/tokenService.js';
import { db } from '#db/knex.js';
import { ApiError } from '#utils/ApiError.js';
import { asyncHandler } from '#utils/asyncHandler.js';

// Reachable while must_change_password is true — just enough surface for
// the user to get out of the forced state (change their password, log
// out, or keep their session alive/read who they are) and nothing else.
// Exact method+path match against req.path, evaluated as mounted (i.e.
// the full API path, not relative to any router).
const ALLOWLIST = [
  { method: 'PATCH', path: '/api/v1/users/me/password' },
  { method: 'POST', path: '/api/v1/auth/logout' },
  { method: 'GET', path: '/api/v1/auth/me' },
  { method: 'POST', path: '/api/v1/auth/refresh' },
];

function isAllowed(req) {
  return ALLOWLIST.some((entry) => entry.method === req.method && entry.path === req.path);
}

/**
 * Global gate for the forced-password-change flow. Mounted once in app.js
 * (after cookie-parser, before the routers) rather than added to every
 * route's authenticate/authorize chain — so no existing or future route
 * has to remember to wire it in.
 *
 * Does its own lightweight token decode rather than depending on
 * `authenticate` having already run (it hasn't — this runs before any
 * router). If there's no token, or it's invalid/expired, this middleware
 * has nothing to enforce and steps aside; the route's own `authenticate`
 * still runs afterward and produces the normal 401.
 */
export const enforcePasswordChange = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[config.auth.accessCookieName];
  if (!token) return next();

  let userId;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return next();
  }

  const user = await db('users').where({ id: userId }).first('must_change_password');
  if (!user?.must_change_password || isAllowed(req)) return next();

  throw ApiError.forbidden('You must change your password before continuing', {
    code: 'MUST_CHANGE_PASSWORD',
  });
});
