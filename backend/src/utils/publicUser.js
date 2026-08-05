import { roleRepository } from '#services/roleRepository.js';

/**
 * Shapes a user row for a self-service API response (login/register/
 * refresh/me). Permissions are fetched from the DB here (per-request)
 * rather than ever being embedded in the JWT — see tokenService.js.
 *
 * Only for the CURRENT user's own record — admin endpoints that list/view
 * OTHER users (user.controller.js's listUsers/getUser/updateUser) don't
 * use this, since computing permissions for every row in a paginated list
 * would be a wasted N+1 query nobody asked for.
 */
export async function toPublicUser(user) {
  const permissions = await roleRepository.listPermissionKeys(user.role_id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions,
    // sqlite returns booleans as 0/1 — normalize before it leaves the API.
    mustChangePassword: !!user.must_change_password,
  };
}
