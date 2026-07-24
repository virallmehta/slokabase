import { ApiError } from '#utils/ApiError.js';

/** Express middleware factory: validates req.body against a Zod schema. */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(ApiError.badRequest('Validation failed', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}
