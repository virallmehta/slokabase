import { describe, it, expect } from 'vitest'
import { buildAuditLogQueryParams, type AuditLogFilterState } from '@/utils/auditLogQuery'
import { MAX_AUDIT_LOG_PAGE_SIZE } from '@/services/auditLogService'

const baseState: AuditLogFilterState = {
  search: '',
  actorId: 'all',
  entityType: 'all',
  action: 'all',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 25,
}

describe('buildAuditLogQueryParams', () => {
  it('sends only page/limit when every filter is at its "no filter" default', () => {
    expect(buildAuditLogQueryParams(baseState)).toEqual({ page: 1, limit: 25 })
  })

  it('includes a trimmed search term', () => {
    const params = buildAuditLogQueryParams({ ...baseState, search: '  Admin  ' })
    expect(params.search).toBe('Admin')
  })

  it('omits search entirely when it is blank or only whitespace', () => {
    expect(buildAuditLogQueryParams({ ...baseState, search: '' }).search).toBeUndefined()
    expect(buildAuditLogQueryParams({ ...baseState, search: '   ' }).search).toBeUndefined()
  })

  it('omits actorId when the filter is "all"', () => {
    expect(buildAuditLogQueryParams({ ...baseState, actorId: 'all' }).actorId).toBeUndefined()
  })

  it('parses a selected actorId to a number', () => {
    expect(buildAuditLogQueryParams({ ...baseState, actorId: '7' }).actorId).toBe(7)
  })

  it('omits actorId if it somehow is not a valid number (defensive)', () => {
    expect(buildAuditLogQueryParams({ ...baseState, actorId: 'not-a-number' }).actorId).toBeUndefined()
  })

  it('omits entityType/action when "all"', () => {
    const params = buildAuditLogQueryParams({ ...baseState, entityType: 'all', action: 'all' })
    expect(params.entityType).toBeUndefined()
    expect(params.action).toBeUndefined()
  })

  it('includes entityType/action when a specific value is chosen', () => {
    const params = buildAuditLogQueryParams({ ...baseState, entityType: 'role', action: 'delete' })
    expect(params.entityType).toBe('role')
    expect(params.action).toBe('delete')
  })

  it('omits dateFrom/dateTo when empty', () => {
    const params = buildAuditLogQueryParams({ ...baseState, dateFrom: '', dateTo: '' })
    expect(params.dateFrom).toBeUndefined()
    expect(params.dateTo).toBeUndefined()
  })

  it('includes dateFrom/dateTo when set', () => {
    const params = buildAuditLogQueryParams({
      ...baseState,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    })
    expect(params.dateFrom).toBe('2026-01-01')
    expect(params.dateTo).toBe('2026-01-31')
  })

  it('maps the "All" rows-per-page sentinel to MAX_AUDIT_LOG_PAGE_SIZE', () => {
    const params = buildAuditLogQueryParams({ ...baseState, limit: 'all' })
    expect(params.limit).toBe(MAX_AUDIT_LOG_PAGE_SIZE)
  })

  it('passes a numeric limit straight through', () => {
    expect(buildAuditLogQueryParams({ ...baseState, limit: 100 }).limit).toBe(100)
  })

  it('combines every filter at once', () => {
    const params = buildAuditLogQueryParams({
      search: 'jane',
      actorId: '3',
      entityType: 'user',
      action: 'update',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      page: 2,
      limit: 50,
    })
    expect(params).toEqual({
      search: 'jane',
      actorId: 3,
      entityType: 'user',
      action: 'update',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      page: 2,
      limit: 50,
    })
  })
})
