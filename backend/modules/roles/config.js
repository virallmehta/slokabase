/**
 * Module definition for `roles` — Roles & Permissions management.
 *
 * Unlike Products/Sales, this module declares no new permissions of its
 * own: it gates every route on `roles:manage`, a base RBAC permission
 * already seeded directly in src/db/seeds/00_roles_permissions.js and
 * granted only to `admin` — so admin is the only role that can ever see
 * or use this module (manager/member get nothing, same as any other
 * permission they lack).
 *
 * Mounted at /api/v1/admin/roles rather than /api/v1/roles to avoid
 * colliding with the existing core GET /api/v1/roles endpoint
 * (src/routes/role.routes.js), which stays in place unchanged — it's the
 * lightweight `users:read`-gated role dropdown the Users module relies on
 * for assigning a role to a user, a different concern from full
 * permission management.
 */
export default {
  key: 'roles',
  basePath: '/api/v1/admin/roles',

  permissions: [],

  rolePermissions: {
    admin: [],
    manager: [],
    member: [],
  },

  menu: {
    label: 'Roles',
    icon: 'shield',
    order: 30,
    group: 'Administration',
    requiredPermission: 'roles:manage',
    children: [],
  },
};
