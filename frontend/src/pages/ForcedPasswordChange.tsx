import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { userService } from '@/services/userService'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import { changePasswordSchema, type ChangePasswordInput } from '@/validators/user.validators'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

function apiErrorMessage(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : fallback
}

/**
 * Rendered by ProtectedRoute instead of the normal app (no DashboardLayout,
 * no sidebar) whenever the logged-in user has mustChangePassword set —
 * mirrors the backend's enforcePasswordChange middleware, which blocks
 * every route except this one's endpoint (PATCH /users/me/password) and
 * logout. There's no route path for this screen and nothing on it links
 * elsewhere in the app — the only way out is changing the password or
 * logging out.
 */
export default function ForcedPasswordChange() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) })

  async function onSubmit(values: ChangePasswordInput) {
    setApiError(null)
    try {
      await userService.changePassword(values)
      // The endpoint itself only returns { success: true } (see
      // user.controller.js's changePassword) — it always clears
      // must_change_password on success, so update the store to match
      // rather than round-tripping through /auth/me again.
      if (user) setUser({ ...user, mustChangePassword: false })
    } catch (error) {
      setApiError(apiErrorMessage(error, 'Something went wrong. Please try again.'))
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await authService.logout()
    } finally {
      clear()
      navigate(ROUTES.login, { replace: true })
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            Your account was created with a temporary password. Choose your own password to
            continue.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
            {apiError && (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">Temporary password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...register('currentPassword')}
              />
              {errors.currentPassword && (
                <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="text-destructive text-sm">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Setting password…' : 'Set password'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              {isLoggingOut ? 'Logging out…' : 'Log out instead'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
