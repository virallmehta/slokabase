import crypto from 'node:crypto';
import { config } from '#config/env.js';
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
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
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
