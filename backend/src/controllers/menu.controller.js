import modules from '#modules/index.js';
import { coreMenuItems } from '#config/coreMenu.js';
import { roleRepository } from '#services/roleRepository.js';
import { userRepository } from '#services/userRepository.js';
import { asyncHandler } from '#utils/asyncHandler.js';

function filterMenuNode(node, grantedPermissions) {
  if (node.requiredPermission && !grantedPermissions.includes(node.requiredPermission)) {
    return null;
  }

  const children = (node.children || [])
    .map((child) => filterMenuNode(child, grantedPermissions))
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return { ...node, children };
}

export const getMenu = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  const grantedPermissions = await roleRepository.listPermissionKeys(user.role_id);

  const items = [...coreMenuItems, ...modules]
    .map((mod) => filterMenuNode({ key: mod.key, path: mod.basePath, ...mod.menu }, grantedPermissions))
    .filter(Boolean);

  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  const menu = [...groups.entries()]
    .map(([group, groupItems]) => ({
      group,
      items: groupItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));

  res.json({ menu });
});
