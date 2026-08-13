import { roleRepository } from '#services/roleRepository.js';
import { auditLogRepository } from '#services/auditLogRepository.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

/** Powers the admin Users module's role filter/assignment dropdowns. */
export const listRoles = asyncHandler(async (req, res) => {
  const roles = await roleRepository.listAll();
  res.json({ roles });
});

function groupLabel(prefix) {
  return prefix
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Groups the flat permissions table by its `<module>:<action>` key prefix
// (e.g. `example-products:read` -> "Example Products") so new modules
// show up as their own group automatically, with no edits needed here
// when one is added.
function buildPermissionGroups(allPermissions, grantedKeys) {
  const grantedSet = new Set(grantedKeys);
  const groups = new Map();
  for (const permission of allPermissions) {
    const prefix = permission.key.split(':')[0];
    if (!groups.has(prefix)) groups.set(prefix, { module: groupLabel(prefix), permissions: [] });
    groups.get(prefix).permissions.push({
      key: permission.key,
      description: permission.description,
      isSystem: !!permission.is_system,
      granted: grantedSet.has(permission.key),
    });
  }
  return [...groups.values()].sort((a, b) => a.module.localeCompare(b.module));
}

// sqlite returns booleans as 0/1 — normalize before the value leaves the API.
function toPublicRole(role) {
  return { ...role, is_system: !!role.is_system };
}

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

// Resolves a set of requested permission keys against the full permission
// table, throwing on anything unrecognized, and returns the matching ids
// ready for role_permissions.setPermissions.
async function resolvePermissionIds(permissionKeys) {
  const allPermissions = await roleRepository.listAllPermissions();
  const permissionByKey = new Map(allPermissions.map((p) => [p.key, p]));

  const unknown = permissionKeys.filter((key) => !permissionByKey.has(key));
  if (unknown.length > 0) {
    throw ApiError.badRequest('Unknown permission key(s)', { unknown });
  }

  return { allPermissions, permissionIds: permissionKeys.map((key) => permissionByKey.get(key).id) };
}

/** Full Roles & Permissions admin listing (GET /api/v1/admin/roles). */
export const listRolesAdmin = asyncHandler(async (req, res) => {
  const roles = await roleRepository.listAllWithPermissionCounts();
  res.json({ roles: roles.map(toPublicRole) });
});

// Same grouped shape as getRolePermissions, but with no role context — for
// the "New role" form, which needs to render every permission as
// unchecked before any role exists yet to ask listGrantedPermissionKeys about.
export const getPermissionCatalog = asyncHandler(async (req, res) => {
  const allPermissions = await roleRepository.listAllPermissions();
  res.json({ groups: buildPermissionGroups(allPermissions, []) });
});

export const getRolePermissions = asyncHandler(async (req, res) => {
  const role = await roleRepository.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');

  const [allPermissions, grantedKeys] = await Promise.all([
    roleRepository.listAllPermissions(),
    roleRepository.listGrantedPermissionKeys(role.id),
  ]);

  res.json({ role: toPublicRole(role), groups: buildPermissionGroups(allPermissions, grantedKeys) });
});

export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissionKeys = [] } = req.body;

  const key = slugify(name);
  if (!key) throw ApiError.badRequest('Role name must contain at least one letter or number');

  const existing = await roleRepository.findByKey(key);
  if (existing) throw ApiError.conflict('A role with this name already exists');

  const role = await roleRepository.create(
    { key, name, description },
    { actorId: req.user.id, changes: { name: { from: null, to: name } } }
  );

  if (permissionKeys.length > 0) {
    const { permissionIds } = await resolvePermissionIds(permissionKeys);
    await roleRepository.setPermissions(role.id, permissionIds);
  }

  const allPermissions = await roleRepository.listAllPermissions();
  const grantedKeys = await roleRepository.listGrantedPermissionKeys(role.id);
  res
    .status(201)
    .json({ role: toPublicRole(role), groups: buildPermissionGroups(allPermissions, grantedKeys) });
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await roleRepository.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');

  // System roles' name/description are fixed — only their permission
  // grants (PUT /:id/permissions) can be changed. Enforced here, not just
  // by the frontend hiding the fields.
  if (role.is_system) {
    throw ApiError.badRequest('System roles cannot be renamed or have their description changed');
  }

  const fields = {};
  if (req.body.name !== undefined) {
    const key = slugify(req.body.name);
    if (!key) throw ApiError.badRequest('Role name must contain at least one letter or number');
    const existing = await roleRepository.findByKey(key);
    if (existing && existing.id !== role.id) {
      throw ApiError.conflict('A role with this name already exists');
    }
    fields.key = key;
    fields.name = req.body.name;
  }
  if (req.body.description !== undefined) {
    fields.description = req.body.description;
  }

  const changes = {};
  if (fields.name !== undefined && fields.name !== role.name) {
    changes.name = { from: role.name, to: fields.name };
  }
  if (fields.description !== undefined && fields.description !== role.description) {
    changes.description = { from: role.description, to: fields.description };
  }

  const updated = await roleRepository.update(role.id, fields, { actorId: req.user.id, changes });

  res.json({ role: toPublicRole(updated) });
});

export const deleteRole = asyncHandler(async (req, res) => {
  const role = await roleRepository.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');

  // Same guard as updateRole: rejected here regardless of what the
  // frontend sends, not just hidden/disabled client-side.
  if (role.is_system) {
    throw ApiError.badRequest('System roles cannot be deleted');
  }

  const usersWithRole = await roleRepository.countUsersWithRole(role.id);
  if (usersWithRole > 0) {
    throw ApiError.conflict('Cannot delete a role that is still assigned to users');
  }

  await roleRepository.remove(role.id, {
    actorId: req.user.id,
    changes: { name: { from: role.name, to: null } },
  });
  res.status(204).send();
});

export const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = await roleRepository.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');

  const { allPermissions, permissionIds } = await resolvePermissionIds(req.body.permissionKeys);

  // The admin role must always keep roles:manage — removing it here would
  // instantly lock every admin (including the one making this request) out
  // of Roles & Permissions management, with no other route back in.
  if (role.key === 'admin' && !req.body.permissionKeys.includes('roles:manage')) {
    throw ApiError.badRequest('The admin role must always retain roles:manage');
  }

  const beforeKeys = await roleRepository.listGrantedPermissionKeys(role.id);
  await roleRepository.setPermissions(role.id, permissionIds);
  const grantedKeys = await roleRepository.listGrantedPermissionKeys(role.id);

  if ([...beforeKeys].sort().join(',') !== [...grantedKeys].sort().join(',')) {
    await auditLogRepository.record({
      entityType: 'role',
      entityId: role.id,
      action: 'update_permissions',
      changes: { permissions: { from: beforeKeys.sort(), to: [...grantedKeys].sort() } },
      actorId: req.user.id,
    });
  }

  res.json({ role: toPublicRole(role), groups: buildPermissionGroups(allPermissions, grantedKeys) });
});
