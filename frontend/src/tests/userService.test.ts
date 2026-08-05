import { describe, it, expect, vi, afterEach } from 'vitest'
import { api } from '@/services/api'
import { userService, type AdminUser, type AuditLogEntry, type RelatedSale } from '@/services/userService'

const fakeAdminUser: AdminUser = {
  id: 2,
  name: 'Plain Member',
  email: 'plain-member@example.com',
  role: 'member',
  role_name: 'Member',
  status: 'active',
  auth_provider: 'local',
  last_login_at: null,
  created_at: '2026-08-03T00:00:00.000Z',
}

describe('userService.listUsers()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes search/role/status/page/limit through as query params', async () => {
    const getSpy = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { users: [fakeAdminUser], total: 1, page: 2, limit: 10 } })

    const result = await userService.listUsers({
      search: 'plain',
      role: 'member',
      status: 'active',
      page: 2,
      limit: 10,
    })

    expect(getSpy).toHaveBeenCalledWith('/users', {
      params: { search: 'plain', role: 'member', status: 'active', page: 2, limit: 10 },
    })
    expect(result.users).toEqual([fakeAdminUser])
    expect(result.total).toBe(1)
  })

  it('works with no filters at all', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { users: [], total: 0, page: 1, limit: 20 } })

    await userService.listUsers()

    expect(getSpy).toHaveBeenCalledWith('/users', { params: {} })
  })
})

describe('userService.getUser()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests the specific user by id and unwraps the response', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { user: fakeAdminUser } })

    const result = await userService.getUser(2)

    expect(getSpy).toHaveBeenCalledWith('/users/2')
    expect(result).toEqual(fakeAdminUser)
  })
})

describe('userService.updateUser() — role assignment payload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends name/email/status edits without a roleKey untouched', async () => {
    const patchSpy = vi
      .spyOn(api, 'patch')
      .mockResolvedValue({ data: { user: { ...fakeAdminUser, name: 'Renamed' } } })

    await userService.updateUser(2, { name: 'Renamed' })

    expect(patchSpy).toHaveBeenCalledWith('/users/2', { name: 'Renamed' })
  })

  it('includes roleKey in the payload when reassigning a role', async () => {
    const patchSpy = vi
      .spyOn(api, 'patch')
      .mockResolvedValue({ data: { user: { ...fakeAdminUser, role: 'manager' } } })

    const result = await userService.updateUser(2, { roleKey: 'manager' })

    expect(patchSpy).toHaveBeenCalledWith('/users/2', { roleKey: 'manager' })
    expect(result.role).toBe('manager')
  })

  it('propagates a 403 from the backend when the caller cannot reassign roles', async () => {
    vi.spyOn(api, 'patch').mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Only users with roles:manage can reassign roles' } },
    })

    await expect(userService.updateUser(2, { roleKey: 'admin' })).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})

describe('userService.updateProfile()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('PATCHes /users/me and returns the updated self-service user (with permissions)', async () => {
    const selfUser = {
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: ['users:read'],
      mustChangePassword: false,
    }
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: { user: selfUser } })

    const result = await userService.updateProfile({ name: 'Admin' })

    expect(patchSpy).toHaveBeenCalledWith('/users/me', { name: 'Admin' })
    expect(result).toEqual(selfUser)
  })
})

describe('userService.changePassword()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends currentPassword/newPassword to /users/me/password', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: { success: true } })

    await userService.changePassword({ currentPassword: 'old-pass', newPassword: 'new-password-123' })

    expect(patchSpy).toHaveBeenCalledWith('/users/me/password', {
      currentPassword: 'old-pass',
      newPassword: 'new-password-123',
    })
  })

  it('propagates a 401 when the current password is wrong', async () => {
    vi.spyOn(api, 'patch').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Current password is incorrect' } },
    })

    await expect(
      userService.changePassword({ currentPassword: 'wrong', newPassword: 'new-password-123' })
    ).rejects.toMatchObject({ response: { status: 401 } })
  })
})

describe('userService.listRoles()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the roles array from the response', async () => {
    const roles = [
      { id: 1, key: 'admin', name: 'Admin' },
      { id: 2, key: 'manager', name: 'Manager' },
      { id: 3, key: 'member', name: 'Member' },
    ]
    vi.spyOn(api, 'get').mockResolvedValue({ data: { roles } })

    const result = await userService.listRoles()

    expect(result).toEqual(roles)
  })
})

describe('userService.createUser() — role assignment on creation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates without a roleKey by default (backend defaults to member)', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { user: fakeAdminUser } })

    const result = await userService.createUser({ name: 'New Person', email: 'new@example.com' })

    expect(postSpy).toHaveBeenCalledWith('/users', { name: 'New Person', email: 'new@example.com' })
    // The temporary password is emailed directly, never returned here.
    expect(result).not.toHaveProperty('temporaryPassword')
    expect(result.user).toEqual(fakeAdminUser)
  })

  it('includes roleKey when creating with an explicit role', async () => {
    const postSpy = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { user: { ...fakeAdminUser, role: 'manager' } } })

    await userService.createUser({ name: 'New Manager', email: 'new-manager@example.com', roleKey: 'manager' })

    expect(postSpy).toHaveBeenCalledWith('/users', {
      name: 'New Manager',
      email: 'new-manager@example.com',
      roleKey: 'manager',
    })
  })

  it('propagates a 403 when the caller cannot assign a role on create', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Only users with roles:manage can assign a role' } },
    })

    await expect(
      userService.createUser({ name: 'X', email: 'x@example.com', roleKey: 'admin' })
    ).rejects.toMatchObject({ response: { status: 403 } })
  })
})

describe('userService.deleteUser()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('DELETEs /users/:id', async () => {
    const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({ data: undefined })

    await userService.deleteUser(5)

    expect(deleteSpy).toHaveBeenCalledWith('/users/5')
  })
})

describe('userService.getAuditLogs()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the logs array, preserving field-diff shape', async () => {
    const logs: AuditLogEntry[] = [
      {
        id: 1,
        action: 'update',
        changes: { name: { from: 'Old Name', to: 'New Name' } },
        created_at: '2026-08-03T00:00:00.000Z',
        actor_id: 1,
        actor_name: 'Admin',
      },
      {
        id: 2,
        action: 'password_change',
        changes: null,
        created_at: '2026-08-03T00:01:00.000Z',
        actor_id: 2,
        actor_name: 'Manager Two',
      },
    ]
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { logs } })

    const result = await userService.getAuditLogs(2)

    expect(getSpy).toHaveBeenCalledWith('/users/2/audit-logs')
    expect(result).toEqual(logs)
    // Never leaks anything password-shaped even in a passthrough.
    expect(JSON.stringify(result)).not.toMatch(/password123|currentPassword|newPassword/)
  })
})

describe('userService.getRelatedSales()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the sales array for the given user', async () => {
    const sales: RelatedSale[] = [
      {
        id: 1,
        product_name: 'Widget',
        quantity: 2,
        unit_price: 9.99,
        total: 19.98,
        sold_at: '2026-08-03T00:00:00.000Z',
      },
    ]
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { sales } })

    const result = await userService.getRelatedSales(1)

    expect(getSpy).toHaveBeenCalledWith('/users/1/related-sales')
    expect(result).toEqual(sales)
  })
})
