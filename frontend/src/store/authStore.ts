import { create } from 'zustand'

export interface User {
  id: number
  name: string
  email: string
  role: string
  permissions: string[]
  // Set on admin-created users until they set their own password (see
  // backend's enforcePasswordChange middleware) — ProtectedRoute gates on
  // this to show the forced-change screen instead of the normal app.
  mustChangePassword: boolean
}

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: User | null
  status: AuthStatus
  setLoading: () => void
  setUser: (user: User) => void
  clear: () => void
}

/**
 * Holds only in-memory auth state — deliberately NOT persisted to
 * localStorage/sessionStorage. Session identity lives entirely in the
 * httpOnly access/refresh cookies the backend sets; this store just
 * mirrors who that session belongs to for the current tab. On a hard
 * reload it resets to "idle" and gets re-hydrated by calling GET
 * /auth/me (see App.tsx) — the cookie is what actually keeps you logged
 * in, not this store.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setLoading: () => set({ status: 'loading' }),
  setUser: (user) => set({ user, status: 'authenticated' }),
  clear: () => set({ user: null, status: 'unauthenticated' }),
}))
