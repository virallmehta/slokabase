/**
 * Module definition for `products` — everything the registry
 * (modules/index.js) and the migration runner (modules/migrate.js) need to
 * plug this module in without touching src/db or app.js by hand.
 */
export default {
  key: 'products',
  basePath: '/api/v1/products',

  permissions: [
    { key: 'products:read', description: 'View products' },
    { key: 'products:write', description: 'Create/edit products' },
    { key: 'products:delete', description: 'Delete products' },
  ],

  // Which of this module's permissions the core admin/manager/member roles
  // get — modules only grant permissions onto the existing role set, they
  // don't define new roles (see CLAUDE.md RBAC section).
  rolePermissions: {
    admin: ['products:read', 'products:write', 'products:delete'],
    manager: ['products:read', 'products:write'],
    member: [],
  },

  menu: {
    label: 'Products',
    icon: 'box',
    order: 10,
    group: 'Catalog',
    requiredPermission: 'products:read',
    children: [],
  },
};
