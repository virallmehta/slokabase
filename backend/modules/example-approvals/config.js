/**
 * Module definition for `example-approvals` — a reference/demo module
 * showing the workflow-declaration pattern (see
 * backend/.claude/skills/module-registry-pattern/SKILL.md's "Declaring a
 * workflow" section), alongside the standard module-registry pattern shown
 * by example-products/example-sales. Not core infrastructure — safe to
 * delete this whole directory in a real project that doesn't need it.
 */
export default {
  key: 'example-approvals',
  basePath: '/api/v1/example-approvals',

  permissions: [
    { key: 'example-approvals:read', description: 'View approval requests' },
    { key: 'example-approvals:write', description: 'Create approval requests and move them between draft/submitted' },
    { key: 'example-approvals:approve', description: 'Approve or reject a submitted approval request' },
  ],

  rolePermissions: {
    admin: ['example-approvals:read', 'example-approvals:write', 'example-approvals:approve'],
    manager: ['example-approvals:read', 'example-approvals:write'],
    member: ['example-approvals:read'],
  },

  menu: {
    label: 'Example Approvals',
    icon: 'check-circle',
    order: 30,
    group: 'Catalog',
    requiredPermission: 'example-approvals:read',
    children: [],
  },

  workflow: {
    entityType: 'example-approval',
    states: ['draft', 'submitted', 'approved', 'rejected'],
    transitions: [
      { from: 'draft', to: 'submitted', permission: 'example-approvals:write' },
      { from: 'submitted', to: 'approved', permission: 'example-approvals:approve' },
      { from: 'submitted', to: 'rejected', permission: 'example-approvals:approve' },
      { from: 'submitted', to: 'draft', permission: 'example-approvals:write' },
    ],
  },
};
