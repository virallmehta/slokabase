import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { toast } from 'sonner'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/validators/auth.validators'
import { authService } from '@/services/authService'
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

export default function ForgotPassword() {
  // The backend always responds with the same generic message whether or
  // not the email is registered (see auth.controller.js's forgotPassword)
  // — showing that message, and nothing more specific, is the point.
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(values: ForgotPasswordInput) {
    try {
      await authService.forgotPassword(values.email)
      toast.success('If an account with that email exists, a password reset link has been sent.')
      setSubmitted(true)
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
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        {submitted ? (
          <CardContent className="flex flex-col gap-4">
            <Link to={ROUTES.login} className="text-primary text-sm underline underline-offset-4">
              Back to sign in
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} />
                {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </Button>
              <Link to={ROUTES.login} className="text-primary text-sm underline underline-offset-4">
                Back to sign in
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
