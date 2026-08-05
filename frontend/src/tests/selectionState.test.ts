import { describe, it, expect } from 'vitest'
import { getSelectAllState } from '@/utils/selectionState'

describe('getSelectAllState (header select-all Checkbox tri-state)', () => {
  it('is false when nothing is selected', () => {
    expect(getSelectAllState(0, 5)).toBe(false)
  })

  it('is true when every selectable row is selected', () => {
    expect(getSelectAllState(5, 5)).toBe(true)
  })

  it('is "indeterminate" when some but not all rows are selected', () => {
    expect(getSelectAllState(2, 5)).toBe('indeterminate')
  })

  it('is false when there are no selectable rows at all, regardless of selectedCount', () => {
    expect(getSelectAllState(0, 0)).toBe(false)
  })

  it('never reports true for a partial selection (the original bug)', () => {
    for (let selected = 1; selected < 5; selected++) {
      expect(getSelectAllState(selected, 5)).toBe('indeterminate')
    }
  })
})
