import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { toast } from 'sonner'
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

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((s) => s.setUser)

  // Set by ResetPassword.tsx on a successful reset (via navigate's `state`
  // option) — a one-time confirmation, not persisted anywhere. Fired once
  // on arrival rather than rendered inline, so a later re-render (e.g. a
  // failed login attempt right after) doesn't keep re-showing it. Same
  // location-state-consumption shape as RoleDetailPage.tsx's `justCreated`
  // effect, including clearing the state afterward so a later back-button
  // visit to this history entry doesn't re-show it.
  //
  // The ref guard is required, not just style: StrictMode (see main.tsx)
  // double-invokes effects once in development to surface missing
  // cleanup, which would otherwise fire this toast twice on every login
  // page load reached via a flash redirect.
  const flashShown = useRef(false)
  useEffect(() => {
    if (flashShown.current) return
    const flash = (location.state as { flash?: string } | null)?.flash
    if (!flash) return
    flashShown.current = true
    toast.success(flash)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    try {
      const user = await authService.login(values)
      setUser(user)
      navigate(ROUTES.dashboard, { replace: true })
    } catch (error) {
      toast.error(
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
