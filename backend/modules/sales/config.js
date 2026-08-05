export default {
  key: 'sales',
  basePath: '/api/v1/sales',

  permissions: [
    { key: 'sales:read', description: 'View sales' },
    { key: 'sales:write', description: 'Record/edit sales' },
    { key: 'sales:delete', description: 'Delete sales' },
  ],

  rolePermissions: {
    admin: ['sales:read', 'sales:write', 'sales:delete'],
    manager: ['sales:read', 'sales:write'],
    member: [],
  },

  menu: {
    label: 'Sales',
    icon: 'receipt',
    order: 20,
    group: 'Catalog',
    requiredPermission: 'sales:read',
    children: [],
  },
};
