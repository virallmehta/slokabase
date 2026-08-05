import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { ArrowLeft } from 'lucide-react'
import { roleService, type AdminRole, type PermissionGroup } from '@/services/roleService'
import { createRoleSchema, type CreateRoleInput } from '@/validators/role.validators'
import { initialSelection, toggleSelection, toPermissionKeysPayload } from '@/utils/permissionSelection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

function extractErrorMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.'
}

interface LocationState {
  justCreated?: boolean
}

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isCreate = id === 'new'

  const [role, setRole] = useState<AdminRole | null>(null)
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState('Changes saved.')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoleInput>({ resolver: zodResolver(createRoleSchema) })

  useEffect(() => {
    if (!id) return

    if (isCreate) {
      roleService
        .getPermissionCatalog()
        .then((result) => {
          setGroups(result.groups)
          setSelected(initialSelection(result.groups))
        })
        .catch(() => setLoadError("Couldn't load the permission list."))
      reset({ name: '', description: '' })
      return
    }

    roleService
      .getRolePermissions(id)
      .then((result) => {
        setRole(result.role)
        setGroups(result.groups)
        setSelected(initialSelection(result.groups))
        reset({ name: result.role.name, description: result.role.description ?? '' })
      })
      .catch(() => setLoadError("Couldn't load this role — you may not have permission to view it."))
  }, [id, isCreate, reset])

  // Landed here right after "Create role" (see onSubmit below) — show the
  // same saved-confirmation the edit flow already gives, worded for
  // creation instead of a permissions/details save. Split out from the
  // data-loading effect above so it only ever runs once per navigation,
  // regardless of that effect's own dependencies.
  useEffect(() => {
    if (!(location.state as LocationState | null)?.justCreated) return
    setSavedMessage('Role created.')
    setSaved(true)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location, navigate])

  function handleToggle(key: string, checked: boolean) {
    setSelected((prev) => toggleSelection(prev, key, checked))
  }

  async function onSubmit(values: CreateRoleInput) {
    setSaveError(null)
    setSaved(false)
    setIsSaving(true)
    try {
      if (isCreate) {
        const result = await roleService.createRole({
          name: values.name,
          description: values.description,
          permissionKeys: toPermissionKeysPayload(selected),
        })
        // Redirect into the new role's own detail page rather than back to
        // the list — same "land where the change happened" pattern as the
        // edit flow's "Changes saved" banner, just for creation instead.
        navigate(`/roles/${result.role.id}`, { state: { justCreated: true } })
        return
      }

      if (!id) return

      // System roles' name/description can't be changed — only send the
      // rename request for custom roles (matches the backend guard in
      // modules/roles/controller.js's updateRole).
      if (!role?.is_system) {
        const updatedRole = await roleService.updateRole(id, {
          name: values.name,
          description: values.description,
        })
        setRole(updatedRole)
      }

      const result = await roleService.updateRolePermissions(id, toPermissionKeysPayload(selected))
      setRole(result.role)
      setGroups(result.groups)
      setSavedMessage('Changes saved.')
      setSaved(true)
    } catch (error) {
      setSaveError(extractErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!id) return
    setDeleteError(null)
    try {
      await roleService.deleteRole(id)
      navigate('/roles')
    } catch (error) {
      setConfirmDeleteOpen(false)
      setDeleteError(extractErrorMessage(error))
    }
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  }

  if (!isCreate && !role) return null

  const canDelete = !isCreate && !role?.is_system

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/roles')}>
          <ArrowLeft />
          Back to roles
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{isCreate ? 'New role' : role?.name}</h1>
          {role?.is_system && <Badge variant="secondary">System</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </Button>
          )}
          <Button type="submit" form="role-form" disabled={isSaving}>
            {isSaving ? 'Saving…' : isCreate ? 'Create role' : 'Save changes'}
          </Button>
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>{savedMessage}</AlertDescription>
        </Alert>
      )}

      <form id="role-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              {role?.is_system
                ? 'System role — name and description cannot be changed, only its permissions.'
                : 'Name and describe this role.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              {/* readOnly (not disabled) for system roles — disabled's
                  built-in opacity fade made the field very hard to read;
                  readOnly blocks editing while keeping the same border/
                  background contrast as any other input in the app. */}
              <Input id="name" readOnly={role?.is_system} {...register('name')} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" readOnly={role?.is_system} {...register('description')} />
              {errors.description && (
                <p className="text-destructive text-sm">{errors.description.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>Grant or revoke access, grouped by module.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.module} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">{group.module}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.permissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-start gap-2 rounded-md border p-3 text-sm"
                    >
                      <Checkbox
                        checked={selected.has(permission.key)}
                        onCheckedChange={(checked) => handleToggle(permission.key, checked === true)}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 font-medium">
                          {permission.key}
                          {permission.isSystem && (
                            <Badge variant="secondary" className="text-[10px]">
                              Core
                            </Badge>
                          )}
                        </span>
                        {permission.description && (
                          <span className="text-muted-foreground">{permission.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </form>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {role?.name}. This action can&apos;t be undone.
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
