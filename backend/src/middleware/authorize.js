import { ApiError } from '#utils/ApiError.js';

/**
 * Simple role-based access control. Usage:
 *   router.delete('/users/:id', authenticate, authorize('admin'), handler)
 *
 * This is intentionally minimal (one role per user, checked against an
 * allow-list per route) — enough for most apps. If you need finer-grained
 * permissions (e.g. "can_edit_billing" independent of role), add a
 * `permissions` table and a `hasPermission()` check here instead; nothing
 * else in the app needs to change since routes only ever call `authorize`.
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}
