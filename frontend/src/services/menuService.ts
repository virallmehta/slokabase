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
    // A misconfigured API URL (e.g. a relative VITE_API_URL with no
    // matching dev proxy) can resolve this request against the frontend's
    // own dev server, which returns its SPA-fallback HTML with a 200
    // instead of erroring — data.menu would be undefined in that case.
    // Guard here so a bad response degrades to an empty menu (the caller
    // still sees status: 'success' with no items) rather than corrupting
    // AppSidebar's groups state with something non-array.
    return Array.isArray(data.menu) ? data.menu : []
  },
}
