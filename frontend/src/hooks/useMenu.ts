import { useEffect, useState } from 'react'
import { menuService, type MenuGroup } from '@/services/menuService'

type MenuStatus = 'loading' | 'success' | 'error'

export function useMenu() {
  const [groups, setGroups] = useState<MenuGroup[]>([])
  const [status, setStatus] = useState<MenuStatus>('loading')

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    menuService
      .getMenu()
      .then((result) => {
        if (cancelled) return
        setGroups(result)
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

  return { groups, status }
}
