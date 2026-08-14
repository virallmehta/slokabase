import { describe, it, expect, vi, afterEach } from 'vitest'
import { api } from '@/services/api'
import { publicSettingsService } from '@/services/publicSettingsService'

describe('publicSettingsService.getPublicSettings()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns exactly appName/supportEmail from the response', async () => {
    const getSpy = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { appName: 'Slokabase', supportEmail: 'support@example.com' } })

    const result = await publicSettingsService.getPublicSettings()

    expect(getSpy).toHaveBeenCalledWith('/settings/public')
    expect(result).toEqual({ appName: 'Slokabase', supportEmail: 'support@example.com' })
  })
})
