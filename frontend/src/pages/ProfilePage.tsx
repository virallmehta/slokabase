import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { toast } from 'sonner'
import { userService } from '@/services/userService'
import { useAuthStore } from '@/store/authStore'
import {
  changePasswordSchema,
  type ChangePasswordInput,
  updateProfileSchema,
  type UpdateProfileInput,
} from '@/validators/user.validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function apiErrorMessage(error: unknown, fallback: string) {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : fallback
}

function ProfileForm() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user?.name, email: user?.email },
  })

  async function onSubmit(values: UpdateProfileInput) {
    try {
      // Response includes `permissions` (see backend's toPublicUser
      // helper) so the store stays consistent with what /auth/me returns
      // — not just name/email, the full shape authStore expects.
      const updated = await userService.updateProfile(values)
      setUser(updated)
      toast.success('Profile updated.')
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Something went wrong. Please try again.'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your name and email address.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) })

  async function onSubmit(values: ChangePasswordInput) {
    try {
      await userService.changePassword(values)
      toast.success('Password changed.')
      reset()
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Something went wrong. Please try again.'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
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
            {errors.newPassword && <p className="text-destructive text-sm">{errors.newPassword.message}</p>}
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
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Changing…' : 'Change password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your own account details.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfileForm />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
