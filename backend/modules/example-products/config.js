/**
 * Module definition for `example-products` — a reference/demo module
 * showing the module-registry pattern (see
 * backend/.claude/skills/module-registry-pattern/SKILL.md). Not core
 * infrastructure — safe to delete this whole directory in a real project
 * that doesn't need a Products domain.
 */
export default {
  key: 'example-products',
  basePath: '/api/v1/example-products',

  permissions: [
    { key: 'example-products:read', description: 'View products' },
    { key: 'example-products:write', description: 'Create/edit products' },
    { key: 'example-products:delete', description: 'Delete products' },
  ],

  // Which of this module's permissions the core admin/manager/member roles
  // get — modules only grant permissions onto the existing role set, they
  // don't define new roles (see CLAUDE.md RBAC section).
  rolePermissions: {
    admin: ['example-products:read', 'example-products:write', 'example-products:delete'],
    manager: ['example-products:read', 'example-products:write'],
    member: [],
  },

  menu: {
    label: 'Example Products',
    icon: 'box',
    order: 10,
    group: 'Catalog',
    requiredPermission: 'example-products:read',
    children: [],
  },
};
