import rateLimit from 'express-rate-limit';
import { config } from '#config/env.js';

/**
 * Strict limiter for auth endpoints (login, register, forgot-password) —
 * these are the endpoints brute-force/credential-stuffing attacks target.
 * Keyed by IP by default; behind a proxy/load balancer, make sure
 * `app.set('trust proxy', ...)` is configured correctly (see app.js) or
 * every request will appear to come from the same IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

/** Looser general limiter for the rest of the API. */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
