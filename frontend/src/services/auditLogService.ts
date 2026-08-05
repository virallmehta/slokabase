import { api } from '@/services/api'

export interface AuditLogEntry {
  id: number
  entity_type: string
  entity_id: string
  action: string
  changes: Record<string, { from: unknown; to: unknown }> | null
  created_at: string
  actor_id: number | null
  actor_name: string | null
}

export interface ListAuditLogsParams {
  search?: string
  actorId?: number
  entityType?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface ListAuditLogsResult {
  logs: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

export interface AuditLogFilterOptions {
  entityTypes: string[]
  actions: string[]
}

// Mirrors backend/src/validators/user.validators.js's listUsersSchema cap —
// the "All" rows-per-page option requests this many rather than something
// truly unbounded (see backend/modules/auditLog/validators.js).
export const MAX_AUDIT_LOG_PAGE_SIZE = 500

export const auditLogService = {
  async listAuditLogs(params: ListAuditLogsParams = {}): Promise<ListAuditLogsResult> {
    const { data } = await api.get<ListAuditLogsResult>('/admin/audit-logs', { params })
    return data
  },

  async getFilterOptions(): Promise<AuditLogFilterOptions> {
    const { data } = await api.get<AuditLogFilterOptions>('/admin/audit-logs/filter-options')
    return data
  },
}
