import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import {
  userService,
  type AdminUser,
  type AuditLogEntry,
  type RelatedSale,
  type Role,
} from '@/services/userService'
import { adminUpdateUserSchema, type AdminUpdateUserInput } from '@/validators/user.validators'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

function describeAuditEntry(entry: AuditLogEntry): string {
  if (entry.action === 'password_change') return 'changed their password'
  if (entry.action === 'create') return 'created this account'
  if (entry.action === 'delete') return 'deleted this account'
  if (entry.changes) {
    const parts = Object.entries(entry.changes).map(
      ([field, { from, to }]) => `${field}: ${String(from ?? '—')} → ${String(to ?? '—')}`
    )
    return `updated ${parts.join(', ')}`
  }
  return entry.action
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  // Role reassignment is a strictly more sensitive action than editing
  // name/email/status — mirrors the backend's own gate (users:write lets
  // you edit a user, roles:manage is required on top of that to touch
  // their role; see user.controller.js's updateUser).
  const canManageRoles = currentUser?.permissions.includes('roles:manage') ?? false
  const canDelete = currentUser?.permissions.includes('users:delete') ?? false

  const [user, setUser] = useState<AdminUser | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [relatedSales, setRelatedSales] = useState<RelatedSale[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminUpdateUserInput>({ resolver: zodResolver(adminUpdateUserSchema) })

  useEffect(() => {
    if (!id) return
    userService
      .getUser(id)
      .then((fetched) => {
        setUser(fetched)
        reset({ name: fetched.name, email: fetched.email, roleKey: fetched.role, status: fetched.status })
      })
      .catch(() => setLoadError("Couldn't load this user — you may not have permission to view it."))
    userService.listRoles().then(setRoles).catch(() => {})
    userService.getAuditLogs(id).then(setAuditLogs).catch(() => {})
    userService.getRelatedSales(id).then(setRelatedSales).catch(() => {})
  }, [id, reset])

  async function onSubmit(values: AdminUpdateUserInput) {
    if (!id) return
    setSaveError(null)
    setSaved(false)
    try {
      // Never submit roleKey unless the viewer can actually manage roles —
      // even though the form was populated with the user's current role,
      // sending it unconditionally would trip the backend's roles:manage
      // gate for a manager just trying to save a name/email change.
      const payload = canManageRoles ? values : { ...values, roleKey: undefined }
      const updated = await userService.updateUser(id, payload)
      setUser(updated)
      setSaved(true)
      userService.getAuditLogs(id).then(setAuditLogs).catch(() => {})
    } catch (error) {
      setSaveError(
        axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Something went wrong. Please try again.'
      )
    }
  }

  async function handleConfirmDelete() {
    if (!id) return
    await userService.deleteUser(id)
    setConfirmDeleteOpen(false)
    navigate('/users')
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft />
          Back to users
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <Badge variant={user.status === 'active' ? 'success' : 'danger'} className="capitalize">
            {user.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && currentUser?.id !== user.id && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </Button>
          )}
          <Button type="submit" form="user-edit-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Changes saved.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Edit this user&apos;s profile and access.</CardDescription>
            </CardHeader>
            <form id="user-edit-form" onSubmit={handleSubmit(onSubmit)} noValidate>
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

                <div className="flex flex-col gap-2">
                  <Label>Role</Label>
                  {canManageRoles ? (
                    <Controller
                      control={control}
                      name="roleKey"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
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
                  ) : (
                    <div>
                      <Badge variant="secondary" className="capitalize">
                        {user.role}
                      </Badge>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Only users with the roles:manage permission can reassign roles.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </CardContent>
            </form>
          </Card>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID</span>
                <span>{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auth provider</span>
                <span className="capitalize">{user.auth_provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(user.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last login</span>
                <span>{formatDate(user.last_login_at)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity log</CardTitle>
              <CardDescription>Who changed what, and when.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground">No activity recorded yet.</p>
              ) : (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <p>
                      <span className="font-medium">{entry.actor_name ?? 'Unknown'}</span>{' '}
                      {describeAuditEntry(entry)}
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDate(entry.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related records</CardTitle>
              <CardDescription>Sales recorded by this user.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {relatedSales.length === 0 ? (
                <p className="text-muted-foreground">No related records.</p>
              ) : (
                relatedSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{sale.product_name}</p>
                      <p className="text-muted-foreground text-xs">{formatDate(sale.sold_at)}</p>
                    </div>
                    <span>
                      {sale.quantity} × ${Number(sale.unit_price).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {user.name}&apos;s account. This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
