import type { ListAuditLogsParams } from '@/services/auditLogService'
import { MAX_AUDIT_LOG_PAGE_SIZE } from '@/services/auditLogService'
import type { PageSize } from '@/constants/pagination'

// Raw UI state from AuditLogListPage's controls — Select components use
// the sentinel 'all' for "no filter" (consistent with RolesListPage's
// TypeFilter), date inputs are '' when empty, actorId is a string because
// it comes straight off a <Select> value.
export interface AuditLogFilterState {
  search: string
  actorId: string
  entityType: string
  action: string
  dateFrom: string
  dateTo: string
  page: number
  limit: PageSize
}

// Turns that UI state into exactly the query params the backend expects —
// pulled out as a pure function so the "which filters actually get sent"
// logic is unit-testable without rendering the page (no
// @testing-library/react in this project — see frontend/CLAUDE.md).
export function buildAuditLogQueryParams(state: AuditLogFilterState): ListAuditLogsParams {
  const params: ListAuditLogsParams = {
    page: state.page,
    limit: state.limit === 'all' ? MAX_AUDIT_LOG_PAGE_SIZE : state.limit,
  }

  const search = state.search.trim()
  if (search) params.search = search

  if (state.actorId !== 'all' && state.actorId !== '') {
    const actorId = Number(state.actorId)
    if (!Number.isNaN(actorId)) params.actorId = actorId
  }

  if (state.entityType !== 'all' && state.entityType !== '') params.entityType = state.entityType
  if (state.action !== 'all' && state.action !== '') params.action = state.action
  if (state.dateFrom) params.dateFrom = state.dateFrom
  if (state.dateTo) params.dateTo = state.dateTo

  return params
}
