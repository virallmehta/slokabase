import type { AppSetting, SettingType } from '@/services/settingsService'

// Every form control's raw value comes off the DOM as a string (even
// number inputs, via `e.target.value`) or a boolean (a Checkbox's
// onCheckedChange) — this coerces it to whatever type the backend
// actually expects for that setting before PUT /admin/settings/:key,
// mirroring the type check backend/modules/settings/controller.js's
// `typeMatches` enforces server-side. Pulled out as a pure function so
// the coercion (and its failure cases) can be unit tested without
// rendering the form.
export function coerceSettingValueForSubmit(
  type: SettingType,
  raw: string | boolean
): AppSetting['value'] {
  if (type === 'boolean') return raw === true || raw === 'true'

  if (type === 'number') {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) {
      throw new Error(`Expected a number, got "${raw}"`)
    }
    return parsed
  }

  if (type === 'json') {
    if (typeof raw !== 'string') throw new Error('Expected a JSON string')
    return JSON.parse(raw) as Record<string, unknown>
  }

  // 'string'
  return String(raw)
}

// The inverse — formats a setting's already-cast value back into whatever
// a form control needs to display/edit it (all controls other than the
// boolean Checkbox work off a string).
export function formatSettingValueForInput(setting: AppSetting): string {
  if (setting.type === 'json') return JSON.stringify(setting.value, null, 2)
  return String(setting.value)
}
