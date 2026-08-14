import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, MoreHorizontal } from 'lucide-react'
import { userService, MAX_USERS_PAGE_SIZE, type AdminUser, type Role } from '@/services/userService'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getSelectAllState } from '@/utils/selectionState'
import { DataTable } from '@/components/data-table/DataTable'
import { DataTablePagination } from '@/components/data-table/DataTablePagination'
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/constants/pagination'
import { CreateUserDialog } from '@/pages/admin/CreateUserDialog'
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

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

function exportToCsv(users: AdminUser[]) {
  const header = ['Name', 'Email', 'Role', 'Status', 'Last login']
  const rows = users.map((u) => [u.name, u.email, u.role, u.status, formatDate(u.last_login_at)])
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'users-export.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function UsersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [roles, setRoles] = useState<Role[]>([])
  const [result, setResult] = useState<{ users: AdminUser[]; total: number }>({ users: [], total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  useEffect(() => {
    userService.listRoles().then(setRoles).catch(() => {})
  }, [])

  // Any filter/page-size change resets to page 1 — otherwise you can land
  // on an out-of-range page for the new, narrower result set.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, status, limit])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    userService
      .listUsers({
        search: debouncedSearch || undefined,
        role: role === 'all' ? undefined : role,
        status: status === 'all' ? undefined : (status as 'active' | 'suspended'),
        page,
        // "All" isn't literally unbounded server-side — the backend caps
        // a single request at MAX_USERS_PAGE_SIZE (see userService.ts's
        // comment and user.validators.js's listUsersSchema). Fine for
        // realistic admin-tool user counts; if the table ever grows past
        // that cap, "All" silently becomes "the first MAX_USERS_PAGE_SIZE".
        limit: limit === 'all' ? MAX_USERS_PAGE_SIZE : limit,
      })
      .then((res) => {
        if (cancelled) return
        setResult(res)
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
  }, [debouncedSearch, role, status, page, limit, refreshKey])

  function refetch() {
    setRefreshKey((key) => key + 1)
  }

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
      setSelectedIds(checked ? new Set(result.users.map((u) => u.id)) : new Set())
    },
    [result.users]
  )

  async function handleBulkArchive() {
    setIsBulkWorking(true)
    try {
      await Promise.all([...selectedIds].map((id) => userService.updateUser(id, { status: 'suspended' })))
      refetch()
    } finally {
      setIsBulkWorking(false)
    }
  }

  function handleBulkExport() {
    exportToCsv(result.users.filter((u) => selectedIds.has(u.id)))
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId == null) return
    await userService.deleteUser(pendingDeleteId)
    setPendingDeleteId(null)
    refetch()
  }

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={getSelectAllState(selectedIds.size, result.users.length)}
            onCheckedChange={(checked) => toggleAll(checked === true)}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(checked) => toggleRow(row.original.id, checked === true)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${row.original.name}`}
          />
        ),
      },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'success' : 'danger'} className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'last_login_at',
        header: 'Last login',
        cell: ({ row }) => formatDate(row.original.last_login_at),
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
              <DropdownMenuItem onClick={() => navigate(`/users/${row.original.id}`)}>View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/users/${row.original.id}`)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setPendingDeleteId(row.original.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [result.users, selectedIds, navigate, toggleAll, toggleRow]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm">Manage accounts, roles, and access.</p>
        </div>
        <CreateUserDialog roles={roles} onCreated={refetch} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIds.size > 0 && (
            <div className="bg-muted flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkExport}>
                  <Download />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkArchive} disabled={isBulkWorking}>
                  {isBulkWorking ? 'Archiving…' : 'Archive'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={result.users}
                isLoading={isLoading}
                onRowClick={(user) => navigate(`/users/${user.id}`)}
              />
              <DataTablePagination
                page={page}
                limit={limit}
                total={result.total}
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
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the account. This action can&apos;t be undone.
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
