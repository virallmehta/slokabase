import { api } from '@/services/api'

// Distinct from userService's `Role` (id/key/name only, used for the
// Users module's role-assignment dropdown) — this is the fuller shape
// backend/modules/roles/repository.js returns for Roles & Permissions
// management (backend basePath: /api/v1/admin/roles).
export interface AdminRole {
  id: number
  key: string
  name: string
  description: string | null
  is_system: boolean
  permissionCount?: number | string
}

export interface Permission {
  key: string
  description: string | null
  isSystem: boolean
  granted: boolean
}

export interface PermissionGroup {
  module: string
  permissions: Permission[]
}

export interface RolePermissionsResult {
  role: AdminRole
  groups: PermissionGroup[]
}

export interface CreateRolePayload {
  name: string
  description?: string
  permissionKeys?: string[]
}

export interface UpdateRolePayload {
  name?: string
  description?: string
}

export const roleService = {
  async listRoles(): Promise<AdminRole[]> {
    const { data } = await api.get<{ roles: AdminRole[] }>('/admin/roles')
    return data.roles
  },

  // Same grouped shape as getRolePermissions, but with no role context —
  // used by the "New role" form, which needs every permission rendered
  // unchecked before a role exists to ask about grants for.
  async getPermissionCatalog(): Promise<{ groups: PermissionGroup[] }> {
    const { data } = await api.get<{ groups: PermissionGroup[] }>('/admin/roles/permissions/catalog')
    return data
  },

  async getRolePermissions(id: number | string): Promise<RolePermissionsResult> {
    const { data } = await api.get<RolePermissionsResult>(`/admin/roles/${id}/permissions`)
    return data
  },

  async updateRolePermissions(id: number | string, permissionKeys: string[]): Promise<RolePermissionsResult> {
    const { data } = await api.put<RolePermissionsResult>(`/admin/roles/${id}/permissions`, {
      permissionKeys,
    })
    return data
  },

  async createRole(payload: CreateRolePayload): Promise<RolePermissionsResult> {
    const { data } = await api.post<RolePermissionsResult>('/admin/roles', payload)
    return data
  },

  async updateRole(id: number | string, payload: UpdateRolePayload): Promise<AdminRole> {
    const { data } = await api.patch<{ role: AdminRole }>(`/admin/roles/${id}`, payload)
    return data.role
  },

  async deleteRole(id: number | string): Promise<void> {
    await api.delete(`/admin/roles/${id}`)
  },
}
