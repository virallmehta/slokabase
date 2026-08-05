import { api } from '@/services/api'
import { env } from '@/config/env'

export interface MenuItem {
  key: string
  path: string
  label: string
  icon: string
  order: number
  group: string
  requiredPermission?: string
  children: MenuItem[]
}

export interface MenuGroup {
  group: string
  items: MenuItem[]
}

export const menuService = {
  async getMenu(): Promise<MenuGroup[]> {
    // Unlike every other endpoint, GET /api/menu is mounted unversioned on
    // the backend — override the shared instance's baseURL for this one call.
    const { data } = await api.get<{ menu: MenuGroup[] }>('/menu', {
      baseURL: env.apiRootUrl,
    })
    return data.menu
  },
}
