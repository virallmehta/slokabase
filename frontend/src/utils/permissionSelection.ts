import type { PermissionGroup } from '@/services/roleService'

/**
 * Pulled out of RoleDetailPage as plain functions so the toggle/diff logic
 * can be unit tested without rendering anything (no @testing-library/react
 * in this project — see frontend/CLAUDE.md's Testing section).
 */

// Derives the initial checkbox state from a role's permission groups —
// whatever the backend says is currently granted, pre-checked.
export function initialSelection(groups: PermissionGroup[]): Set<string> {
  return new Set(groups.flatMap((group) => group.permissions.filter((p) => p.granted).map((p) => p.key)))
}

// Returns a new Set with `key` added or removed — never mutates `selected`,
// so it's safe to use directly as a setState updater.
export function toggleSelection(selected: Set<string>, key: string, checked: boolean): Set<string> {
  const next = new Set(selected)
  if (checked) next.add(key)
  else next.delete(key)
  return next
}

// The full set of currently-checked permission keys is exactly what
// PUT /:id/permissions expects — the backend replaces the whole grant set
// in one transaction rather than diffing individual adds/removes
// (see backend/modules/roles/repository.js's setPermissions).
export function toPermissionKeysPayload(selected: Set<string>): string[] {
  return [...selected]
}
