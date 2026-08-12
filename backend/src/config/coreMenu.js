/**
 * Static menu entries for core, mandatory infrastructure (Roles, Settings)
 * that used to be filesystem-discovered `modules/*` manifests. These
 * aren't optional — every project built on Slokabase needs them — so they
 * don't belong in the `modules/` auto-discovery loop (that's reserved for
 * optional domain features, see
 * backend/.claude/skills/module-registry-pattern/SKILL.md). Kept as a
 * plain array here (rather than one-off literals inside
 * menu.controller.js) so it's a single place to look for "everything
 * always in the sidebar for a permitted role."
 *
 * Audit Log is deliberately NOT listed here — unlike Roles and Settings,
 * `modules/audit-log/` still exists as a real, self-contained module (see
 * its config.js) and already contributes its own menu entry via the
 * `modules/` registry loop below. Adding it here too would duplicate that
 * entry in GET /api/menu's output.
 *
 * menu.controller.js merges this with the `modules/` registry loop so
 * GET /api/menu's shape, and the frontend that consumes it, don't change.
 */
export const coreMenuItems = [
  {
    key: 'roles',
    basePath: '/api/v1/admin/roles',
    menu: {
      label: 'Roles',
      icon: 'shield',
      order: 30,
      group: 'Administration',
      requiredPermission: 'roles:manage',
      children: [],
    },
  },
  {
    key: 'settings',
    basePath: '/api/v1/admin/settings',
    menu: {
      label: 'Settings',
      icon: 'settings',
      order: 40,
      group: 'Administration',
      requiredPermission: 'settings:manage',
      children: [],
    },
  },
];
