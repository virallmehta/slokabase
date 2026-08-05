import { describe, it, expect } from 'vitest'
import { initialSelection, toggleSelection, toPermissionKeysPayload } from '@/utils/permissionSelection'
import type { PermissionGroup } from '@/services/roleService'

const groups: PermissionGroup[] = [
  {
    module: 'Products',
    permissions: [
      { key: 'products:read', description: 'View products', isSystem: false, granted: true },
      { key: 'products:write', description: 'Edit products', isSystem: false, granted: false },
    ],
  },
  {
    module: 'Users',
    permissions: [
      { key: 'users:read', description: 'View users', isSystem: true, granted: true },
      { key: 'users:write', description: 'Edit users', isSystem: true, granted: false },
    ],
  },
]

describe('permissionSelection', () => {
  describe('initialSelection', () => {
    it('pre-checks exactly the permissions the backend reports as granted', () => {
      const selected = initialSelection(groups)
      expect([...selected].sort()).toEqual(['products:read', 'users:read'])
    })

    it('returns an empty set when nothing is granted (e.g. the permission catalog for a new role)', () => {
      const ungrantedGroups: PermissionGroup[] = groups.map((group) => ({
        ...group,
        permissions: group.permissions.map((p) => ({ ...p, granted: false })),
      }))
      expect(initialSelection(ungrantedGroups).size).toBe(0)
    })
  })

  describe('toggleSelection', () => {
    it('checking an unchecked permission adds it to the set', () => {
      const selected = new Set(['products:read'])
      const next = toggleSelection(selected, 'products:write', true)
      expect([...next].sort()).toEqual(['products:read', 'products:write'])
    })

    it('unchecking a checked permission removes it from the set', () => {
      const selected = new Set(['products:read', 'products:write'])
      const next = toggleSelection(selected, 'products:read', false)
      expect([...next]).toEqual(['products:write'])
    })

    it('unchecking a permission not in the set is a no-op', () => {
      const selected = new Set(['products:read'])
      const next = toggleSelection(selected, 'users:write', false)
      expect([...next]).toEqual(['products:read'])
    })

    it('does not mutate the set passed in — safe to use as a setState updater', () => {
      const selected = new Set(['products:read'])
      toggleSelection(selected, 'products:write', true)
      expect([...selected]).toEqual(['products:read'])
    })

    it('toggling the same permission on then off nets out to unchecked (idempotent round trip)', () => {
      let selected = initialSelection(groups)
      selected = toggleSelection(selected, 'products:write', true)
      selected = toggleSelection(selected, 'products:write', false)
      expect([...selected].sort()).toEqual(['products:read', 'users:read'])
    })

    it('a core (isSystem) permission toggles like any other — isSystem is informational only', () => {
      let selected = initialSelection(groups)
      selected = toggleSelection(selected, 'users:read', false)
      expect([...selected]).toEqual(['products:read'])
    })
  })

  describe('toPermissionKeysPayload', () => {
    it('builds exactly the array PUT /:id/permissions expects from the current selection', () => {
      const selected = new Set(['products:read', 'users:write'])
      expect(toPermissionKeysPayload(selected).sort()).toEqual(['products:read', 'users:write'])
    })

    it('reflects a grant + a revoke applied to the initial selection as the final diff to save', () => {
      let selected = initialSelection(groups) // starts as {products:read, users:read}
      selected = toggleSelection(selected, 'products:write', true) // grant
      selected = toggleSelection(selected, 'users:read', false) // revoke
      expect(toPermissionKeysPayload(selected).sort()).toEqual(['products:read', 'products:write'])
    })

    it('an empty selection saves as an empty array, not omitted', () => {
      expect(toPermissionKeysPayload(new Set())).toEqual([])
    })
  })
})
