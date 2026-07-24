import { config } from '#config/env.js';

/** Centralized error handler — every route's errors funnel here via asyncHandler/next(err). */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = status === 500 && config.isProduction ? 'Internal server error' : err.message;

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({
    message,
    ...(err.details ? { errors: err.details } : {}),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
}
