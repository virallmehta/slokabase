import { config } from '#config/env.js';
import { getAuthProvider } from '#services/authProviders/index.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
  issuePasswordResetToken,
  consumePasswordResetToken,
  parseDurationMs,
} from '#services/tokenService.js';
import { userRepository } from '#services/userRepository.js';
import { auditLogRepository } from '#services/auditLogRepository.js';
import { sendEmail } from '#services/emailService.js';
import { hashPassword } from '#utils/password.js';
import { issueCsrfCookie } from '#middleware/csrf.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';
import { toPublicUser as publicUser } from '#utils/publicUser.js';

// Identity attributes only (no maxAge) — these must be passed to
// res.clearCookie() as-is. Express's clearCookie merges whatever options
// you give it into { expires: new Date(1) } and hands the result to
// res.cookie(), which then converts any `maxAge` it finds into a FUTURE
// `expires`, silently overwriting the "expire immediately" default and
// re-extending the cookie instead of deleting it. Keep maxAge only on the
// *Options variants below, used solely for issuing cookies.
const accessCookieBaseOptions = {
  httpOnly: true,
  // Frontend and backend are on different Vercel domains in production, so
  // the auth cookies are cross-origin there — that requires sameSite: 'none'
  // (which in turn requires secure: true, browsers reject 'none' otherwise).
  // Locally frontend/backend share an origin, where 'none' is unnecessary
  // and secure: true would break cookies over plain http.
  secure: config.isProduction,
  sameSite: config.isProduction ? 'none' : 'lax',
  // Chrome's CHIPS requires this for a sameSite: 'none' cookie to be
  // accepted cross-site at all; only valid alongside secure, so gate the
  // same way. Note: Safari has no CHIPS support, so this doesn't affect
  // Safari's third-party cookie blocking either way.
  partitioned: config.isProduction,
  path: '/',
};

const refreshCookieBaseOptions = {
  ...accessCookieBaseOptions,
  path: '/api/v1/auth', // only sent to auth endpoints, narrows exposure
};

const accessCookieOptions = {
  ...accessCookieBaseOptions,
  // Keep the cookie's own lifetime in sync with the JWT's `exp` claim,
  // rather than defaulting to a browser-session cookie that outlives the
  // (already-expired-and-rejected) token it's carrying.
  maxAge: parseDurationMs(config.auth.accessExpiresIn),
};

const refreshCookieOptions = {
  ...refreshCookieBaseOptions,
  maxAge: parseDurationMs(config.auth.refreshExpiresIn),
};

async function issueSessionCookies(res, user) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken } = await issueRefreshToken(user.id);

  res.cookie(config.auth.accessCookieName, accessToken, accessCookieOptions);
  res.cookie(config.auth.refreshCookieName, refreshToken, refreshCookieOptions);
  issueCsrfCookie(res);
}

export const register = asyncHandler(async (req, res) => {
  const provider = getAuthProvider();
  const { user } = await provider.register(req.body);
  await issueSessionCookies(res, user);
  res.status(201).json({ user: await publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const provider = getAuthProvider();
  const { user } = await provider.login(req.body);

  if (user.status === 'suspended') throw ApiError.forbidden('This account has been suspended');
  await userRepository.touchLastLogin(user.id);

  await issueSessionCookies(res, user);
  res.json({ user: await publicUser(user) });
});

export const refresh = asyncHandler(async (req, res) => {
  const presentedToken = req.cookies?.[config.auth.refreshCookieName];
  if (!presentedToken) throw ApiError.unauthorized('No refresh token');

  const result = await rotateRefreshToken(presentedToken);
  if (!result.valid) {
    res.clearCookie(config.auth.accessCookieName, accessCookieBaseOptions);
    res.clearCookie(config.auth.refreshCookieName, refreshCookieBaseOptions);
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await userRepository.findById(result.userId);
  const accessToken = signAccessToken(user);

  res.cookie(config.auth.accessCookieName, accessToken, accessCookieOptions);
  res.cookie(config.auth.refreshCookieName, result.token, refreshCookieOptions);
  issueCsrfCookie(res);

  res.json({ user: await publicUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  const presentedToken = req.cookies?.[config.auth.refreshCookieName];
  if (presentedToken) await revokeRefreshToken(presentedToken);

  res.clearCookie(config.auth.accessCookieName, accessCookieBaseOptions);
  res.clearCookie(config.auth.refreshCookieName, refreshCookieBaseOptions);
  res.clearCookie(config.auth.csrfCookieName, { path: '/' });
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: await publicUser(user) });
});

// Generic message returned whether or not the email is registered — never
// reveal which emails have accounts.
const FORGOT_PASSWORD_RESPONSE = {
  message: 'If an account with that email exists, a password reset link has been sent.',
};

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await userRepository.findByEmail(email);

  // Only local-provider accounts have a password_hash this app manages —
  // WordPress/Wagtail-backed accounts authenticate elsewhere, so there's
  // nothing here to reset. Silently no-op for them too, same as an
  // unregistered email, to avoid leaking provider info.
  if (user && user.auth_provider === 'local') {
    const token = await issuePasswordResetToken(user.id);
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your password',
      text: `We received a request to reset your password. Reset it here: ${resetUrl}\n\nThis link expires in ${config.auth.passwordResetExpiresIn}. If you didn't request this, you can ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in ${config.auth.passwordResetExpiresIn}. If you didn't request this, you can ignore this email.</p>`,
    });

    await auditLogRepository.record({
      entityType: 'user',
      entityId: user.id,
      action: 'password_reset_requested',
      actorId: user.id,
    });
  }

  res.json(FORGOT_PASSWORD_RESPONSE);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const result = await consumePasswordResetToken(token);
  if (!result.valid) throw ApiError.badRequest('This reset link is invalid or has expired');

  const password_hash = await hashPassword(newPassword);
  await userRepository.update(result.userId, { password_hash, must_change_password: false });

  // The password changed, so every existing session (this device and any
  // other) must re-authenticate — same reasoning as changePassword, except
  // here there's no "current" session to leave alone since this request
  // itself isn't authenticated.
  await revokeAllUserSessions(result.userId);

  await auditLogRepository.record({
    entityType: 'user',
    entityId: result.userId,
    action: 'password_reset',
    actorId: result.userId,
  });

  res.json({ success: true });
});
