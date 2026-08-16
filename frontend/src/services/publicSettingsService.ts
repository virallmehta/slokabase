import { api } from '@/services/api'

export interface PublicSettings {
  appName: string
}

// usePublicSettings() fetches independently per-component (mirrors
// useMenu's pattern) with no shared cache, so a save on the Settings page
// has no natural way to reach the sidebar's own copy of this data. This
// tiny pub-sub is that missing link: the Settings page calls
// notifyChanged() after a successful save, and every mounted
// usePublicSettings() instance refetches in response — without it, the
// sidebar only picks up a changed app_name by accident, on the next
// unrelated auth-state change.
type Listener = () => void
const listeners = new Set<Listener>()

// Reachable by any authenticated user — no settings:read/settings:manage
// required (see backend src/routes/settings.routes.js's publicSettingsRouter).
// Only ever exposes this one field; never widen this without checking
// backend/CLAUDE.md's "Hard config vs. soft setting vs. plain constant" rule.
export const publicSettingsService = {
  async getPublicSettings(): Promise<PublicSettings> {
    const { data } = await api.get<PublicSettings>('/settings/public')
    return data
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  // Call after any write that could have changed app_name
  // (currently just Settings page saves) so every mounted
  // usePublicSettings() instance refetches immediately.
  notifyChanged(): void {
    for (const listener of listeners) listener()
  },
}
