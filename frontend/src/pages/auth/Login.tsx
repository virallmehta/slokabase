import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { loginSchema, type LoginInput } from '@/validators/auth.validators'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
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

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((s) => s.setUser)
  const [apiError, setApiError] = useState<string | null>(null)
  // Set by ResetPassword.tsx on a successful reset (via navigate's `state`
  // option) — a one-time confirmation, not persisted anywhere.
  const flash = (location.state as { flash?: string } | null)?.flash ?? null

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setApiError(null)
    try {
      const user = await authService.login(values)
      setUser(user)
      navigate(ROUTES.dashboard, { replace: true })
    } catch (error) {
      setApiError(
        axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Something went wrong. Please try again.'
      )
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
            {flash && (
              <Alert>
                <AlertDescription>{flash}</AlertDescription>
              </Alert>
            )}
            {apiError && (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-muted-foreground text-sm">
              Don&apos;t have an account?{' '}
              <Link to={ROUTES.register} className="text-primary underline underline-offset-4">
                Register
              </Link>
            </p>
            <Link
              to={ROUTES.forgotPassword}
              className="text-muted-foreground text-sm underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
