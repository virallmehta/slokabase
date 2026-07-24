import { config } from '#config/env.js';
import { getAuthProvider } from '#services/authProviders/index.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '#services/tokenService.js';
import { userRepository } from '#services/userRepository.js';
import { issueCsrfCookie } from '#middleware/csrf.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const accessCookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax',
  path: '/',
};

const refreshCookieOptions = {
  ...accessCookieOptions,
  path: '/api/auth', // only sent to auth endpoints, narrows exposure
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
  res.status(201).json({ user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const provider = getAuthProvider();
  const { user } = await provider.login(req.body);
  await issueSessionCookies(res, user);
  res.json({ user: publicUser(user) });
});

export const refresh = asyncHandler(async (req, res) => {
  const presentedToken = req.cookies?.[config.auth.refreshCookieName];
  if (!presentedToken) throw ApiError.unauthorized('No refresh token');

  const result = await rotateRefreshToken(presentedToken);
  if (!result.valid) {
    res.clearCookie(config.auth.accessCookieName, accessCookieOptions);
    res.clearCookie(config.auth.refreshCookieName, refreshCookieOptions);
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await userRepository.findById(result.userId);
  const accessToken = signAccessToken(user);

  res.cookie(config.auth.accessCookieName, accessToken, accessCookieOptions);
  res.cookie(config.auth.refreshCookieName, result.token, refreshCookieOptions);
  issueCsrfCookie(res);

  res.json({ user: publicUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  const presentedToken = req.cookies?.[config.auth.refreshCookieName];
  if (presentedToken) await revokeRefreshToken(presentedToken);

  res.clearCookie(config.auth.accessCookieName, accessCookieOptions);
  res.clearCookie(config.auth.refreshCookieName, refreshCookieOptions);
  res.clearCookie(config.auth.csrfCookieName, { path: '/' });
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: publicUser(user) });
});
