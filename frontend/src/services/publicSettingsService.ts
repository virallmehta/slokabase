import { api } from '@/services/api'

export interface PublicSettings {
  appName: string
  supportEmail: string
}

// Reachable by any authenticated user — no settings:read/settings:manage
// required (see backend src/routes/settings.routes.js's publicSettingsRouter).
// Only ever exposes these two fields; never widen this without checking
// backend/CLAUDE.md's "Hard config vs. soft setting vs. plain constant" rule.
export const publicSettingsService = {
  async getPublicSettings(): Promise<PublicSettings> {
    const { data } = await api.get<PublicSettings>('/settings/public')
    return data
  },
}
