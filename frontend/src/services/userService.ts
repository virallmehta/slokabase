import { api } from '@/services/api'
import type { User } from '@/store/authStore'

// Mirrors backend/src/validators/user.validators.js's listUsersSchema
// `limit` cap — the "All" rows-per-page option (see DataTablePagination)
// requests this many rather than something truly unbounded, since the
// backend doesn't support an unlimited query.
export const MAX_USERS_PAGE_SIZE = 500

// The admin-facing shape (list/detail/edit of ANOTHER user) is
// deliberately distinct from authStore's `User` — it carries status/
// last_login_at/created_at that only make sense for admin views, and
// omits `permissions` (the backend doesn't compute a permission array per
// row in a paginated list — see backend/src/controllers/user.controller.js).
export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
  role_name: string
  status: 'active' | 'suspended'
  auth_provider: string
  last_login_at: string | null
  created_at: string
  // Only present on GET /users/:id (see user.controller.js's getUser) —
  // true when this is the only account holding the admin role, so the
  // detail page can disable delete/suspend/role-reassignment the same
  // way it disables name/description edits for is_system roles.
  isLastAdmin?: boolean
}

export interface ListUsersParams {
  search?: string
  role?: string
  status?: 'active' | 'suspended'
  page?: number
  limit?: number
}

export interface ListUsersResult {
  users: AdminUser[]
  total: number
  page: number
  limit: number
}

export interface CreateUserPayload {
  name: string
  email: string
  roleKey?: string
}

export interface CreateUserResult {
  user: AdminUser
}

export interface AdminUpdateUserPayload {
  name?: string
  email?: string
  roleKey?: string
  status?: 'active' | 'suspended'
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface Role {
  id: number
  key: string
  name: string
}

export interface AuditLogEntry {
  id: number
  action: string
  changes: Record<string, { from: unknown; to: unknown }> | null
  created_at: string
  actor_id: number | null
  actor_name: string | null
}

export interface RelatedSale {
  id: number
  product_name: string
  quantity: number
  unit_price: number
  total: number
  sold_at: string
}

export const userService = {
  async listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
    const { data } = await api.get<ListUsersResult>('/users', { params })
    return data
  },

  async getUser(id: number | string): Promise<AdminUser> {
    const { data } = await api.get<{ user: AdminUser }>(`/users/${id}`)
    return data.user
  },

  // `roleKey` is accepted here but the backend only honors it for callers
  // holding roles:manage — a caller with only users:write gets a 403 if
  // they try (see user.controller.js's createUser).
  async createUser(payload: CreateUserPayload): Promise<CreateUserResult> {
    const { data } = await api.post<CreateUserResult>('/users', payload)
    return data
  },

  // Role reassignment (`roleKey`) is accepted here but the backend only
  // honors it for callers holding roles:manage — a caller with only
  // users:write gets a 403 if they try (see user.controller.js).
  async updateUser(id: number | string, payload: AdminUpdateUserPayload): Promise<AdminUser> {
    const { data } = await api.patch<{ user: AdminUser }>(`/users/${id}`, payload)
    return data.user
  },

  async deleteUser(id: number | string): Promise<void> {
    await api.delete(`/users/${id}`)
  },

  async getAuditLogs(id: number | string): Promise<AuditLogEntry[]> {
    const { data } = await api.get<{ logs: AuditLogEntry[] }>(`/users/${id}/audit-logs`)
    return data.logs
  },

  async getRelatedSales(id: number | string): Promise<RelatedSale[]> {
    const { data } = await api.get<{ sales: RelatedSale[] }>(`/users/${id}/related-sales`)
    return data.sales
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const { data } = await api.patch<{ user: User }>('/users/me', payload)
    return data.user
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await api.patch('/users/me/password', payload)
  },

  async listRoles(): Promise<Role[]> {
    const { data } = await api.get<{ roles: Role[] }>('/roles')
    return data.roles
  },
}
