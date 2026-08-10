import crypto from 'node:crypto';
import { config } from '#config/env.js';
import { parseDurationMs } from '#services/tokenService.js';
import { ApiError } from '#utils/ApiError.js';

/**
 * Double-submit cookie CSRF protection.
 *
 * Why this is needed: once auth lives in a cookie, the browser attaches it
 * automatically to ANY request to this origin — including one triggered
 * by a malicious third-party page the user happens to have open. That's
 * exactly what CSRF is. The fix: the server also sets a second,
 * non-httpOnly cookie holding a random token. Only same-origin JavaScript
 * (which a malicious page cannot execute) can read that cookie value and
 * echo it back in a custom header — so a forged cross-site request can
 * send the auth cookie automatically, but can't produce a matching header.
 *
 * `issueCsrfCookie` — call after login/register to set the token.
 * `verifyCsrfToken` — apply to all state-changing routes (POST/PUT/PATCH/DELETE).
 */
export function issueCsrfCookie(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(config.auth.csrfCookieName, token, {
    httpOnly: false, // must be readable by client JS to echo back in a header
    // Cross-origin in production (frontend/backend on different Vercel
    // domains) requires sameSite: 'none' + secure: true; same-origin locally
    // keeps 'lax' since 'none' would be unnecessary there.
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    // See accessCookieBaseOptions in auth.controller.js for why this is
    // needed (Chrome CHIPS) and its limits (no effect on Safari ITP).
    partitioned: config.isProduction,
    path: '/',
    // Reissued alongside the access token on every login/register/refresh
    // (see auth.controller.js), so keep it on the same lifetime.
    maxAge: parseDurationMs(config.auth.accessExpiresIn),
  });
  return token;
}

export function verifyCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies?.[config.auth.csrfCookieName];
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(ApiError.forbidden('Invalid or missing CSRF token'));
  }
  next();
}
