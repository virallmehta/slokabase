import { useEffect, useState } from 'react'
import { publicSettingsService, type PublicSettings } from '@/services/publicSettingsService'

type PublicSettingsStatus = 'loading' | 'success' | 'error'

// Mirrors useMenu's shape/pattern (src/hooks/useMenu.ts) — independently
// fetched wherever it's needed (AppSidebar, App.tsx, SupportContact)
// rather than lifted into shared state, matching how the rest of this
// app fetches per-component rather than through a global store.
export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [status, setStatus] = useState<PublicSettingsStatus>('loading')

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    publicSettingsService
      .getPublicSettings()
      .then((result) => {
        if (cancelled) return
        setSettings(result)
        setStatus('success')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    appName: settings?.appName ?? null,
    supportEmail: settings?.supportEmail ?? null,
    status,
  }
}
