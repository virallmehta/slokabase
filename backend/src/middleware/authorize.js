import { db } from '#db/knex.js';
import { ApiError } from '#utils/ApiError.js';
import { asyncHandler } from '#utils/asyncHandler.js';

/**
 * Permission-based access control. Usage:
 *   router.delete('/users/:id', authenticate, authorize('users:delete'), handler)
 *
 * Loads the caller's permissions fresh from the DB on every request (via
 * users -> role_permissions -> permissions) rather than trusting anything
 * embedded in the access token, so a permission/role change takes effect
 * on the next request instead of waiting for the token to expire.
 * Requires ALL listed permission keys to be present (AND, not OR).
 */
export function authorize(...requiredPermissions) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    const granted = await db('role_permissions')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .join('users', 'users.role_id', 'role_permissions.role_id')
      .where('users.id', req.user.id)
      .pluck('permissions.key');

    const missing = requiredPermissions.filter((perm) => !granted.includes(perm));
    if (missing.length > 0) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }

    req.user.permissions = granted;
    next();
  });
}
