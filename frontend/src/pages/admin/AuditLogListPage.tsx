import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { auditLogService, type AuditLogEntry, type AuditLogFilterOptions } from '@/services/auditLogService'
import { userService } from '@/services/userService'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { buildAuditLogQueryParams } from '@/utils/auditLogQuery'
import { DataTable } from '@/components/data-table/DataTable'
import { DataTablePagination } from '@/components/data-table/DataTablePagination'
import type { ColumnDef } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/constants/pagination'

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function actionBadgeVariant(action: string): 'success' | 'danger' | 'secondary' {
  if (action === 'create') return 'success'
  if (action === 'delete') return 'danger'
  return 'secondary'
}

function formatModule(entityType: string) {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1)
}

// A handful of actions are deliberately recorded with no field-level diff
// at all (see backend/CLAUDE.md's audit logging section — password
// values are never logged, old or new) rather than merely having an
// empty one. The generic "No field-level changes recorded for this
// action" message reads as if nothing happened for these, which is
// wrong — give each an accurate, specific description instead. Any
// action not listed here still gets the generic message, which remains
// correct for those (e.g. a save that touched no fields).
const NO_DIFF_ACTION_DESCRIPTIONS: Record<string, string> = {
  password_change: 'Password was changed.',
  password_reset: 'Password was reset via a password reset link.',
  password_reset_requested: 'A password reset link was requested.',
}

interface AdminUserOption {
  id: number
  name: string
}

export default function AuditLogListPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [actorId, setActorId] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [action, setAction] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<PageSize>(DEFAULT_PAGE_SIZE)

  const [result, setResult] = useState<{ logs: AuditLogEntry[]; total: number }>({ logs: [], total: 0 })
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>({ entityTypes: [], actions: [] })
  const [users, setUsers] = useState<AdminUserOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<AuditLogEntry | null>(null)

  useEffect(() => {
    auditLogService.getFilterOptions().then(setFilterOptions).catch(() => {})
    // A flat list of users to populate the "Actor" filter — MAX_USERS_PAGE_SIZE
    // (500) comfortably covers a realistic admin-tool user count in one call.
    userService
      .listUsers({ limit: 500 })
      .then((res) => setUsers(res.users.map((u) => ({ id: u.id, name: u.name }))))
      .catch(() => {})
  }, [])

  // Any filter/page-size change resets to page 1 — otherwise you can land
  // on an out-of-range page for the new, narrower result set.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, actorId, entityType, action, dateFrom, dateTo, limit])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = buildAuditLogQueryParams({
      search: debouncedSearch,
      actorId,
      entityType,
      action,
      dateFrom,
      dateTo,
      page,
      limit,
    })

    auditLogService
      .listAuditLogs(params)
      .then((res) => {
        if (cancelled) return
        setResult(res)
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
  }, [debouncedSearch, actorId, entityType, action, dateFrom, dateTo, page, limit])

  const columns = useMemo<ColumnDef<AuditLogEntry>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Timestamp',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        accessorKey: 'actor_name',
        header: 'Actor',
        cell: ({ row }) => row.original.actor_name ?? 'System',
      },
      {
        accessorKey: 'entity_type',
        header: 'Module',
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {formatModule(row.original.entity_type)}
          </Badge>
        ),
      },
      {
        accessorKey: 'entity_id',
        header: 'Entity',
        cell: ({ row }) => `#${row.original.entity_id}`,
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <Badge variant={actionBadgeVariant(row.original.action)} className="capitalize">
            {row.original.action.replace(/_/g, ' ')}
          </Badge>
        ),
      },
      {
        id: 'changes',
        header: 'Changes',
        cell: ({ row }) => {
          const fields = row.original.changes ? Object.keys(row.original.changes) : []
          if (fields.length === 0) return <span className="text-muted-foreground">—</span>
          return (
            <span className="text-muted-foreground">
              {fields.length === 1 ? fields[0] : `${fields.length} fields changed`}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation()
              setViewing(row.original)
            }}
            aria-label="View details"
          >
            <Eye />
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Every create, update, and delete recorded across Users and Roles.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              placeholder="Search by actor name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={actorId} onValueChange={setActorId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {filterOptions.entityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatModule(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {filterOptions.actions.map((a) => (
                  <SelectItem key={a} value={a} className="capitalize">
                    {a.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date-from" className="text-muted-foreground text-xs">
                From
              </Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date-to" className="text-muted-foreground text-xs">
                To
              </Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              {/*
                No checkbox column or bulk-action bar here, unlike
                Users/Roles: audit log entries are an immutable record —
                there's no create/edit/delete action a bulk selection
                could ever enable (see DESIGN.md's list-view checklist
                note on this exact exception). The per-row action is a
                single "View details" button, not a View/Edit/Delete
                kebab, for the same reason — Edit and Delete don't apply
                to a log entry, and folding one action into a 3-dot menu
                would just add a click for no benefit.
              */}
              <DataTable columns={columns} data={result.logs} isLoading={isLoading} />
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

      <Dialog open={viewing != null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {viewing && `${formatModule(viewing.entity_type)} #${viewing.entity_id} — ${viewing.action.replace(/_/g, ' ')}`}
            </DialogTitle>
            <DialogDescription>
              {viewing && `${viewing.actor_name ?? 'System'} · ${formatDate(viewing.created_at)}`}
            </DialogDescription>
          </DialogHeader>
          {viewing?.changes ? (
            <div className="flex flex-col gap-3 text-sm">
              {Object.entries(viewing.changes).map(([field, diff]) => (
                <div key={field} className="rounded-md border p-3">
                  <p className="font-medium capitalize">{field}</p>
                  <p className="text-muted-foreground mt-1">
                    {JSON.stringify(diff.from) ?? '—'} → {JSON.stringify(diff.to) ?? '—'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {(viewing && NO_DIFF_ACTION_DESCRIPTIONS[viewing.action]) ??
                'No field-level changes recorded for this action.'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
