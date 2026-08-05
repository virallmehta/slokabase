import { Navigate, Route, Routes } from 'react-router-dom'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import ProfilePage from '@/pages/ProfilePage'
import UsersListPage from '@/pages/admin/UsersListPage'
import UserDetailPage from '@/pages/admin/UserDetailPage'
import RolesListPage from '@/pages/admin/RolesListPage'
import RoleDetailPage from '@/pages/admin/RoleDetailPage'
import AuditLogListPage from '@/pages/admin/AuditLogListPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { GuestRoute } from '@/routes/GuestRoute'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { ROUTES } from '@/constants/routes'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path={ROUTES.login} element={<Login />} />
        <Route path={ROUTES.register} element={<Register />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
        <Route path={ROUTES.resetPassword} element={<ResetPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.dashboard} element={<Dashboard />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.users} element={<UsersListPage />} />
          <Route path={`${ROUTES.users}/:id`} element={<UserDetailPage />} />
          <Route path={ROUTES.roles} element={<RolesListPage />} />
          {/* :id also matches the literal "new" — RoleDetailPage checks
              id === 'new' to switch into create mode, so this one dynamic
              route covers both /roles/new and /roles/:id. A separate
              literal /roles/new route would NOT populate useParams().id
              (no :id segment on that route), breaking that check. */}
          <Route path={`${ROUTES.roles}/:id`} element={<RoleDetailPage />} />
          <Route path={ROUTES.auditLog} element={<AuditLogListPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          {/* Every module the sidebar links to (see layouts/AppSidebar.tsx,
              driven by GET /api/menu) is navigable immediately, even
              before its dedicated page is built. Static routes above
              (profile, users, users/:id) always win over this dynamic
              catch-all — React Router ranks static segments higher. */}
          <Route path="/:moduleKey" element={<PlaceholderPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  )
}
