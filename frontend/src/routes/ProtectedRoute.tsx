import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import ForcedPasswordChange from '@/pages/ForcedPasswordChange'

/**
 * Blocks access until the /auth/me bootstrap call (App.tsx) resolves. Also
 * the single gate for the forced-password-change state — mirrors the
 * backend's enforcePasswordChange middleware being one global check rather
 * than something added to every route: if mustChangePassword is set,
 * every protected route renders ForcedPasswordChange instead of its own
 * content (DashboardLayout/sidebar never mounts), so there's nothing to
 * add when a new protected route is added later.
 */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)

  if (status === 'idle' || status === 'loading') return null
  if (status !== 'authenticated') return <Navigate to={ROUTES.login} replace />
  if (user?.mustChangePassword) return <ForcedPasswordChange />
  return <Outlet />
}
