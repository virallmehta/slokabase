import { api } from '@/services/api'

export type SettingType = 'string' | 'number' | 'boolean' | 'json'

export interface AppSetting {
  key: string
  value: string | number | boolean | Record<string, unknown>
  type: SettingType
  category: string
  description: string | null
  updated_by: number | null
  updated_at: string
}

export interface SettingGroup {
  category: string
  settings: AppSetting[]
}

export const settingsService = {
  async listSettings(): Promise<SettingGroup[]> {
    const { data } = await api.get<{ groups: SettingGroup[] }>('/admin/settings')
    return data.groups
  },

  async updateSetting(key: string, value: AppSetting['value']): Promise<AppSetting> {
    const { data } = await api.put<{ setting: AppSetting }>(`/admin/settings/${key}`, { value })
    return data.setting
  },

  async sendTestEmail(): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/admin/settings/test-email')
    return data
  },
}
