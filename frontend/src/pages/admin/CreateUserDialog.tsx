import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { Plus } from 'lucide-react'
import { userService, type Role } from '@/services/userService'
import { createUserSchema, type CreateUserInput } from '@/validators/user.validators'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CreateUserDialogProps {
  roles: Role[]
  onCreated: () => void
}

export function CreateUserDialog({ roles, onCreated }: CreateUserDialogProps) {
  const currentUser = useAuthStore((s) => s.user)
  // Same rule as editing a user — only a caller with roles:manage can set
  // anything other than the default 'member' role on creation (see
  // backend user.controller.js's createUser).
  const canAssignRole = currentUser?.permissions.includes('roles:manage') ?? false

  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  // Set once creation succeeds — the backend emails the temporary password
  // directly to the new user rather than returning it in the response, so
  // there's nothing left to display here except confirmation.
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) })

  async function onSubmit(values: CreateUserInput) {
    setApiError(null)
    try {
      const payload = canAssignRole ? values : { name: values.name, email: values.email }
      const result = await userService.createUser(payload)
      setCreatedEmail(result.user.email)
      onCreated()
    } catch (error) {
      setApiError(
        axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Something went wrong. Please try again.'
      )
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      reset()
      setApiError(null)
      setCreatedEmail(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        {createdEmail ? (
          <>
            <DialogHeader>
              <DialogTitle>User created</DialogTitle>
              <DialogDescription>
                A welcome email with a temporary password has been sent to{' '}
                <span className="font-medium">{createdEmail}</span>. They&apos;ll be asked to set
                their own password on first login.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New user</DialogTitle>
              <DialogDescription>
                Create an account directly — a temporary password is generated automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              {apiError && (
                <Alert variant="destructive">
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-user-name">Name</Label>
                <Input id="new-user-name" {...register('name')} />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input id="new-user-email" type="email" {...register('email')} />
                {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
              </div>
              {canAssignRole && (
                <div className="flex flex-col gap-2">
                  <Label>Role</Label>
                  <Controller
                    control={control}
                    name="roleKey"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Member (default)" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.key} value={r.key}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create user'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
