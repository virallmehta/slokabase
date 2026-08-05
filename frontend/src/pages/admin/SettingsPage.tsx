import { useEffect, useState } from 'react'
import axios from 'axios'
import { settingsService, type AppSetting, type SettingGroup } from '@/services/settingsService'
import { coerceSettingValueForSubmit, formatSettingValueForInput } from '@/utils/settingValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type FieldValue = string | boolean

function extractErrorMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.'
}

function toFieldValue(setting: AppSetting): FieldValue {
  if (setting.type === 'boolean') return setting.value === true
  return formatSettingValueForInput(setting)
}

// Application Settings is a single form over a fixed, small set of
// key-value rows — not a collection of records a user browses, filters,
// or deletes one-of. It follows DESIGN.md's detail/edit-view checklist
// (form panel + header Save button), but intentionally has no Back
// button (there's no list it was reached from — it's a direct sidebar
// destination, same as Profile), no status badge, no Delete (nothing to
// delete), and no right rail (no Metadata/Activity/Related concept for a
// settings form). This mirrors AuditLogListPage's documented deviations
// from the list-view checklist for the same reason: don't force-fit
// elements that don't apply to the page's actual shape.
export default function SettingsPage() {
  const [groups, setGroups] = useState<SettingGroup[]>([])
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    settingsService
      .listSettings()
      .then((result) => {
        setGroups(result)
        const initial: Record<string, FieldValue> = {}
        for (const group of result) {
          for (const setting of group.settings) {
            initial[setting.key] = toFieldValue(setting)
          }
        }
        setValues(initial)
      })
      .catch(() => setLoadError("Couldn't load settings — you may not have permission to view them."))
      .finally(() => setIsLoading(false))
  }, [])

  function handleFieldChange(key: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const allSettings = groups.flatMap((g) => g.settings)

  async function handleSave() {
    setSaveError(null)
    setSaved(false)
    setIsSaving(true)
    try {
      const changed = allSettings.filter((setting) => {
        const current = values[setting.key]
        return current !== toFieldValue(setting)
      })

      const updated = await Promise.all(
        changed.map((setting) =>
          settingsService.updateSetting(
            setting.key,
            coerceSettingValueForSubmit(setting.type, values[setting.key])
          )
        )
      )

      if (updated.length > 0) {
        setGroups((prevGroups) =>
          prevGroups.map((group) => ({
            ...group,
            settings: group.settings.map(
              (setting) => updated.find((u) => u.key === setting.key) ?? setting
            ),
          }))
        )
      }
      setSaved(true)
    } catch (error) {
      setSaveError(extractErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  }

  if (isLoading) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground text-sm">Application-wide configuration.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Changes saved.</AlertDescription>
        </Alert>
      )}

      {groups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle>{group.category}</CardTitle>
            <CardDescription>Settings in the {group.category} category.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {group.settings.map((setting) => (
              <div key={setting.key} className="flex flex-col gap-2">
                <Label htmlFor={setting.key} className="capitalize">
                  {setting.key.replace(/_/g, ' ')}
                </Label>
                {setting.type === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={setting.key}
                      checked={values[setting.key] === true}
                      onCheckedChange={(checked) => handleFieldChange(setting.key, checked === true)}
                    />
                    Enabled
                  </label>
                ) : setting.type === 'json' ? (
                  <textarea
                    id={setting.key}
                    value={String(values[setting.key] ?? '')}
                    onChange={(e) => handleFieldChange(setting.key, e.target.value)}
                    rows={4}
                    className={cn(
                      'border-input rounded-lg border bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none',
                      'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
                    )}
                  />
                ) : (
                  <Input
                    id={setting.key}
                    type={setting.type === 'number' ? 'number' : 'text'}
                    value={String(values[setting.key] ?? '')}
                    onChange={(e) => handleFieldChange(setting.key, e.target.value)}
                    className="max-w-md"
                  />
                )}
                {setting.description && (
                  <p className="text-muted-foreground text-xs">{setting.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
