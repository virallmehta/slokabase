/**
 * Module definition for `audit-log` — System Audit Log. Reads the shared,
 * core `audit_logs` table (src/services/auditLogRepository.js) that Users
 * and Roles already write to on every create/update/delete — this module
 * only adds a queryable, filterable, cross-entity view over that existing
 * data, it doesn't introduce a new data source.
 *
 * `audit:read` is a new permission (unlike Roles' `roles:manage`, which
 * already existed as a base permission) — granted only to admin by
 * default, same admin-only posture as Roles & Permissions management.
 */
export default {
  key: 'audit-log',
  basePath: '/api/v1/admin/audit-logs',

  permissions: [{ key: 'audit:read', description: 'View the system audit log' }],

  rolePermissions: {
    admin: ['audit:read'],
    manager: [],
    member: [],
  },

  menu: {
    label: 'Audit Log',
    icon: 'history',
    order: 20,
    group: 'Administration',
    requiredPermission: 'audit:read',
    children: [],
  },
};
