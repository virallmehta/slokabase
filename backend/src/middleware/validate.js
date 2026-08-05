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

// src/middleware/validate.js

/** Reusable middleware that checks incoming request payloads against a Zod schema */
export const validate = (schema) => async (req, res, next) => {
  try {
    // Parse req.body, req.query, or req.params based on your schema structure
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Assign cleaned/trimmed values back to the request object
    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;
    
    return next();
  } catch (error) {
    // Format Zod errors nicely so your errorHandler can read them
    const validationError = new Error('Validation failed');
    validationError.status = 400; // Bad Request
    validationError.details = error.errors.map((err) => ({
      field: err.path.join('.').replace('body.', ''), // e.g. "email"
      message: err.message,
    }));
    
    return next(validationError);
  }
};
