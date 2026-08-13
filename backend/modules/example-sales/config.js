/**
 * Module definition for `example-sales` — a reference/demo module showing
 * the module-registry pattern (see
 * backend/.claude/skills/module-registry-pattern/SKILL.md), including how
 * one module can depend on another (`example-products`). Not core
 * infrastructure.
 */
export default {
  key: 'example-sales',
  basePath: '/api/v1/example-sales',

  permissions: [
    { key: 'example-sales:read', description: 'View sales' },
    { key: 'example-sales:write', description: 'Record/edit sales' },
    { key: 'example-sales:delete', description: 'Delete sales' },
  ],

  rolePermissions: {
    admin: ['example-sales:read', 'example-sales:write', 'example-sales:delete'],
    manager: ['example-sales:read', 'example-sales:write'],
    member: [],
  },

  menu: {
    label: 'Example Sales',
    icon: 'receipt',
    order: 20,
    group: 'Catalog',
    requiredPermission: 'example-sales:read',
    children: [],
  },
};
