import { useEffect } from 'react'
import { AppRoutes } from '@/routes/AppRoutes'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

function App() {
  const setLoading = useAuthStore((s) => s.setLoading)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)

  // The auth store isn't persisted (session lives in httpOnly cookies), so
  // every hard reload starts from "idle" and needs re-hydrating from
  // whatever cookie the browser is still holding.
  useEffect(() => {
    setLoading()
    authService.me().then(setUser).catch(clear)
  }, [setLoading, setUser, clear])

  return <AppRoutes />
}

export default App
