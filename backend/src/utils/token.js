// src/utils/token.js
import jwt from 'jsonwebtoken';
import { config } from '#config/env.js';

/** Sign a JWT token, calculating longevity based on the "rememberMe" choice */
export function generateToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : config.auth.jwtExpiresIn; // 30 days vs 15 mins default
  
  return jwt.sign(
    { id: user.id, role: user.role },
    config.auth.jwtSecret,
    { expiresIn }
  );
}

/** Attach the JWT token inside a secure, tamper-proof httpOnly cookie wrapper */
export function setAuthCookie(res, token, rememberMe = false) {
  const maxAge = rememberMe 
    ? 30 * 24 * 60 * 60 * 1000  // 30 days in ms
    : 15 * 60 * 1000;           // 15 minutes in ms

  res.cookie('token', token, {
    httpOnly: true,
    secure: config.isProduction, // Require HTTPS in production environments
    sameSite: config.isProduction ? 'none' : 'lax', // CSRF cross-origin adjustments
    maxAge: maxAge,
  });
}
