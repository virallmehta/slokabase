/**
 * Module definition for `settings` — Application Settings. A generic
 * key-value store (see migrations/) so adding a new setting is a seed-data
 * row, not a migration — the module itself never needs to change either.
 *
 * `settings:manage` is a new permission (like Audit Log's `audit:read`),
 * granted only to admin by default.
 */
export default {
  key: 'settings',
  basePath: '/api/v1/admin/settings',

  permissions: [{ key: 'settings:manage', description: 'View and change application settings' }],

  rolePermissions: {
    admin: ['settings:manage'],
    manager: [],
    member: [],
  },

  menu: {
    label: 'Settings',
    icon: 'settings',
    order: 40,
    group: 'Administration',
    requiredPermission: 'settings:manage',
    children: [],
  },
};
