import { describe, it, expect, vi, afterEach } from 'vitest'
import { api } from '@/services/api'
import { env } from '@/config/env'
import { menuService, type MenuGroup } from '@/services/menuService'

// Permission filtering itself happens entirely server-side (backend
// src/controllers/menu.controller.js walks each module's menu tree and
// keeps only nodes whose requiredPermission the caller holds) — there is
// deliberately no client-side filtering logic to unit-test here. What
// these tests cover instead: given the kind of already-filtered payload
// the API sends back for a given role, menuService faithfully returns
// exactly that data — it doesn't add, drop, or reshape items on the way
// through, so a permission decision made by the backend is the one the
// sidebar actually renders.

const adminMenu: MenuGroup[] = [
  {
    group: 'Catalog',
    items: [
      {
        key: 'products',
        path: '/api/v1/products',
        label: 'Products',
        icon: 'box',
        order: 10,
        group: 'Catalog',
        requiredPermission: 'products:read',
        children: [],
      },
      {
        key: 'sales',
        path: '/api/v1/sales',
        label: 'Sales',
        icon: 'receipt',
        order: 20,
        group: 'Catalog',
        requiredPermission: 'sales:read',
        children: [],
      },
    ],
  },
]

// A member with no module permissions — this is the real shape
// GET /api/menu returns for that role (verified in the backend's own
// menu.test.js), not a client-side-filtered version of adminMenu.
const memberMenu: MenuGroup[] = []

describe('menuService.getMenu()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the full tree for a payload shaped like an admin response', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { menu: adminMenu } })

    const result = await menuService.getMenu()

    expect(result).toEqual(adminMenu)
    expect(result[0].items.map((item) => item.key)).toEqual(['products', 'sales'])
  })

  it('returns an empty tree for a payload shaped like a permission-less member response', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { menu: memberMenu } })

    const result = await menuService.getMenu()

    expect(result).toEqual([])
  })

  it('only returns items the payload actually included (no items invented or dropped)', async () => {
    const partialMenu: MenuGroup[] = [
      {
        group: 'Catalog',
        items: [adminMenu[0].items[0]], // only "products", as if the caller lacked sales:read
      },
    ]
    vi.spyOn(api, 'get').mockResolvedValue({ data: { menu: partialMenu } })

    const result = await menuService.getMenu()

    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].key).toBe('products')
  })

  it('requests the unversioned /api/menu endpoint (backend mounts it outside /api/v1)', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { menu: [] } })

    await menuService.getMenu()

    expect(getSpy).toHaveBeenCalledWith('/menu', { baseURL: env.apiRootUrl })
  })
})
