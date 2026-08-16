import { useEffect, useState } from 'react'
import { publicSettingsService, type PublicSettings } from '@/services/publicSettingsService'
import { useAuthStore } from '@/store/authStore'

type PublicSettingsStatus = 'loading' | 'success' | 'error'

// Mirrors useMenu's shape/pattern (src/hooks/useMenu.ts) — independently
// fetched wherever it's needed (AppSidebar, App.tsx) rather than lifted
// into shared state, matching how the rest of this app fetches
// per-component rather than through a global store.
export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [status, setStatus] = useState<PublicSettingsStatus>('loading')
  // GET /settings/public requires authentication, so the very first
  // mount-time fetch (before login) legitimately 401s. Without watching
  // auth state, an in-SPA login (no page reload) would never trigger a
  // refetch and document.title/etc. would stay stale forever.
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    let cancelled = false

    function fetchSettings() {
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
    }

    fetchSettings()
    // Refetch on demand too — see publicSettingsService's notifyChanged(),
    // called by the Settings page after a successful save, so an edited
    // app_name reaches the sidebar immediately instead of waiting for the
    // next unrelated auth-state change.
    const unsubscribe = publicSettingsService.subscribe(fetchSettings)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  return {
    appName: settings?.appName ?? null,
    status,
  }
}
