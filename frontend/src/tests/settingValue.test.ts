import { describe, it, expect } from 'vitest'
import { coerceSettingValueForSubmit, formatSettingValueForInput } from '@/utils/settingValue'
import type { AppSetting } from '@/services/settingsService'

describe('coerceSettingValueForSubmit', () => {
  it('coerces a string type to a string', () => {
    expect(coerceSettingValueForSubmit('string', 'Slokabase')).toBe('Slokabase')
  })

  it('coerces a number-typed field from its raw string DOM value to a number', () => {
    expect(coerceSettingValueForSubmit('number', '25')).toBe(25)
  })

  it('throws for a number field given a non-numeric raw value', () => {
    expect(() => coerceSettingValueForSubmit('number', 'not-a-number')).toThrow(/Expected a number/)
  })

  it('coerces a boolean field from a real boolean', () => {
    expect(coerceSettingValueForSubmit('boolean', true)).toBe(true)
    expect(coerceSettingValueForSubmit('boolean', false)).toBe(false)
  })

  it('coerces a boolean field from the string "true"/"false" defensively', () => {
    expect(coerceSettingValueForSubmit('boolean', 'true')).toBe(true)
    expect(coerceSettingValueForSubmit('boolean', 'false')).toBe(false)
  })

  it('parses a json field from its textarea string', () => {
    expect(coerceSettingValueForSubmit('json', '{"a":1}')).toEqual({ a: 1 })
  })

  it('throws for invalid JSON in a json field rather than silently sending garbage', () => {
    expect(() => coerceSettingValueForSubmit('json', '{not valid json')).toThrow()
  })
})

describe('formatSettingValueForInput', () => {
  const base: Omit<AppSetting, 'value' | 'type'> = {
    key: 'x',
    category: 'General',
    description: null,
    updated_by: null,
    updated_at: '2026-01-01T00:00:00.000Z',
  }

  it('formats a string value as-is', () => {
    expect(formatSettingValueForInput({ ...base, type: 'string', value: 'Slokabase' })).toBe('Slokabase')
  })

  it('formats a number value as its string representation', () => {
    expect(formatSettingValueForInput({ ...base, type: 'number', value: 25 })).toBe('25')
  })

  it('formats a json value as pretty-printed JSON', () => {
    const formatted = formatSettingValueForInput({ ...base, type: 'json', value: { a: 1 } })
    expect(JSON.parse(formatted)).toEqual({ a: 1 })
    expect(formatted).toContain('\n') // pretty-printed, not single-line
  })

  it('round-trips through coerce -> format for a number', () => {
    const coerced = coerceSettingValueForSubmit('number', '100')
    const formatted = formatSettingValueForInput({ ...base, type: 'number', value: coerced })
    expect(formatted).toBe('100')
  })
})
