export type SelectAllState = boolean | 'indeterminate'

// Drives a header "select all" Checkbox's tri-state: unchecked when nothing
// selected, checked when every selectable row is, indeterminate otherwise.
// `Checkbox`'s `checked` prop already accepts Radix's boolean | 'indeterminate'
// union — this just centralizes the comparison so list pages don't each
// reimplement (and risk collapsing to a plain boolean, which was the bug).
export function getSelectAllState(selectedCount: number, selectableCount: number): SelectAllState {
  if (selectableCount === 0 || selectedCount === 0) return false
  if (selectedCount === selectableCount) return true
  return 'indeterminate'
}
