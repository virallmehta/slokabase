import { describe, it, expect, vi, afterEach } from 'vitest'
import { api } from '@/services/api'
import { publicSettingsService } from '@/services/publicSettingsService'

describe('publicSettingsService.getPublicSettings()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns exactly appName from the response', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { appName: 'Slokabase' } })

    const result = await publicSettingsService.getPublicSettings()

    expect(getSpy).toHaveBeenCalledWith('/settings/public')
    expect(result).toEqual({ appName: 'Slokabase' })
  })
})

describe('publicSettingsService subscribe/notifyChanged()', () => {
  it('calls every subscribed listener when notifyChanged() fires', () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    const unsubscribeA = publicSettingsService.subscribe(listenerA)
    const unsubscribeB = publicSettingsService.subscribe(listenerB)

    publicSettingsService.notifyChanged()

    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)

    unsubscribeA()
    unsubscribeB()
  })

  it('stops calling a listener once unsubscribed', () => {
    const listener = vi.fn()
    const unsubscribe = publicSettingsService.subscribe(listener)
    unsubscribe()

    publicSettingsService.notifyChanged()

    expect(listener).not.toHaveBeenCalled()
  })
})
