import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, type User } from '@/store/authStore'

const testUser: User = {
  id: 1,
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  permissions: ['users:read', 'users:write'],
  mustChangePassword: false,
}

describe('authStore', () => {
  beforeEach(() => {
    // Not persisted (see the store's own comment) — reset in-memory state
    // between tests the same way a hard reload would.
    useAuthStore.setState({ user: null, status: 'idle' })
  })

  it('starts idle with no user', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.status).toBe('idle')
  })

  it('setLoading() moves status to loading without touching user', () => {
    useAuthStore.getState().setLoading()
    const state = useAuthStore.getState()
    expect(state.status).toBe('loading')
    expect(state.user).toBeNull()
  })

  it('setUser() (login) sets the user and marks status authenticated', () => {
    useAuthStore.getState().setUser(testUser)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(testUser)
    expect(state.status).toBe('authenticated')
  })

  it('clear() (logout) removes the user and marks status unauthenticated', () => {
    useAuthStore.getState().setUser(testUser)
    useAuthStore.getState().clear()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.status).toBe('unauthenticated')
  })

  it('setUser() after clear() re-authenticates with the new user', () => {
    useAuthStore.getState().setUser(testUser)
    useAuthStore.getState().clear()

    const otherUser: User = { ...testUser, id: 2, name: 'Member', role: 'member', permissions: [] }
    useAuthStore.getState().setUser(otherUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(otherUser)
    expect(state.status).toBe('authenticated')
  })
})
