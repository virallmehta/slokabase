import { describe, it, expect } from 'vitest'
import { createRoleSchema, updateRoleSchema } from '@/validators/role.validators'

describe('createRoleSchema (New role form)', () => {
  it('rejects a missing name', () => {
    const result = createRoleSchema.safeParse({ description: 'No name given' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty-string name', () => {
    const result = createRoleSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a name over 100 characters', () => {
    const result = createRoleSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts a name with no description (description is optional)', () => {
    const result = createRoleSchema.safeParse({ name: 'Support Agent' })
    expect(result.success).toBe(true)
  })

  it('rejects a description over 255 characters', () => {
    const result = createRoleSchema.safeParse({ name: 'Support Agent', description: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })

  it('accepts a fully valid payload', () => {
    const result = createRoleSchema.safeParse({
      name: 'Support Agent',
      description: 'Read-only support access',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateRoleSchema (rename a custom role)', () => {
  it('accepts an empty object — a permissions-only save sends neither field', () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(true)
  })

  it('rejects an empty-string name if one is provided', () => {
    expect(updateRoleSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('accepts a valid rename', () => {
    expect(updateRoleSchema.safeParse({ name: 'Support Lead' }).success).toBe(true)
  })
})
