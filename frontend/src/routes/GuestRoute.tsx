import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'

/** Redirects away from login/register once we know a session is active. */
export function GuestRoute() {
  const status = useAuthStore((s) => s.status)

  if (status === 'authenticated') return <Navigate to={ROUTES.dashboard} replace />
  return <Outlet />
}
