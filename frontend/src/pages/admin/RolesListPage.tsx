import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { roleService, type AdminRole } from '@/services/roleService'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getSelectAllState } from '@/utils/selectionState'
import { DataTable } from '@/components/data-table/DataTable'
import { DataTablePagination, type PageSize } from '@/components/data-table/DataTablePagination'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ROUTES } from '@/constants/routes'

// frontend/DESIGN.md's list-view checklist requires exactly 25/50/100/All
// as the "Rows per page" options — 25 (the smallest) is the default.
const DEFAULT_PAGE_SIZE: PageSize = 25

type TypeFilter = 'all' | 'system' | 'custom'

// GET /admin/roles returns the full, unfiltered role list (unlike
// /users, which is server-paginated) — the roles list is expected to
// stay small (a handful of system roles plus whatever custom ones an
// admin adds), so search/filter/pagination are done client-side here
// against that one fetch rather than adding backend query support.
export default function RolesListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [allRoles, setAllRoles] = useState<AdminRole[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    roleService
      .listRoles()
      .then((result) => {
        if (cancelled) return
        setAllRoles(result)
        setSelectedIds(new Set())
      })
      .catch(() => {
        if (cancelled) return
        setError("You don't have permission to view this, or something went wrong.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Any filter/page-size change resets to page 1 — otherwise you can land
  // on an out-of-range page for the new, narrower result set.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, limit])

  function refetch() {
    setRefreshKey((key) => key + 1)
  }

  const filteredRoles = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return allRoles.filter((role) => {
      if (typeFilter === 'system' && !role.is_system) return false
      if (typeFilter === 'custom' && role.is_system) return false
      if (!term) return true
      return (
        role.name.toLowerCase().includes(term) ||
        (role.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [allRoles, debouncedSearch, typeFilter])

  const pagedRoles = useMemo(() => {
    if (limit === 'all') return filteredRoles
    const start = (page - 1) * limit
    return filteredRoles.slice(start, start + limit)
  }, [filteredRoles, page, limit])

  const selectableIds = useMemo(
    () => pagedRoles.filter((r) => !r.is_system).map((r) => r.id),
    [pagedRoles]
  )

  const toggleRow = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(selectableIds) : new Set())
    },
    [selectableIds]
  )

  async function handleConfirmDelete() {
    if (pendingDeleteId == null) return
    setDeleteError(null)
    try {
      await roleService.deleteRole(pendingDeleteId)
      setPendingDeleteId(null)
      refetch()
    } catch {
      // Most likely a role still assigned to users (409) — the backend is
      // the source of truth here, this dialog just surfaces its response.
      setDeleteError('Could not delete this role. It may still be assigned to users.')
    }
  }

  async function handleConfirmBulkDelete() {
    setIsBulkWorking(true)
    setBulkError(null)
    try {
      await Promise.all([...selectedIds].map((id) => roleService.deleteRole(id)))
      setPendingBulkDelete(false)
      refetch()
    } catch {
      setBulkError('Could not delete one or more selected roles. They may still be assigned to users.')
    } finally {
      setIsBulkWorking(false)
    }
  }

  const columns = useMemo<ColumnDef<AdminRole>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={getSelectAllState(selectedIds.size, selectableIds.length)}
            onCheckedChange={(checked) => toggleAll(checked === true)}
            disabled={selectableIds.length === 0}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(checked) => toggleRow(row.original.id, checked === true)}
            onClick={(event) => event.stopPropagation()}
            // System roles can't be bulk-deleted (they can't be deleted at
            // all — see modules/roles/controller.js's deleteRole), so
            // there's nothing for their checkbox to select into.
            disabled={row.original.is_system}
            aria-label={`Select ${row.original.name}`}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_system && <Badge variant="secondary">System</Badge>}
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.description || '—'}</span>
        ),
      },
      {
        accessorKey: 'permissionCount',
        header: 'Permissions',
        cell: ({ row }) => Number(row.original.permissionCount ?? 0),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Actions for ${row.original.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`${ROUTES.roles}/${row.original.id}`)}>
                View
              </DropdownMenuItem>
              {/* System roles can't be deleted — hidden here, and rejected
                  server-side regardless (see modules/roles/controller.js's
                  deleteRole) if this were ever bypassed client-side. */}
              {!row.original.is_system && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setPendingDeleteId(row.original.id)}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [navigate, selectableIds, selectedIds, toggleAll, toggleRow]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-muted-foreground text-sm">
            Manage roles and which permissions each one grants.
          </p>
        </div>
        <Button onClick={() => navigate(`${ROUTES.roles}/new`)}>
          <Plus />
          New role
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search by name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIds.size > 0 && (
            <div className="bg-muted flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingBulkDelete(true)}
                  disabled={isBulkWorking}
                >
                  {isBulkWorking ? 'Deleting…' : 'Delete'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {bulkError && (
            <Alert variant="destructive">
              <AlertDescription>{bulkError}</AlertDescription>
            </Alert>
          )}
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={pagedRoles}
                isLoading={isLoading}
                onRowClick={(role) => navigate(`${ROUTES.roles}/${role.id}`)}
              />
              <DataTablePagination
                page={page}
                limit={limit}
                total={filteredRoles.length}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDeleteId != null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the role. This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBulkDelete} onOpenChange={setPendingBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} role(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected roles. This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
